# Getting a Blog Through the Scalnex Webhook (Local Guide)

This guide explains **exactly** how a blog gets into StayMaster through the Scalnex
webhook, how to run it locally, and how to use the logs to debug problems.

> Key concept: this webhook is **inbound**. Scalnex.ai (an external AI blog generator)
> **sends** a `POST` to your backend. You don't "pull" from Scalnex — it pushes to you.
> The blog is saved as a **draft** (`active = 0`) and only appears on the public site
> after it's published (`active = 1`).

---

## 1. The end-to-end flow

```
Scalnex.ai (or your test script)
   │  POST /api/webhooks/scalnex/blog
   │  header: x-webhook-secret: <SCALNEX_WEBHOOK_SECRET>
   ▼
routes/scalnexWebhookRoutes.js            → mounts POST /blog
   ▼
middleware/scalnexWebhookAuthHandler.js   → validates the shared secret
   ▼
controllers/scalnexWebhookController.js    → validates JSON, logs the request
   ▼
services/scalnexBlogIngestService.js       → writes audit-log row (scalnex_webhook_log),
   │                                          then ingests
   ├── services/scalnexBlogAdapter.js      → maps Scalnex JSON → blog columns
   ├── helpers/blogImageHelper.js          → downloads cover image → S3 (optional)
   └── models/blogModel.js                 → INSERT/UPDATE into `blogs` (active = 0)
   ▼
GET /api/blogs  →  frontend /blogs page (only shows active = 1)
```

---

## 2. One-time local setup

1. **Database ready** (already done): schema imported + migrations applied.
2. **Create the author user** the webhook attributes blogs to:
   ```powershell
   cd new_beckend
   node scripts/seed_scalnex_webhook_user.js
   ```
   It prints a user id — put it in `.env`.
3. **Set the env vars** in `new_beckend/.env`:
   ```env
   SCALNEX_WEBHOOK_AUTHOR_ID=1            # id printed by the seed script
   SCALNEX_WEBHOOK_SECRET=dev-scalnex-secret
   BLOG_WEBHOOK_DEFAULT_ACTIVE=0          # keep incoming blogs as drafts
   ```
   - In dev, if `SCALNEX_WEBHOOK_SECRET` is **unset**, the secret check is skipped.
     If it's set, the caller must send it in the `x-webhook-secret` header.
4. **Restart the backend** after editing `.env` (env is read at startup):
   ```powershell
   npm run dev
   ```

---

## 3. Send a blog through the webhook (3 ways)

### Option A — the built-in HTTP test (easiest)
```powershell
cd new_beckend
node scripts/test_scalnex_webhook_http.js
```
Creates a new draft each run (it uses a unique `subURL`). Expected output:
```
Status: 200
Body: {"success":true,"data":{"blog_id":3,"status":"draft","action":"created","log_id":3,...}}
```

### Option B — your own payload with curl
```powershell
curl.exe -X POST http://localhost:8080/api/webhooks/scalnex/blog `
  -H "Content-Type: application/json" `
  -H "x-webhook-secret: dev-scalnex-secret" `
  -d '{\"article\":{\"_doc\":{\"heading\":\"My Blog\",\"introText\":\"Intro\",\"tags\":[\"Goa\"],\"subURL\":\"my-blog-1\",\"primaryKeyword\":\"goa\"},\"columns\":[{\"columnType\":\"text\",\"sectionPriority\":1,\"content\":\"<p>Body</p>\"}]}}'
```

### Option C — register in the Scalnex dashboard (production)
Register this URL and header in Scalnex:
```
URL:    https://thestaymaster.com/api/webhooks/scalnex/blog
Header: x-webhook-secret: <SCALNEX_WEBHOOK_SECRET>
```

### Payload shape (official Scalnex format)
```json
{
  "article": {
    "_doc": {
      "heading": "Blog title",
      "introText": "Short intro",
      "tags": ["Travel", "Goa"],
      "subURL": "unique-url-slug",
      "metaTitle": "SEO title",
      "metaDescription": "SEO description",
      "primaryKeyword": "main keyword",
      "secondaryKeywords": ["kw1", "kw2"]
    },
    "columns": [
      { "columnType": "image", "sectionPriority": 1, "content": "https://.../cover.jpg" },
      { "columnType": "text",  "sectionPriority": 2, "content": "<p>HTML body...</p>" },
      { "columnType": "faq",   "sectionPriority": 3, "content": "<div class=\"faq-item\">...</div>" }
    ]
  }
}
```
- `subURL` is the **dedupe key** (`external_id`). Re-sending the same `subURL`
  **updates** the existing draft. If that blog is already published (`active = 1`),
  the update is **skipped** to protect live content.
- A flat/legacy JSON shape is also supported (`title`, `content`, `tags`, `image`, ...).

---

## 4. See / publish the blog

Incoming blogs are **drafts** and hidden from the public site. To view/publish:

- **Read all (incl. drafts)** — the manager API returns inactive blogs:
  `GET /api/manager/blogs`
- **Publish** — set `active = 1`. In production this is done in the manager panel.
  Locally you can flip it via a quick script (reads the DB password from `.env`,
  never on the command line):
  ```powershell
  node -e "require('dotenv').config(); const p=require('./config/dbConnection'); p.query('UPDATE blogs SET active=1 WHERE id=?',[3]).then(()=>process.exit(0))"
  ```
- **Confirm on the public API** (only shows published):
  `GET /api/blogs`
- **On the website**: open `http://localhost:5173/blogs`.

---

## 5. Logs & debugging (where to look when something breaks)

Every webhook is traceable in **three** places:

### a) File logs — `new_beckend/logs/`
- `app-YYYY-MM-DD.log` — all events (received / ingested / warnings), newline-delimited JSON.
- `error-YYYY-MM-DD.log` — errors only, with full stack traces, for fast triage.

Example success trace:
```json
{"ts":"...","level":"info","scope":"scalnex-webhook","message":"Incoming webhook request","meta":{"ip":"...","content_length":"492","has_article":true}}
{"ts":"...","level":"info","scope":"scalnex-ingest","message":"Blog ingested successfully","meta":{"blog_id":3,"status":"created","draft":true}}
```

Read them on Windows:
```powershell
Get-Content .\logs\app-2026-07-04.log -Tail 20
Get-Content .\logs\error-2026-07-04.log -Tail 20
```

### b) Database audit table — `scalnex_webhook_log`
Every webhook writes a row here **even if it fails** (so bad payloads are never lost):
```sql
SELECT id, status, external_id, LEFT(error_message,80) AS error_message, blog_id, created_at
FROM scalnex_webhook_log ORDER BY id DESC LIMIT 10;
```
`status` is one of `received` → `created` / `updated` / `failed`. The full incoming
JSON is stored in the `payload` column, and `error_message` holds the failure reason.

### c) Server console
The same lines are echoed to the `npm run dev` terminal.

### Sensitive data
The logger automatically **redacts** secrets (passwords, tokens, `x-webhook-secret`,
etc.) and truncates very long strings so log files stay readable.

---

## 6. Common errors & what they mean

| HTTP | Response `code` | Cause | Fix |
|------|-----------------|-------|-----|
| 400 | `INVALID_PAYLOAD` | Body isn't a JSON object | Send valid JSON with `Content-Type: application/json` |
| 401 | `Unauthorized` | Wrong/missing `x-webhook-secret` (when secret is set) | Send the correct header value |
| 422 | `INGEST_FAILED` — "Missing required fields" | No `heading`/`content` in payload | Include `article._doc.heading` and at least one content column |
| 422 | `INGEST_FAILED` — "SCALNEX_WEBHOOK_AUTHOR_ID is not configured" | Author user not seeded | Run the seed script, set the env var, restart |
| 200 | `skipped_publish_update: true` | Blog with same `subURL` is already published | Expected — live content is protected from overwrite |

> The "Featured image upload failed" you may see locally is **not fatal** — it happens
> because AWS S3 isn't configured on your machine. The blog is still saved, just without
> a cover image.

---

## 7. Quick verification checklist

```powershell
cd new_beckend
node scripts/test_scalnex_webhook_adapter.js   # mapping unit test (no DB) → PASS
node scripts/test_scalnex_webhook_http.js       # full HTTP round-trip → Status: 200
Get-Content .\logs\app-2026-07-04.log -Tail 10  # confirms file logging
```

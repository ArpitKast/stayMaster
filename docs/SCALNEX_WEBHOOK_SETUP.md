# Scalnex Blog Webhook — Registration & Testing

## Webhook URL

```
POST https://thestaymaster.com/api/webhooks/scalnex/blog
```

- **Content-Type:** `application/json`
- **Response:** `200 OK` with `{ "success": true, "data": { "blog_id", "status": "draft" } }`

## Authentication

```
x-webhook-secret: <SCALNEX_WEBHOOK_SECRET>
```

Also accepted: `webhook-security-key`, `x-scalnex-secret`.

## Official Scalnex payload format

```json
{
  "article": {
    "_doc": {
      "heading": "Blog title",
      "introText": "Short intro",
      "tags": ["tag1", "tag2"],
      "subURL": "url-slug",
      "metaTitle": "SEO title",
      "metaDescription": "SEO description",
      "primaryKeyword": "main keyword",
      "secondaryKeywords": ["kw1", "kw2"]
    },
    "columns": [
      { "columnType": "image", "sectionPriority": 1, "content": "https://..." },
      { "columnType": "text", "sectionPriority": 2, "content": "<p>HTML...</p>" },
      { "columnType": "faq", "sectionPriority": 3, "content": "<div class=\"faq\">...</div>" }
    ]
  }
}
```

### Field mapping (Staymaster `blogs` table)

| Scalnex | Staymaster column |
|---------|-------------------|
| `_doc.heading` | `title` |
| `_doc.introText` + sorted `columns` HTML | `content` |
| `_doc.introText` | `listing_excerpt` |
| `_doc.tags[0]` | `category` |
| `_doc.tags` | `meta_tags` |
| `_doc.primaryKeyword` + `secondaryKeywords` | `keywords` |
| `_doc.subURL` | `external_id` (dedupe) |
| First `image` column (lowest `sectionPriority`) | `featured_image` (downloaded to S3) |
| `faq` columns | `qa_section` (extracted Q&A) + FAQ HTML in content |

### Content rendering

- Columns sorted by `sectionPriority` ascending
- `image` — first image = cover; rest = inline `<img>` in content
- `text`, `html`, `code`, `table`, `quote`, `testimonial` — HTML appended (code fences stripped)
- `faq` — HTML appended + Q&A extracted into `qa_section`
- `ctaButton` — rendered as CTA block in content

## Setup

1. `npm run migrate`
2. `node scripts/seed_scalnex_webhook_user.js`
3. Copy `.env.scalnex.example` → `.env`
4. Register webhook URL in Scalnex dashboard

## Test with curl

```bash
curl -X POST http://localhost:8080/api/webhooks/scalnex/blog \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d "{\"article\":{\"_doc\":{\"heading\":\"Test Blog\",\"introText\":\"Intro text\",\"tags\":[\"Travel\"],\"subURL\":\"test-blog-slug\",\"primaryKeyword\":\"travel\"},\"columns\":[{\"columnType\":\"image\",\"sectionPriority\":1,\"content\":\"https://example.com/cover.jpg\"},{\"columnType\":\"text\",\"sectionPriority\":2,\"content\":\"<p>Body content</p>\"}]}}"
```

## Adapter unit test (no DB)

```bash
node scripts/test_scalnex_webhook_adapter.js
```

## Publish flow

1. Webhook saves draft (`active = 0`)
2. Manager panel → review → set `active = 1`
3. Visible on `/blogs`

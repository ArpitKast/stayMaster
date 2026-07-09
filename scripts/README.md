# Backend Scripts Guide

Utilities in `new_beckend/scripts` help seed data, mirror bookings, exercise APIs, and run database migrations. This document summarizes what each script does, the prerequisites, and example usage.

## Prerequisites

1. **Environment variables** – Most scripts load `../.env.live` (or `.env`). Ensure the following are set:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - Any API tokens or service credentials required by the script you are running
2. **Dependencies** – Run `npm install` inside `new_beckend` so `mysql2`, `dotenv`, etc. are available.
3. **Node version** – These utilities target Node 16+. If you use `nvm`, run `nvm use` before executing scripts.

> All examples below assume your shell cwd is the repository root. Adjust paths if you invoke them from elsewhere.

## Booking/Test Data Scripts

| Script | Purpose | Example |
| --- | --- | --- |
| `create_booking_by_phone.js` | Seed confirmed bookings for an existing user, resolved by phone number. Useful for generating `/api/users/Userbooking` data tied to a specific guest. | `node new_beckend/scripts/create_booking_by_phone.js --phone=+919876543210 --count=2` |
| `seed_user_booking.js` | Insert one or more bookings for a chosen user directly into core tables. Now uses consolidated \`guest_details\` for both master profiles (GUEST-XXXX) and stay-specific info. | \`node new_beckend/scripts/seed_user_booking.js --user-id=123 --adults=2 --children=1\` |
| `seed_live_bookings_from_bookings.js` | Mirror rows from `bookings` into `live_bookings` so `/api/users/Userbooking` returns data without hitting external sources. Now respects dynamic guest counts from `booking_rentalInfo`. | `node new_beckend/scripts/seed_live_bookings_from_bookings.js --user-id=123 --limit=5` |
| `seed_faker_bookings.js` | Bulk-generate synthetic bookings with rich Faker data (Addresses, GST, Birthdays) for high-fidelity testing. Automatically creates consolidated guest entries in \`guest_details\`. | \`node new_beckend/scripts/seed_faker_bookings.js --count=50 --adults=2 --children=2\` |

### `create_booking_by_phone.js` flags
- `--phone=<number>` (required) – Accepts `+91XXXXXXXXXX`, `91XXXXXXXXXX`, or plain digits; the script tries common variants.
- `--count=<n>` – Number of bookings to create (default `1`).
- `--property-id=<id>` – Force a specific property instead of the latest.
- `--check-in=YYYY-MM-DD --check-out=YYYY-MM-DD` – Override stay dates (both required if either is provided).

### `seed_user_booking.js` flags
- `--user-id=<id>` – Target user; defaults to most recent user if omitted.
- `--property-id=<id>` – Target property; auto-seeds one if missing.
- `--count=<n>` – Number of bookings (default `1`).
- `--adults=<n>` – Number of adults per booking (default `1`).
- `--children=<n>` – Number of children per booking (default `0`).

Example:
```bash
node new_beckend/scripts/seed_user_booking.js --user-id=11560 --count=1 --adults=2 --children=1
```

### `seed_faker_bookings.js` flags
- `--users=<n>` – Number of unique users to create (default `3`).
- `--bookings=<n>` – Number of bookings per user (default `2`).
- `--adults=<n>` – Number of adults per booking (default `2`).
- `--children=<n>` – Number of children per booking (default `0`).
- `--mirror-live=true` – Automatically mirror the new bookings into `live_bookings`.
- `--latest-user=true` – Reuse the most recent user instead of creating new ones.

### `seed_live_bookings_from_bookings.js` flags
- `--user-id=<id>` – Mirror bookings for this user (defaults to most recent user).
- `--limit=<n>` – Maximum records to copy (default `10`).

## API + Health Scripts

| Script | Purpose | Example |
| --- | --- | --- |
| `api-test-runner.js` | Runs a curated list of backend endpoints, validating status codes and payload contracts. Great for quick regressions. | `node new_beckend/scripts/api-test-runner.js --filter=booking` |
| `api-test.js` | Lightweight smoke test hitting a subset of endpoints configured inside the file. | `node new_beckend/scripts/api-test.js` |
| `frontend-api-map.js` | Generates a mapping between frontend components and backend endpoints by parsing Angular sources. | `node new_beckend/scripts/frontend-api-map.js > api-map.json` |
| `quick-health-check.js` | Minimal health script verifying DB connectivity and critical tables. | `node new_beckend/scripts/quick-health-check.js` |

## Migration Helpers

| Script | Purpose |
| --- | --- |
| `runMigration.js` | Run a single Knex migration. Accepts `--name` to target a file. |
| `runAllMigrations.js` | Execute the full migration set in order. |
| `runNewDbBuild.js` | Drop and rebuild schema from scratch (use with caution). |
| `runBannerMigration.js` | Targeted one-off migrations for banner table. |

Usage example:
```bash
node new_beckend/scripts/runMigration.js --name=202403101200_add_booking_indexes.js
```

## Helpers Folder

`scripts/helpers` currently contains `liveBookingMirror.js`, which exports `mirrorBookingsForUser`. You can import it in custom scripts to reuse mirroring logic:
```js
const { mirrorBookingsForUser } = require('./helpers/liveBookingMirror');
```

## Troubleshooting

- **Access denied / DB connection failed** – Verify credentials in `.env.live` and ensure the user has network access & grants. Test manually with the `mysql` CLI.
- **Cannot find module** – Run `npm install` inside `new_beckend` so dependencies referenced by the scripts exist.
- **Scripts affecting production data** – Double-check `DB_HOST` before running seeders; consider pointing `.env.live` to a staging database when testing.

## Adding New Scripts

1. Place the file in `new_beckend/scripts/` and keep it Node-compatible (use `#!/usr/bin/env node` if it will be run directly).
2. Load env via `require('dotenv').config({ path: path.join(__dirname, '../.env.live') });` for consistency.
3. Update this README with a short description, flags, and sample invocation so teammates know how to use it.

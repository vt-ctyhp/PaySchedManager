# PaySchedManager v1 Launch Guide

This project bundles an Express API, a Vite/React client, and a shared Drizzle schema for managing recurring payments. The checklist below covers the minimum work needed to deploy a usable version 1.

## Prerequisites

- Node.js 18+ (for `npm`, Vite, and the server runtime)
- PostgreSQL database (Neon works; update `DATABASE_URL` accordingly)
- Optional: AWS S3 bucket if you want uploads off the server’s disk

Install dependencies once:

```bash
npm install
```

## Required Environment Variables

The server reads these at boot:

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `DATABASE_URL` | ✅ | Postgres connection string. Enables persistent storage and session backing. |
| `SESSION_SECRET` | ✅ | Long random string used to sign session cookies. |
| `INITIAL_ADMIN_USERNAME` | ⚙️ first boot | When paired with the password below, seeds the first admin account if it does not exist yet. Remove after bootstrap. |
| `INITIAL_ADMIN_PASSWORD` | ⚙️ first boot | Plaintext password that will be bcrypt-hashed and stored for the initial admin. |
| `AWS_REGION` | optional | Required together with `S3_BUCKET_NAME` to push uploads to S3. |
| `S3_BUCKET_NAME` | optional | Bucket used for confirmation / approval files. |

### Bootstrap an admin user

1. Set `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` alongside `DATABASE_URL` and `SESSION_SECRET`.
2. Start the server once (`npm run dev` or `npm run start`). On start-up the backend will create the admin if it does not already exist.
3. Remove the `INITIAL_ADMIN_*` variables afterwards so they cannot be abused.

## Database Setup

1. Configure environment variables (above).
2. Push the schema (including the new `payment_records.internal_company_id` column) to your database:

   ```bash
   npm run db:push
   ```

3. (Optional) inspect the generated tables in the `shared/schema.ts` file before going live.

## Running the app

### Development

```bash
npm run dev
```

- API runs off Express with hot reload via `tsx`.
- The React app is served through the same port in development (Vite middleware).

### Production

```bash
npm run build
npm run start
```

- `npm run build` bundles the React client and the Node server.
- `npm run start` expects all environment variables to be set and serves both API and static assets on `$PORT` (defaults to `5000`).

## File Upload Storage

- **Local (default)**: Files are stored under `./uploads`. Persist this folder or mount external storage in production.
- **S3**: Provide `AWS_REGION` and `S3_BUCKET_NAME`; the server will stream uploads directly to S3 and fetch them on demand.

## Feature Notes

- Recording a payment automatically advances the next due date for recurring schedules and marks one-time schedules as completed. The dashboard now reflects paid items accurately.
- Payment records persist the selected internal company, so CSV-imported items show up under the correct business context.
- Users can sign out via the dashboard header. Logging out clears cached data in the client.
- Admin features (user management, destructive actions) require an account with the `Admin` role. Use the bootstrap env vars above for the first admin.

## Next steps after deployment

1. Create admin-only accounts for approvers.
2. Populate reference data (payment accounts, expense types, etc.) via the Settings screen.
3. If you are staying on local uploads, configure backups for the `uploads/` directory.
4. Keep an eye on logs for any `Invalid data` responses during CSV import—these typically indicate missing mappings or company selections.

You now have a functional v1 that can accept users, track schedules, ingest CSV bank files, and keep reports aligned with actual payment history.


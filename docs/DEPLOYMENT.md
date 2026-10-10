# SIU-ERPOS Production Go-Live Runbook

This runbook defines the authoritative, step-by-step deployment and operational procedure for promoting SIU-ERPOS (Next.js 15, Prisma ORM, Better Auth 1.3.32, PostgreSQL) to the Render production environment.

---

## Pre-Requisites & Critical Principles

1. **Strict Tenancy & Role Separation**: Closed registration is enforced. Nobody can self-register. Accounts are created exclusively by administrators through the Access Management module (`/dashboard/access-management`).
2. **Environment Variable Security**: All secrets must be provisioned securely. Never commit credentials to version control.
3. **Database Guardrails**: Migrations require a direct, non-pooled connection URL.

---

## Phase 1: Production Database Backup

Before applying any migrations or configuration changes, create a point-in-time snapshot of the production PostgreSQL database.

### 1.1 Snapshot via Provider or `pg_dump`
```bash
# 1. Create a timestamped SQL dump
pg_dump "postgres://<prod_user>:<prod_password>@<prod_host>/<prod_db>?sslmode=require" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="siu_erpos_prod_prelaunch_$(date +%Y%m%d_%H%M%S).dump"

# 2. Verify dump integrity
ls -lh siu_erpos_prod_prelaunch_*.dump
```

### 1.2 Document Restore Path
In the event of a catastrophic failure, restore the database snapshot using:
```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="postgres://<prod_user>:<prod_password>@<prod_host>/<prod_db>?sslmode=require" \
  siu_erpos_prod_prelaunch_<timestamp>.dump
```

---

## Phase 2: Render Environment Variables

Configure the following environment variables in your Render Dashboard (**Settings > Environment**):

| Variable | Description & Requirement |
|---|---|
| `DATABASE_URL` | **Direct, non-pooled** PostgreSQL connection string (with `?sslmode=require`) |
| `BETTER_AUTH_SECRET` | 32+ character cryptographically random string (`openssl rand -base64 48`). *Note: Changing this revokes all active user sessions.* |
| `BETTER_AUTH_URL` | Canonical production URL (e.g., `https://erpos.sketchitup.in`) |
| `NEXT_PUBLIC_APP_URL` | Canonical public app URL (matching `BETTER_AUTH_URL`) |
| `NODE_ENV` | `production` |
| `DEFAULT_PASSWORD` | Strong default temporary password for provisioned staff (e.g., `InitCompany#2026!`) |
| `DEFAULT_PASSWORD_TTL_DAYS` | `7` (Enforces mandatory password rotation within 7 days) |
| `ALLOW_HARD_DELETE` | `false` (Prevents irreversible deletion of employee records; preserves audit logs) |
| `RESEND_API_KEY` | Production API key from Resend |
| `RESEND_FROM_EMAIL` | Official transactional email (e.g., `noreply@sketchitup.in`) |
| `GOOGLE_CLIENT_ID` | Production Google OAuth Client ID (Optional for verified employees) |
| `GOOGLE_CLIENT_SECRET` | Production Google OAuth Client Secret |
| `GROQ_API_KEY` | Production API key for AI assistant & summarization features |

---

## Phase 3: Database Migrations & Initial Seeding

Execute these commands in sequence against the production database (via Render Shell or CI/CD deployment pipeline):

### 3.1 Apply Pending Schema Migrations
```bash
npx prisma migrate deploy
```
*Check:* Verify that all migrations apply with `All migrations have been successfully applied`.

### 3.2 Seed Role Definitions & Permission Matrix
```bash
npm run db:seed:roles
```
*Check:* Verify console output confirms `13 roles` and `156 role_access entries` seeded idempotently.

### 3.3 Backfill Existing Users into Employee Directory
```bash
# 1. Dry run inspection:
npm run db:backfill:employees

# 2. Apply backfill to database:
npm run db:backfill:employees -- --apply
```
*Check:* Output confirms 0 missing employees and all existing users linked to active employee rows.

### 3.4 Seed Production Owner Account
```bash
ALLOW_PROD_SEED=1 OWNER_PASSWORD="<SuperSecureOwnerPassword123!>" npm run db:seed:owner
```
*Check:*
1. Output prints `Owner account successfully seeded/verified`.
2. Initial default password warning is NOT printed if a custom `OWNER_PASSWORD` was supplied.

---

## Phase 4: Application Deployment & Smoke Tests

Trigger deployment in Render and perform the following verification checklist:

### 4.1 Owner Authentication
1. Navigate to `https://<your-domain>/sign-in`.
2. Sign in with `owner@sketchitup.in` and your specified `OWNER_PASSWORD`.
3. Confirm successful navigation to `/dashboard`.

### 4.2 Access Management & Employee Provisioning
1. Open `/dashboard/access-management` (ShieldCheck icon in sidebar).
2. Verify both **Employees** and **Roles** tabs render without errors.
3. Click **Add Employee** and provision a test HR user (`hr.verify@<domain>`).
4. Note that the employee starts with the default temporary password and `mustChangePassword = true`.

### 4.3 Forced First-Login Password Change
1. Open an incognito browser window and navigate to `/sign-in`.
2. Sign in as `hr.verify@<domain>` with the company default password.
3. Verify that the app blocks dashboard access and forces redirect to `/force-password-change`.
4. Enter a strong, compliant new password. Confirm successful redirect to `/dashboard`.

### 4.4 Closed Registration Verification
1. Navigate to `/sign-up`.
2. Verify that the registration form is not available and the page clearly displays:
   > **Registration Disabled**
   > *Accounts are created by your administrator. Sign in with the credentials you were given.*

### 4.5 API Guard Boundary Verification
1. Run a curl request without session cookies:
   ```bash
   curl -I https://<your-domain>/api/admin/employees
   ```
2. Verify HTTP response is strictly `401 Unauthorized`.

### 4.6 Legacy Account Cleanup
1. In `/dashboard/access-management`, review the employee directory.
2. Locate any pre-existing demonstration or seed accounts (e.g., `demo@siu.in`).
3. Click **Deactivate / Suspend** or terminate them to prevent unauthorized use.

---

## Phase 5: Post-Launch Hardening & Operational Maintenance

1. **Rotate Owner Credentials**: Update the Owner password via `/dashboard/profile` or `/api/me/change-password` to ensure high entropy.
2. **Audit Log Inspection**: Review `/dashboard` security logs to confirm logins, role checks, and password changes were logged with masked IPs.
3. **Content Security Policy (CSP)**:
   - Monitor the browser console and reporting endpoint for any `Content-Security-Policy-Report-Only` violation reports.
   - Once confirmed that no legitimate assets or external services are blocked, promote `Content-Security-Policy-Report-Only` to enforcing `Content-Security-Policy` in `next.config.mjs`.

---

## Remaining Risks & Mitigations

1. **Default Password Sharing Window**:
   - *Risk*: Multiple newly provisioned employees receive the company default password during their initial 7-day onboarding period.
   - *Mitigation*: System enforces immediate forced password reset at first sign-in, hard expiry after 7 days, and rate limits sign-in attempts.
2. **Legacy Route Literals**:
   - *Risk*: A small number of legacy team routes reference `role === 'admin'`.
   - *Mitigation*: The `toLegacyTeamRole` mapping in `lib/permissions.ts` dynamically maps high-level roles (`owner`, `ceo`, `cto`, `hr`, `admin`) to legacy `admin`, maintaining strict backward compatibility without privilege escalation.
3. **Database-Backed Rate Limiting**:
   - *Risk*: Database connection spikes during brute-force attacks.
   - *Mitigation*: Rate limits on `/api/auth/sign-in/email` are capped at 5 attempts per 10-minute window per IP, persisting across server restarts.

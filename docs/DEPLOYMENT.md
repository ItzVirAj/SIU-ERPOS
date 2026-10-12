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
| `ALLOW_HARD_DELETE` | `0` or `1` (Controls irreversible deletion of employee records; defaults to soft delete) |
| `APP_ENCRYPTION_KEY` | 32-byte base64 AES-256-GCM key (`openssl rand -base64 32`). Encrypts BYOK Groq API keys at rest. *Note: Losing this key means re-entering Groq API keys in Settings.* |
| `APP_ENCRYPTION_KEY_PREVIOUS` | (Optional) Previous 32-byte base64 encryption key during key rotation |
| `RESEND_API_KEY` | Production API key from Resend |
| `RESEND_FROM_EMAIL` | Official transactional email (e.g., `noreply@sketchitup.in`) |
| `GOOGLE_CLIENT_ID` | Production Google OAuth Client ID (Optional for verified employees) |
| `GOOGLE_CLIENT_SECRET` | Production Google OAuth Client Secret |
| `GROQ_API_KEY` | Platform fallback API key for AI assistant & summarization features |
| `TRUSTED_PROXY_HOPS` | `1` (Render reverse proxy hop count; integer 1..5). *Verification:* After deploy, sign in and compare the IP shown in your own audit log or session list with your real IP. If it shows an internal/proxy address, raise or lower the value. |
| `ABSOLUTE_SESSION_DAYS` | `7` (Absolute maximum session lifespan in days regardless of activity; default 7). |

### Authentication & Session Lifetimes
- **Session Expiration (`session.expiresIn`)**: 12 hours of inactivity ends the session.
- **Session Update Age (`session.updateAge`)**: 1 hour sliding refresh for active users.
- **Cookie Cache (`cookieCache.maxAge`)**: 5 minutes in-memory cache to minimize database hits.
- **Absolute Session Cap (`ABSOLUTE_SESSION_DAYS`)**: Hard cutoff at 7 days; older sessions are deleted and rejected with 401.
- **Password Recovery Policy**: Password recovery = Owner / CTO / HR reset in Access Management (employees get the company default password and must change it). Public self-service password reset endpoints are disabled.

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

### 3.5 Encrypt Plaintext Groq Keys at Rest
Generate a 32-byte base64 encryption key:
```bash
openssl rand -base64 32
```
Set this value in Render environment as `APP_ENCRYPTION_KEY`. *Note: Losing this key means BYOK Groq API keys will be undecryptable and must be re-entered by team administrators in Settings.*

Run the migration script:
```bash
# 1. Dry run inspection (shows rows requiring encryption, never logs keys):
npm run secrets:encrypt-groq

# 2. Apply encryption in place (idempotent, skips existing v1: encrypted keys):
npm run secrets:encrypt-groq -- --apply
```

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

---

## Phase 5: Production Security Architecture & Guardrails

### 5.1 Database-Backed Rate Limiting (`RateLimit` Model)
To protect authentication and sensitive export endpoints against brute-force attacks across server restarts and multiple application instances, rate limits are persisted in PostgreSQL:
- **Prisma Model**: `RateLimit` (`id`, `key`, `count`, `windowStart`, `expiresAt`, `createdAt`, `updatedAt`).
- **Migration**: Applied automatically via `npx prisma migrate deploy`.
- **Sign-in Rate Limiting**: Max 5 failed attempts per 10 minutes per IP/identifier on `/api/auth/sign-in/email`. The 6th attempt is blocked with HTTP `429 Too Many Requests`.
- **Data Export Rate Limiting**: Max 3 exports per 60 minutes per team on `/api/teams/[teamId]/export`. Exceeding limits returns HTTP `429`.

### 5.2 Reverse Proxy Configuration & IP Extraction (`X-Forwarded-For`)
When deploying behind a reverse proxy or load balancer (e.g., Render, Cloudflare, AWS ALB, Nginx):
- **Client IP Determination**: Handled via `getClientIp(request)` in `lib/audit.ts` and `lib/rate-limit.ts`.
- **Header Parsing**: Reads the leftmost IP from `x-forwarded-for` (the client's true originating address before intermediary proxies). Falls back to `x-real-ip` and `cf-connecting-ip`.
- **Proxy Requirement**: Ensure your reverse proxy is configured to append the true client IP to `X-Forwarded-For` and strips spoofed incoming headers from external clients.

### 5.3 Session Cookie Security & Environment Parity
Better Auth generates session cookies with strict security flags:
- **Cookie Name**:
  - Development (`http://localhost:*`): `siu.session_token`
  - Production (`https://*` with SSL): `__Secure-siu.session_token`
- **Security Attributes**: `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` (in production).
- **Session Lifetimes**: 30 days active sliding window. Sessions are immediately invalidated in PostgreSQL upon role changes, suspension, or manual revocation.

### 5.4 High-Risk Route Protections
1. **Team Deletion (`DELETE /api/teams/[teamId]`)**:
   - Strictly reserved for the `owner` role.
   - Requires explicit body verification: `{ confirmName: "<exact_team_name>" }`. Non-matching names return HTTP 400 without deletion. Non-owners return HTTP 403.
   - Writes an immutable security audit entry upon execution.
2. **Single Workspace Enforcement (`POST /api/teams/create`)**:
   - Returns HTTP 403 if an enterprise workspace already exists.
3. **Audit Log Immutability (`POST /api/teams/[teamId]/audit-logs`)**:
   - Client-side creation is deprecated. All client POST attempts return HTTP `405 Method Not Allowed` with `Allow: GET`. Audit entries are append-only server-side via `writeAudit()`.
4. **Secret Stripping**:
   - API keys and webhooks strip secret tokens on retrieval (only showing masked previews and metadata).

---

## Phase 6: Post-Deploy Verification Checklist & Commands

Run the automated verification suite against the deployed production build or staging environment:

```bash
# 1. Verify strict route guard coverage across all 97 API route files (must be 0 failures)
npm run check:api-guards

# 2. Verify all admin endpoints and handlers exist
npm run check:admin-routes

# 3. Verify roles (13 roles, 156 role_access matrix records seeded)
npm run verify-roles

# 4. Verify employee directory consistency
npm run verify-employees

# 5. Verify authorization boundary rules (assertCanManage, assertCanAssignRole, single owner guard)
npm run verify-authz

# 6. Verify admin API operations and password policy
npm run verify-admin-api

# 7. Verify live route security, IDOR protection, and tenant isolation
npm run verify-route-security

# 8. Verify the full 13-role x 25-route authorization matrix (325 checks + rate limiter)
npm run verify-route-matrix
```

---

## 13-Role Access Model Summary

| Role Key | Name | Level | Legacy Role | Primary Access Capabilities |
|---|---|---|---|---|
| `owner` | Owner | 100 | admin | Full system authority, company deletion, billing, role provisioning |
| `ceo` | Chief Executive Officer | 90 | admin | Full business operations, company settings, reports, employee management |
| `cto` | Chief Technology Officer | 80 | admin | Full engineering, dev settings, automations, employee management |
| `hr` | Human Resources | 70 | admin | Employee management, onboarding, team collaboration, reports |
| `finance_manager` | Finance Manager | 70 | developer | Full finance management, payment approvals, financial reports |
| `admin` | Admin (IT/Office) | 60 | admin | Developer settings, integrations, office management |
| `project_manager` | Project Manager | 60 | developer | Project lifecycle, roadmap, product management, automations |
| `sales_manager` | Sales Manager | 60 | developer | Full CRM management, customer pipelines, sales reporting |
| `team_lead` | Team Lead | 50 | developer | Sprint tasks, team collaboration, issue assignment |
| `developer` | Developer | 40 | developer | Code issues, workflow execution, API integrations |
| `sales_executive` | Sales Executive | 40 | developer | Lead creation, customer outreach, CRM viewing |
| `accountant` | Accountant | 40 | developer | Expense entry, invoice viewing, financial ledger access |
| `viewer` | Viewer | 10 | viewer | Read-only access to work items and shared team channels |

---

## Dependency Policy & Security Overrides

### Dependency Policy
1. **Pre-Deploy Audit**: Always execute `npm run audit:prod` before deploying to staging or production. Zero critical and zero high-severity vulnerabilities are permitted in production dependencies.
2. **Monthly Dependency Maintenance**: Review direct dependencies monthly to upgrade within the same major release line and incorporate security patches.
3. **Regression Verification**: Re-run all verification suites (`npm run check:api-guards`, `npm run check:admin-routes`, `npm run verify-roles`, `npm run verify-employees`, `npm run verify-authz`, `npm run verify-admin-api`, `npm run verify-route-security`, `npm run verify-route-matrix`) after any dependency changes.
4. **No Unsafe Fixes**: Never run `npm audit fix --force`. Transitive dependencies must only be updated through verified, compatible `package.json` overrides.

### Accepted High Findings in Production Dependencies (`audit:prod:high`)
The following 10 high-severity findings are identified by `npm audit --omit=dev --audit-level=high` (exit code 1) and are accepted as non-exploitable build/CLI tooling:

| Package | Severity | Advisory ID / Title | Direct / Transitive | Why it is Build or CLI Tooling Only | Why Not Reachable at Runtime |
|---|---|---|---|---|---|
| `braces` | High | GHSA-vfj7-8cjw-p6xm (stack-exhaustion DoS) | Transitive (via `micromatch` / `chokidar`) | Glob string expansion used exclusively by developer build watcher / bundler. | No file watching occurs on production servers; all assets are pre-compiled static bundles. |
| `chokidar` | High | Transitive via `braces` | Transitive (via `tailwindcss`) | File watching library used by Tailwind compiler to regenerate utility classes during development. | The file watcher is not started in production `next start`; CSS is precompiled. |
| `micromatch` | High | Transitive via `braces` | Transitive (via `tailwindcss` / `fast-glob`) | Glob pattern matcher used during build time. | Not invoked in production server request loops. |
| `fast-glob` | High | Transitive via `micromatch` | Transitive (via `tailwindcss`) | Filesystem glob traversing during compile time. | Precompiled static assets; no dynamic globbing on incoming HTTP requests. |
| `tailwindcss` | High | Transitive via `chokidar` / `micromatch` | Direct / Transitive | CSS utility compiler used during `next build`. | Only static compiled CSS files (`.css`) are served at runtime. |
| `tailwindcss-animate` | High | Transitive via `tailwindcss` | Direct | Keyframe CSS plugin for Tailwind. | Pure CSS animation definitions; no executable code at runtime. |
| `deepmerge-ts` | High | GHSA-ggr8-5vv4-36mx (stack exhaustion) | Transitive (via `@prisma/config`) | Object-merging utility used by Prisma CLI to parse `prisma.config.ts`. | Used only during `prisma generate` / `prisma migrate`. Never invoked by runtime queries. |
| `@prisma/config` | High | Transitive via `deepmerge-ts` | Transitive (via `prisma`) | Configuration parser for the Prisma CLI. Downgrade to 6.12.0 suggested by npm would break Prisma 6.18 features. | CLI tool only; runtime uses `@prisma/client` engine binaries. |
| `prisma` | High | Transitive via `@prisma/config` | Direct | Prisma CLI package. | Not imported in runtime application routes (runtime strictly imports `@prisma/client`). |
| `postcss` | High | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 | Transitive (bundled inside `next@15.5.27`) | CSS post-processing parser bundled internally by Next.js 15.5.27. | Only invoked during `next build` to bundle Tailwind CSS. Never processes untrusted user CSS input at runtime. |


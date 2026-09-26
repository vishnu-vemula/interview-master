# Rehearsly redesign — progress log

Source of truth for visuals: `C:\Users\vemul\Downloads\Rehearsly.html` (a bundled artifact; unpacked template
has two screens: **Landing** and **Login/Sign up**). Behaviour source of truth: existing routes, stores and API calls.

> Re-read this file before each phase. It is the working memory for the redesign.

---

## 0. Coordination notes

- Another Claude session ("Production-ready research and chat application") is concurrently editing **backend** files
  (PayU billing, session evaluation → new `evaluating` / `evaluation_failed` statuses, `phone` on checkout). I messaged it
  that `frontend/src` is being rewritten here. Re-read any backend file immediately before touching it.
- Local services for verification: MongoDB 8.2 run from scratch dbpath (`mongod --dbpath <scratchpad>/mongo-data`),
  `REDIS_ENABLED=false`, and a **local provider stub** (scratchpad `provider-stub.cjs`, port 5055) standing in for
  Groq / OpenAI embeddings / Cloudinary via `GROQ_BASE_URL`, `OPENAI_BASE_URL`, `CLOUDINARY_URL?upload_prefix=`
  env overrides (no code change). PayU cannot be stubbed (URLs hard-coded) → needs real sandbox key/salt.

---

## 1. Design tokens (extracted from the HTML)

### Colour
| Token | Hex | Usage in design |
|---|---|---|
| `paper` | `#F4F5F1` | page background (html/body) |
| `ink` | `#0E1116` | primary text, dark sections, dark buttons |
| `ink-2` | `#171B21` | dark card surface (How it works steps) |
| `ink-line` | `#242A32` | border on dark cards |
| `ink-soft` | `#2A2F36` | body copy on white cards |
| `slate` | `#4A515A` | paragraph copy |
| `muted` | `#5B6470` | secondary labels |
| `muted-2` | `#6B727C` | role strip / fine print |
| `faint` | `#8A9099` | placeholders, disabled |
| `faint-2` | `#9AA0A8` | de-emphasised headline words |
| `on-dark-muted` | `#A9B0B8` | secondary text on ink |
| `on-dark-soft` | `#C9CED4` / `#DDE1E5` | tertiary text on ink |
| `line` | `#DDE0DC` | hairlines, input borders |
| `line-2` | `#E6E9E4` / `#E6E9EC` | card borders |
| `stone` | `#E9EBE7` | secondary surface (bento, tab track) |
| `stone-2` | `#F1F2F0` / `#EEF0EC` | chip / progress track |
| `blue` | `#1B82EC` | primary brand blue |
| `blue-deep` | `#0A63CC` | gradient top |
| `blue-link` | `#0B6FD9` | links / hover |
| `blue-sky` | `#56AEF5`, `#6BB8F6`, `#8CC8F7`, `#9ACDF8` | gradient stops, soft bars |
| `blue-mist` | `#BFE1FB`, `#DCEBFF`, `#DCEFFC`, `#E8F4FD`, `#EEF6FF` | tints, pill bg |
| `navy-tint` | `#1F4C80` | caption on hero bottom |
| `lime` | `#D7F94B` | accent CTA, highlights |
| `lime-hover` | `#E6FF7A` | CTA hover |
| `lime-ink` | `#3A4410` | text on lime |
| `lime-ok` | `#4E7A00` | "convincing" label |
| `coral-bg` | `#FFE3D6` | warning highlight |
| `coral` | `#B8431A` | warning / missing text |
| `coral-bar` | `#F2A27E` | "needs work" bar |

Gradients: hero `linear-gradient(180deg,#0A63CC 0%,#1B82EC 38%,#56AEF5 68%,#BFE1FB 90%,#E8F4FD 100%)` with blurred white
radial "clouds"; auth panel `…#0A63CC 0%,#1B82EC 40%,#6BB8F6 75%,#DCEFFC 100%`; report `180deg,#1B82EC,#8CC8F7`.

### Typography
- **Geist** 300–700 (sans, body + display), **Geist Mono** 400/500 (labels, buttons, eyebrow text). Self-hosted woff2
  (latin + latin-ext) copied from the bundle.
- Display: weight 500, letter-spacing −0.045em (H1 `clamp(44px,6.4vw,92px)`, lh .98), H2 `clamp(34px,4.4vw,60px)`
  −0.04em, card titles 22–30px −0.02/−0.03em.
- Body 15–18px, lh 1.45–1.55. Mono labels 10.5–12.5px, uppercase, letter-spacing .08–.1em.

### Spacing / layout
- Container `max-width:1180px`, side padding 24px. Section rhythm 90–120px vertical. Page frame padding 10px around
  rounded hero. Grids use `repeat(auto-fit,minmax(min(100%,Npx),1fr))` with 10–14px gaps.

### Radii
`999px` pills/buttons · `28px` sections/hero · `24px` bento/pricing cards · `20px` step cards/report card ·
`18px`/`16px` small cards · `14px` inputs, social buttons, inner cards · `12px` rows · `9–10px` logo mark / tiny chips.

### Shadows
- Floating card: `0 30px 60px -30px rgba(8,40,90,.5)` (and 20/40, 24/48, 28/56, 34/70 variants).
- Focus ring: `border-color:#1B82EC; box-shadow:0 0 0 4px rgba(27,130,236,.15)`.
- Glass nav: `rgba(255,255,255,.12)` bg, `1px rgba(255,255,255,.28)` border, `backdrop-filter:blur(18px)`.

### Breakpoints / motion
Fluid (clamp + auto-fit). Tailwind defaults used for layout switches (sm 640 / md 768 / lg 1024 / xl 1280).
Hero card arc scales `max(.45, min(1, (w-20)/1260))`. Hover = colour swaps (lime→`#E6FF7A`, outline→ink fill).
No dark mode in design (light product with ink "dark sections").

---

## 2. Components found in the HTML → `src/components/ui/`
Logo mark (lime tile + ink dot) · glass pill nav · mono nav links · **Button** variants: lime (with ink ↗ circle),
ink, outline (ink border → ink fill), ghost/glass, mono text button · **Eyebrow** (dot + mono label) · **Pill/Badge**
(lime "New", blue-mist score pill, stone chip, coral warning) · **Card** (white/stone/ink/lime/blue-gradient) ·
bento tiles · step cards · feedback report card · progress bars (track `#EEF0EC`) · list rows with hairline dividers ·
job row cards with match pill · pricing cards · **Segmented tabs** (stone track, ink active) · **Input/Label** (14px
radius, 15/16 padding, focus ring) · password field with "Show/Hide" mono chip · divider "or with email" ·
footer. Built extra from the same language: Select, Textarea, Checkbox/Toggle, Modal/Drawer, Table, Tabs,
Skeleton, EmptyState, ErrorState, Toast styling, Pagination, Stat tile, Avatar, Dropdown, Tooltip.

---

## 3. Routes (`src/app.jsx`) → page files

| Route | Guard | Page file |
|---|---|---|
| `/` | public | `pages/landing-page.jsx` |
| `/pricing` | public (checkout needs auth) | `pages/billing/pricing-page.jsx` |
| `/login` | guest | `pages/auth/login-page.jsx` (AuthLayout) |
| `/register` | guest | `pages/auth/register-page.jsx` (AuthLayout) |
| `/admin/login` | admin-guest | `pages/admin/admin-login-page.jsx` |
| `/admin` | admin | `pages/admin/admin-dashboard-page.jsx` |
| `/admin/users` | admin | `pages/admin/admin-users-page.jsx` |
| `/admin/jobs` | admin | `pages/admin/admin-jobs-page.jsx` |
| `/admin/interviews` | admin | `pages/admin/admin-interviews-page.jsx` |
| `/admin/resumes` | admin | `pages/admin/admin-resumes-page.jsx` |
| `/admin/sessions` | admin | `pages/admin/admin-sessions-page.jsx` |
| `/admin/ats` | admin | `pages/admin/admin-ats-page.jsx` (was "Coming soon" placeholder) |
| `/admin/subscription` | `view:settings` | `pages/admin/admin-subscription-page.jsx` |
| `/admin/payments` | `view:payments` | `pages/admin/admin-payments-page.jsx` |
| `/admin/analytics` | `view:analytics` | `pages/admin/admin-analytics-page.jsx` |
| `/admin/settings` | `view:settings` | `pages/admin/admin-settings-page.jsx` |
| `/admin/scraper` | `view:scraper` | `pages/admin/admin-scraper-page.jsx` |
| `/admin/prompts` | `view:prompts` | `pages/admin/admin-prompts-page.jsx` |
| `/admin/logs` | `view:logs` | `pages/admin/admin-logs-page.jsx` |
| `/dashboard` | user | `pages/dashboard/dashboard-page.jsx` |
| `/interviews` | user | `pages/interview/interview-list-page.jsx` |
| `/interviews/new` | user | `pages/interview/new-interview-page.jsx` |
| `/interviews/:id/session` | user | `pages/interview/interview-session-page.jsx` |
| `/sessions/:id/results` | user | `pages/interview/session-result-page.jsx` |
| `/sessions` | user | `pages/session/session-history-page.jsx` |
| `/resumes` | user | `pages/resume/resumes-page.jsx` |
| `/jobs` | user | `pages/jobs.jsx` (+ `components/jobs/*`) |
| `/jobs/recommended` | user | `pages/recommended-jobs.jsx` |
| `/profile` | user | `pages/profile/profile-page.jsx` |
| `/billing/result` | user | `pages/billing/result-page.jsx` |
| `*` | — | was `<Navigate to="/">` → new styled 404 page |

No forgot/reset-password route exists and the API has no reset endpoint (see §7).

---

## 4. API map (frontend call → backend route) and mismatches

User API (`lib/axios.js`, base `VITE_API_URL || '/api'`, Bearer from zustand-persisted `interviewmaster-auth`):

| Frontend | Backend | Notes |
|---|---|---|
| `POST /auth/register` (store) | `auth.routes` register | returns `{user, accessToken, refreshToken}` ✓ |
| `POST /auth/login` (store) | login | ✓ |
| `POST /auth/refresh` (axios interceptor) | refreshToken | returns `{accessToken}` ✓ |
| `GET /auth/me`, `POST /auth/logout` | getMe / logout | defined in services, logout never called (server no-op) |
| `GET/PUT /users/profile`, `PUT /users/change-password`, `GET /users/dashboard` | user.routes | ✓ (`data.data` for dashboard) |
| `POST /resumes/upload` (field `resume`, PDF ≤5 MB) | resume.routes | ✓ — UI copy said "PDF, DOC, DOCX" but API is **PDF only** |
| `GET /resumes`, `GET /resumes/:id/download`, `DELETE /resumes/:id`, `PATCH /resumes/:id/default`, `POST /resumes/:id/parse` | ✓ | |
| `POST /interviews`, `POST /interviews/:id/generate`, `GET /interviews`, `GET /interviews/:id`, `DELETE /interviews/:id` | interview.routes | generate returns **402** when allowance exhausted |
| `POST /sessions/start`, `POST /sessions/:id/answer`, `POST /sessions/:id/complete`, `GET /sessions`, `GET /sessions/:id` | session.routes | complete may now return **503** (answers saved, retry) / 409 |
| `GET /jobs` (`keyword, location, salaryMin, contractType, page`) | jobs `getActiveJobsList` | ✓ (PG → Mongo fallback) |
| `GET /jobs/:id` | Adzuna live detail, **numeric id only** | ⚠ Mongo jobs have ObjectId ids → 422 |
| `GET /jobs/recommended`, `POST /jobs/generate-questions` | ✓ | |
| `GET /jobs/search`, `GET /jobs/categories` | Adzuna live | unused by pages |
| `GET /billing/plans`, `GET /billing/me`, `POST /billing/checkout` (+`Idempotency-Key`, `phone`), `GET /billing/orders/:txnid` | billing.routes | ✓ (other session added `phone` server-side) |
| socket.io `live_answer` → `ai_chunk/ai_complete/ai_error` | `socket.ts` (auth: access token) | ⚠ URL derived from `VITE_API_URL`; no Vite `/socket.io` proxy |

Admin API (`lib/admin-axios.js`, token in `ai-admin-auth`): every function in `services/admin.service.js` maps 1:1 to
`routes/admin.routes.ts` (stats, users(+bulk), jobs(+stats,bulk), interviews, sessions, resumes, scraper
status/settings/run/pause/resume/logs, templates CRUD, prompts(+restore), plans(+stats) CRUD, payments
transactions/stats/refund/webhooks, settings get/patch, analytics/stats, logs) — plus
`POST /admin/payments/transactions/:id/reconcile` called inline. Response envelopes are `r.data.data` except
noted (`users/:id` → `r.data.user`, settings → `r.data.settings`, analytics → `r.data`).

### Mismatches / bugs found
1. **Token refresh desync** — `lib/axios.js` writes the refreshed token straight into localStorage and fires
   `auth:logout` on failure, but nothing listens; the zustand store keeps the stale token (and its next persist
   overwrites the fresh one) and stays "logged in" after refresh failure. → fix in frontend (store listens to events).
2. **Job detail** — drawer calls `GET /jobs/:id` for every job; route only accepts numeric Adzuna ids → 422 for
   Mongo/admin-created jobs. → frontend only fetches detail for numeric ids, otherwise uses list data.
3. **Socket URL** — falls back to `http://localhost:5000` only when `VITE_API_URL` unset; relative `/api` base would
   point socket at Vite (no proxy). → add `/socket.io` ws proxy in `vite.config.js`, derive URL consistently.
4. Interview list "View" on non-generated interviews → session page → `sessions/start` 400 → bounced back.
   → session page offers "Generate questions" retry instead.
5. Resumed sessions lose saved answers in the UI (not restored from `session.answers`). → restore + jump to first
   unanswered (design promise: "Resume without losing a word").
6. Admin notification bell used hard-coded demo notifications. → built from real `GET /admin/stats` activities.
7. `/admin/ats` was a "Coming soon" placeholder. → real resume-parsing (ATS) pipeline view from `GET /admin/resumes`.
8. 404 silently redirected to `/`. → styled NotFound page.
9. API build: `session.controller.ts` had a TS error (`calculateOverallScore`) — being rewritten by the other session.

---

## 5. Frontend stack (as-is, kept)
Vite 5 · React 18 · React Router 6 (BrowserRouter) · Tailwind CSS 3 (+ PostCSS/autoprefixer) · Zustand 4
(persisted user auth) · React Context (admin auth, app UI) · TanStack Query 5 (admin + jobs) · axios ·
react-hook-form · framer-motion · lucide-react · recharts · react-hot-toast · react-dropzone · socket.io-client.
No new UI framework added.

---

## 6. Checklist

### Phase 1 — design system
- [x] Tokens in Tailwind theme + CSS variables, Geist/Geist Mono self-hosted
- [x] `components/ui/*` primitives with hover/focus/disabled/loading/error/empty states
- [x] Layouts: PublicLayout/AuthLayout, AppLayout (sidebar, mobile drawer), AdminLayout

### Phase 2 — pages (checked only after viewing in the running app)
- [x] Landing `/`
- [x] Login `/login`
- [x] Sign up `/register`
- [x] Pricing `/pricing`
- [x] Billing result `/billing/result`
- [x] Dashboard `/dashboard`
- [x] Interviews list `/interviews`
- [x] New interview `/interviews/new`
- [x] Interview session `/interviews/:id/session`
- [x] Session results `/sessions/:id/results`
- [x] Session history `/sessions`
- [x] Resumes `/resumes`
- [x] Jobs `/jobs`
- [x] Recommended jobs `/jobs/recommended`
- [x] Profile `/profile`
- [x] 404 + error boundary
- [x] Admin login `/admin/login`
- [x] Admin dashboard `/admin`
- [x] Admin users
- [x] Admin jobs
- [x] Admin interviews
- [x] Admin resumes
- [x] Admin sessions
- [x] Admin ATS
- [x] Admin subscription/plans
- [x] Admin payments
- [x] Admin analytics
- [x] Admin settings
- [x] Admin scraper
- [x] Admin prompts
- [x] Admin logs

### Phase 3 — E2E flows (browser)
- [x] 1. Landing loads, no console errors, nav links + CTAs work (hero full-bleed)
- [x] 2. Sign up → dashboard
- [x] 3. Log out → log in → refresh persists → protected routes redirect when logged out (+ forgot/reset password, Google/LinkedIn OAuth)
- [x] 4. Resume upload → list → view/delete
- [x] 5. Interview start → live session (socket, Q/A) → finish → results
- [x] 6. Billing: plans → checkout (test mode) → subscription/usage display — up to PayU hand-off (see §9)
- [x] 7. Admin login → every admin page loads real data → admin routes block normal users
- [x] 8. 404 page + error boundary styled

### Build gates
- [x] `frontend: npm run build` clean (chunk-size advisory only)
- [x] `api: npm run build` clean

---

## 7. Decisions / deviations from the HTML
- (Superseded) Google / LinkedIn buttons and "Forgot?" are now rendered exactly as designed and are functional:
  password reset + Google/LinkedIn OAuth were added (JWT mode); in Firebase mode Google uses Firebase. A provider
  without credentials renders disabled with a tooltip.
- Landing hero is full-bleed (edge to edge, full viewport height) per the user's follow-up request; the rest of the
  page keeps the design's 10px frame and rounded sections.
- Landing pricing: Free card uses the real free allowance (2 generations / month). The paid card renders real
  published plans from `GET /billing/plans` (INR one-time passes) instead of the mock "$12 / month".
- Footer links point at real destinations (sections / routes) instead of `#`.
- Admin dark-mode toggle removed (half-implemented; design is a light product with ink sections).

## 8. Log
- Phase 0 complete: design unpacked & read in full; inventory written.
- Phase 1 complete: tokens, fonts, ui primitives, 3 layouts. Phase 2: all candidate pages (me) + 14 admin pages
  (4 parallel agents, same brief) ported; screenshots at 1440/375, zero console errors, no horizontal scroll.
- QA harness (scratchpad/qa): puppeteer-core + local Chrome — shot.cjs (screens + console/HTTP errors),
  e2e-signup.cjs, e2e-flows.cjs (flows 3–5), e2e-auth.cjs (full auth). Vite runs as a background process
  (the app's preview pane was closed by the user).
- User follow-up request (mid-run): hero full-bleed; brand "Rehearsly" everywhere; exact auth UI incl. social +
  Forgot; complete auth end to end → done: /forgot-password, /reset-password, /auth/callback; Google + LinkedIn
  OAuth (server flow, one-time code exchange); dev emails go to the API log unless RESEND_API_KEY/EMAIL_FROM set.
- A concurrent editor (not visible to this session) is changing api/ AND frontend (Firebase auth mode behind
  VITE_AUTH_PROVIDER/AUTH_PROVIDER=firebase, react-router 7, vite 8, account deletion, socket follow-up rules).
  Default JWT mode was kept working; my UI was adapted to its new socket contract (sessionId + one follow-up
  per saved answer).
- Backend fixes by me: ai.service/evaluation.ts (stored prompt without the needed placeholders broke every
  session completion → fall back to built-in prompt); new account-recovery controller/routes/model/email
  service; "InterviewMaster" → "Rehearsly" product strings (settings default, PayU productinfo).

---

## 9. Summary (final)

### What changed
- **Design system**: Rehearsly tokens (colours, radii, shadows, type scale) in `tailwind.config.js` + CSS variables and
  component classes in `src/index.css`; self-hosted Geist / Geist Mono; primitives in `src/components/ui/`
  (Button, Field/Input/Select/Textarea/PasswordInput/Switch/Checkbox, Pill, Card, PageHeader, StatTile, ProgressBar,
  Avatar, Skeleton/Empty/Error/Loading states, Alert, Modal, Drawer, ConfirmProvider/useConfirm, Dropdown, Segmented,
  Pagination, TableShell, chart theme).
- **Layouts**: split auth screen (design), candidate app shell (framed sidebar + mobile drawer, live allowance card),
  admin shell (ink rail, collapsible, permission-filtered, breadcrumb, real-data notifications, account menu),
  public chrome for pricing/404.
- **Every route restyled** (candidate, public, all 15 admin pages); every data view has loading/empty/error states;
  forms validate client-side and show server errors inline; `window.confirm` replaced by the design dialog.
- **Behaviour fixes (frontend)**: token-refresh/logout sync between axios and the stores (user + admin); `?next=`
  return-after-login; socket.io via Vite proxy / `SOCKET_URL`; job details only fetched for Adzuna ids; interview
  wizard can’t auto-submit on the step change; resume sessions restore saved answers and jump to the first open
  question; generation retry + 402 allowance handling; admin ATS placeholder replaced with a real parsing
  pipeline view; notification bell uses real activity; styled 404 + error boundary.
- **Auth (complete)**: sign up, log in, log out, refresh persistence, guards, `/forgot-password` → emailed single-use
  link → `/reset-password` (signs in), Google + LinkedIn OAuth (`/api/auth/oauth/:provider/start|callback`, one-time
  code exchanged at `/auth/callback`), admin console login.

### Backend fixes made by this session
1. `api/src/services/ai.service/evaluation.ts` — scoring used stored prompts from `ats_scorer` / `feedback_report`,
   whose seeded defaults lack `${answerText}` / `${summary}`; once the Prompt editor seeded them every session
   completion failed (503). Now a stored template is used only if it contains the placeholders.
2. New: `controllers/account-recovery.controller.ts`, `models/auth-token.model.ts`, `services/email.service.ts`,
   routes in `routes/auth.routes.ts` (providers, forgot/reset password, OAuth start/callback/exchange).
3. Product name "InterviewMaster" → "Rehearsly" in settings defaults and the PayU `productinfo`.

### Known backend issues found (not fixed — owned by the concurrent backend work)
Unescaped `$regex` search in admin jobs/logs/templates (`(` → 500); admin `updateUser` silently drops
`credits`/`isPremium`; `admin-scraper.controller` calls `exports.initScraperScheduler()` (TypeError under tsx) and never
starts the scheduler on boot; settings save turns temperature 0 → 0.5 and settings are never read elsewhere;
admin list endpoints lack a limit cap; plan delete only archives and blocks the name; analytics retention is
hard-coded; admin-created jobs get `source: "Adzuna"`.

### Needs real secrets from you (everything else was verified locally)
- **PayU sandbox** `PAYU_MERCHANT_KEY` / `PAYU_MERCHANT_SALT` (+ a public HTTPS `API_PUBLIC_URL` for callbacks) to
  complete a real test payment and see the pass/subscription granted. Verified locally up to the signed hand-off.
- **Groq** `GROQ_API_KEY`, **OpenAI** `OPENAI_API_KEY` (embeddings), **Cloudinary** credentials. Local verification used
  a scratchpad stub via `GROQ_BASE_URL` / `OPENAI_BASE_URL` / `CLOUDINARY_URL?upload_prefix=` — delete those three
  overrides from `api/.env` when you add real keys.
- **Google / LinkedIn OAuth** client id + secret (redirect URI `${API_PUBLIC_URL}/api/auth/oauth/<provider>/callback`);
  **Resend** `RESEND_API_KEY` + `EMAIL_FROM` to email reset links (without them dev servers log the link).
- Optional: Adzuna keys (job sync), Firebase web/admin config if you switch `AUTH_PROVIDER=firebase`.

### How to run
```bash
# 1. MongoDB running locally (or MONGO_URI to Atlas); Redis optional in dev (REDIS_ENABLED=false)
cd api && cp .env.example .env   # fill in values; 32+ char JWT secrets
npm install && npm run seed:admin && npm run dev      # API on :5000
cd ../frontend && cp .env.example .env && npm install && npm run dev   # UI on :5173
```
Test accounts for local verification live in `api/.env` (`ADMIN_BOOTSTRAP_*`, `E2E_USER_*`).

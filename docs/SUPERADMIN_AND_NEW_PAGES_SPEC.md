# KaySetu SaaS — SuperAdmin Dashboard, Setup Wizard & New Pages Specification

> Status: DRAFT v1 for review — 2026-07-15
> Companion to `SAAS_PACKAGE_BLUEPRINT.md`. That doc says WHAT we sell; this doc lists EVERY screen we must build new, page by page, with its functionality — so nothing is discovered mid-development.
> Build rules that apply to every page here: existing KaySetu UI kit + per-tenant Appearance; every list = search + filters + sort + pagination + export; details open in side drawers; every action audited; every interactive element gets `data-testid` (`{feature}-{element}-{type}`).

---

# PART A — SUPERADMIN DASHBOARD (control plane — build 100% new)

Runs on the main domain (e.g. `admin.kaysetu.com` or `/ops` on the marketing domain). Separate login from tenant portal. Internal staff only — never sold.

## SA-1 Login & security
- Email + password + **mandatory 2FA (TOTP)** for super-admins; session timeout; IP allowlist (optional setting).
- Admin types: **Super Admin** (all), **Growth** (leads/notifications/packages view), **Support** (tenants view + tickets + impersonation), **Account Manager** (assigned tenants). Same dynamic-role engine as tenant side, separate registry.

## SA-2 Command Center (home)
- **Live counters:** total enquiries, new this week, demo requests, active trials, trial→paid conversion %, pipeline value, avg first-response time, open tickets.
- **Acquisition funnel:** visits → enquiries → demos → trials → won (clickable stages filter the Leads page).
- **Charts:** interest by module, industry split, traffic sources, region map.
- **Account health strip:** MRR/ARR, renewals due ≤30 days, tenant status split (active/trial/suspended/churned).
- **Live activity feed:** latest signups, purchases, upgrades, cancellations, failed provisions, high-priority tickets.
- **Customizable quick-action bar** — per-admin buttons (reuse tenant Quick Links engine).

## SA-3 Leads
- Table: name, company, phone/email, source, interested modules, status chip (New · Contacted · Scheduled · Demo · Trial · Won · Lost), owner, age.
- **One-click status change** from the list. Assign owner. Bulk actions.
- Detail drawer: contact info, requirement notes, **full lifecycle timeline** (every call/mail/status change — who, when, outcome), next follow-up date w/ reminder, files.
- Actions: schedule demo, start trial (→ provisioning with trial entitlements), convert → Won links to created tenant.
- Auto-capture: marketing-site "Request demo" and abandoned checkouts land here.

## SA-4 Tenants (paying customers) — the core screen
- Table: company, org code, contact, region, industry preset, package + add-ons, user count (used/paid), MRR, renewal countdown, status (trial/active/past-due/suspended/churned), provisioning health dot.
- **One-click activate / suspend** (suspend = tenant users can't sign in; data untouched).
- Detail drawer, tabs:
  - **Overview:** business details, signup source, landing-page selections, org code (regenerate), subdomain.
  - **Subscription:** current package, add-ons, seats, price breakdown, discounts applied, billing cycle, next invoice; actions: change package, add modules/seats (prorated), extend trial, record manual/offline payment.
  - **Entitlements:** module toggles as actually enforced (edit → syncs to tenant snapshot immediately) — this is the manual override lever.
  - **Usage:** last-login, active users today, API volume, storage, DB size.
  - **Provisioning:** DB status, migration version, re-run migrations button, error log.
  - **Actions:** send renewal reminder, push notification, **Login-as-support** (impersonate tenant admin — always audited + banner shown), export tenant data, **delete tenant** (double-confirm + grace period), delete ex-employee location history (compliance request per mobile PDF Part 5).

## SA-5 Provisioning Monitor *(new page — required by DB-per-tenant)*
- Queue/list of provisioning jobs: tenant, step (create DB → migrate → apply industry preset → create admin → ready), duration, status.
- Failed jobs: error detail + **Retry** button. Alerts to super-admin on failure (a paid customer is waiting).
- Also handles: module-added migrations, plan-change entitlement syncs, tenant deletion jobs.

## SA-6 Packages & Pricing
- **Module registry** (read-mostly): the technical units (TRACK, FIELD, …) with descriptions — source of truth for what can be composed.
- **Package composer:** pick modules → name, tagline, feature bullets (shown on marketing page), role templates activated, mobile-app level; pricing = flat base + free-up-to-N users + per-user-above-N; monthly/annual prices; bundle discount %; live combined-price preview; publish/unpublish toggle; sort order on pricing page.
- Editing is **live** — marketing page and in-portal module store reflect immediately. Price changes affect new purchases/renewals only (grandfathering rule stated on screen).
- Add-ons managed the same way, flagged `addon=true` (+ which packages they attach to).

## SA-7 Discount Master
- Rules: scope (single package / package combo / specific feature / user volume / overall bill), type (% or flat), value, condition (min users, min term, coupon code, date window, first-N-customers), stackable yes/no, on/off toggle.
- Coupon codes: code, usage limit, per-customer limit, expiry; usage counter.
- Preview calculator: pick a package+users → see final price with rules applied.

## SA-8 Subscriptions & Billing
- All subscriptions: tenant, package, seats, cycle, amount, gateway (Razorpay assumed), status (trialing/active/past-due/cancelled), next charge date.
- **Gateway events log:** webhooks received (payment success/fail, mandate events), reconciliation state; retry/reprocess.
- Our invoices **to tenants**: auto-generated w/ GST, PDF, resend; credit notes/refunds (recorded + gateway refund trigger).
- Dunning: past-due flow config (grace days → reminder schedule → auto-suspend).

## SA-9 Support Queries
- Tickets: subject, tenant, priority, status (open/pending/resolved), assignee, SLA timer, source (in-portal help widget / email).
- Detail: threaded conversation, internal notes, link to tenant drawer, canned replies.
- SLA stats block: avg first response, avg resolution, breaches.

## SA-10 Requests
- Feature asks / callback requests / pricing enquiries / integration requests — each with **demand count** (how many tenants asked), status (considering/planned/shipped/declined), linked tenants.
- Feeds the roadmap; "shipped" can trigger a broadcast to requesters.

## SA-11 Notifications & Broadcast
- Composer: audience (all tenants / by package / by status / single tenant / their agents too) → title → message → channels (email / in-app / SMS / push) → schedule or send now.
- **Automatic reminders** (on/off + timing each): trial ending, renewal due, payment failed, agent-offline digest to tenant admins, storage nearing cap.
- History: each blast with reach, delivered, open rate.

## SA-12 Platform Health *(v1 minimal, grows later)*
- API: request rate, p95 latency, error rate (last 24h).
- **Postgres: connection-pool utilization** (the user's #1 fear — visible here), per-tenant DB sizes top-20, slow queries count.
- Workers/queues: Celery queue depth, failed jobs. Storage totals. Uptime checks.

## SA-13 Admin Team, Audit & Settings
- Admin users CRUD + admin-role assignment (SA-1 types).
- **Audit log:** every admin action (who/what/when/old→new), filter by admin/module/tenant/date. Impersonation sessions highlighted.
- Platform settings: payment gateway keys, SMS/DLT templates, SMTP, push (FCM) keys, domain/subdomain config, trial length default, maintenance-mode + announcement banner (shows in all tenant portals), legal doc versions (ToS/Privacy) with re-accept flag.

---

# PART B — MARKETING SITE + ENROLLMENT (main domain — build new)

## MK-1 Marketing pages
- Home (product story, module highlights), Pricing (rendered LIVE from SA-6 packages: monthly/annual toggle, per-module cards, bundle savings, "free up to N users" badges), per-product pages (Tracking / Sales / Books), Contact / Request demo (→ SA-3 leads), Privacy/ToS.

## MK-2 Sign-up & checkout (self-serve)
1. **Account:** business name, your name, email + phone (OTP verify), password.
2. **Business profile:** industry (→ preset), company size, region/state (GST purposes).
3. **Pick package:** package cards + add-ons + seat slider → live price with discounts/coupon box.
4. **Pay:** Razorpay (UPI/card/netbanking); annual/monthly; GST invoice details optional here.
5. **Provisioning screen:** live progress ("Creating your workspace…"), typically seconds; on completion → **org code shown + emailed** → button into the portal (auto-signed-in) → Setup Wizard.
- Trial path: same flow, skip Pay (card optional), trial entitlements + countdown.
- Abandoned at step 3/4 → lead in SA-3.

---

# PART C — TENANT SETUP WIZARD (first login — build new)

Full-screen guided flow; every step skippable, resumable, re-runnable later from Settings → Setup. Progress checklist persists on the dashboard until 100%.

| Step | Screen | Functionality |
|---|---|---|
| W1 | Welcome | org code recap, what was purchased, "~5 minutes" promise |
| W2 | Company profile | legal name, logo upload, address, GSTIN(s), financial year, phone/email |
| W3 | Industry & terminology | industry preset picker (Manufacturing / Distribution & FMCG / Services–Insurance / Generic) → preview of label changes (Products→Policies etc.) + which catalog fields will show; editable dictionary |
| W4 | Appearance | theme scheme picker (existing premade schemes), logo on sidebar preview, live preview pane |
| W5 | Working setup | working hours, week-offs, holiday calendar (preset by state, editable), numbering series (order/invoice prefixes) |
| W6 | Team | invite users by email/phone → assign role templates (only roles from bought modules appear); resend/cancel invites |
| W7 | Catalog | quick-add items (name, price, tax, kind product/service) or **Excel import** (template download → upload → column map → validation report) |
| W8 | Parties | quick-add customers/suppliers or Excel import (same pattern) |
| W9 | Module mini-setups | **only for bought modules**: INV → create warehouses; TRACK → tracking hours + geofence radius + auto punch-out; FIELD → areas/beats names; BOOKS → CoA preset (standard Indian GST set) + opening balances option; PURCH → approval limits |
| W10 | Done | confetti, checklist recap, deep-links to first actions ("add your first order"), mobile-app download links + org code QR for agents |

---

# PART D — NEW TENANT-PORTAL PAGES (web)

Pages that exist in no form today. (Refactor-only screens — orders, customers, warehouse, production, purchase — are NOT listed; they follow the blueprint's decoupling rules.)

### Platform / Foundation
| Page | Functionality |
|---|---|
| **D-1 Module Store** | in-portal upsell: cards for unowned modules/add-ons w/ pricing, buy → prorated payment → entitlement sync + role templates appear; owned modules show manage-seats |
| **D-2 Appearance settings** | same as W4, per-tenant persistent |
| **D-3 Terminology settings** | the W3 dictionary, editable anytime |
| **D-4 Setup checklist** | re-enter any wizard step |
| **D-5 Custom Form Builder** | drag-drop fields (text, number, dropdown, checkbox, date, photo, signature, GPS), required flags, publish to roles/teams/agents, versioning; submissions table per form w/ export |
| **D-6 Audit log (tenant)** | who/what/when/old→new, filter by user/module/date |
| **D-7 Subscription & billing (tenant admin)** | current plan, seats, invoices from KaySetu (PDF), payment method, upgrade → D-1 |

### Tracking (MOD-TRACK)
| Page | Functionality |
|---|---|
| **D-8 Live map** | full-screen, dot per on-duty agent color-coded moving/idle/offline, left agent list w/ last-seen, click → mini card → agent detail, filters team/region/status, auto-refresh |
| **D-9 Agent detail + Route replay** | header (photo, team, today's attendance), map with **time slider** playback of full day, date picker for past days, tabs: attendance history · visits · flags (fake-GPS/offline) |
| **D-10 Tracking health** | rows: agents with problems — offline now, GPS off, background permission missing, battery optimisation on, fake-GPS flagged; per-row **Notify agent** (fix-it push referencing mobile Diagnostics); summary counters |
| **D-11 Tracking settings** | interval profile, geofence radius, auto punch-out time, offline-alert threshold, tracking window ("only 9am–7pm"), duty-hours-only enforcement (always on, informational) |
| **D-12 Attendance report (grid)** | rows=agents × cols=dates, cells in/out+hours, markers late/half-day/absent/leave, filters, export |

### Field Sales (MOD-FIELD)
| Page | Functionality |
|---|---|
| **D-13 Beat Plan Builder** | calendar per agent; assign customers to days; drag to reorder stops; auto-suggest shortest route; copy week; bulk assign; publishes to mobile |
| **D-14 Visits board** | table: agent, customer, planned vs actual check-in/out, outcome, duration, GPS-verified ✓/✗; filters planned/done/missed; drawer: report, photos, form answers, next action |
| **D-15 Messages / broadcast** | message one agent/team/all; read receipts; history (uses Foundation notifications) |
| **D-16 Targets** | set per agent/region/item/month; live progress bars; leaderboard |

### Attendance & Leave (MOD-ATT)
| Page | Functionality |
|---|---|
| **D-17 Leave management** | pending queue w/ one-click approve/reject, balances per user, leave types & accrual rules, team leave calendar, holiday list |

### Orders & Dispatch (MOD-ORDERS)
| Page | Functionality |
|---|---|
| **D-18 Pick lists** | generate from confirmed orders, shelf/bin info if INV present, assign picker, mark picked → ready to dispatch |
| **D-19 Delivery notes / challans** | create from order, transporter/vehicle/driver, print/PDF (rebuild — old one deleted) |

### Books (MOD-BOOKS) — the big new build
| Page | Functionality |
|---|---|
| **D-20 GST hub — e-invoicing** | generate IRN + QR for B2B invoices (IRP integration), status per invoice, cancel IRN, error queue |
| **D-21 GST hub — e-way bills** | generate from invoice >₹50k, vehicle updates, cancel, expiry alerts |
| **D-22 GST hub — returns** | GSTR-1 / 3B / 9 ready data views + export (JSON/Excel), period lock, **approval workflow before filing** |
| **D-23 GSTR-2B reconciliation** | import 2B, auto-match vendor bills, mismatch queue (accept/flag), ITC summary |
| **D-24 TDS / TCS** | auto-deduct by section on bills, certificates, return data |
| **D-25 Banking & reconciliation** | bank/cash accounts w/ running balance, statement import (CSV/Excel), match lines to invoices/bills/expenses, auto-categorisation rules, unmatched queue |
| **D-26 Recurring invoices + reminders** | schedule templates, auto-generate, payment reminder schedules per customer |
| **D-27 Report builder** | pick base dataset → columns/filters/grouping → save → export PDF/Excel/CSV → schedule email |
| **D-28 Fixed assets** *(later phase — design slot only)* | register, depreciation schedule, disposal |
| **D-29 Tally import** | mapped import of masters/ledgers from Tally export files |

---

# PART E — NEW MOBILE SCREENS (Flutter app)

| Screen | Functionality |
|---|---|
| **E-1 Permission Setup Wizard** | 5 guided steps (explain → then system prompt): location → background "all the time" → physical activity → battery/autostart with **brand-detected** (Xiaomi/Oppo/Vivo/Realme/Samsung) instructions + settings deep-link → notifications; just-in-time camera/media/phone later; denial screens w/ Fix-it; re-check every launch |
| **E-2 Diagnostics / self-check** | one tap checks: GPS on, precise location, background permission, battery optimisation, autostart, notifications, network, storage, mock-location apps → green/red list, per-item **Fix it** deep-link |
| **E-3 Sync Centre** | pending-upload count by type, failed items w/ reason + retry, last successful sync, **Sync now**; never delete until server-ack (UI over existing outbox) |
| **E-4 Forms runner** | fill published forms (all field types incl. photo/signature/GPS), offline save, drafts |
| **E-5 Leave** | apply (type/dates/reason), balance, my requests + status |
| **E-6 Collect payment receipt** | after recording collection: shareable receipt (PDF/image), works offline, numbered per series |
| **E-7 Messages inbox** | manager messages/broadcasts, read receipts, task alerts |
| **E-8 My Day home rework** | big punch button, today-at-a-glance (hours, visits done/planned, orders), **pending-sync badge**, quick buttons; auto punch-out warning banner |
| **E-9 Org-code login** | company code (optional if unique email), phone/email + password, OTP option — matches subdomain sign-in |

Existing mobile features (adaptive tracking, offline queue, orders, expenses, visits) are refactor/rebrand, not new — they must adopt module gating (screens appear per company entitlements).

---

# PART F — BUILD SEQUENCE FOR EVERYTHING ABOVE

1. **Control plane skeleton** — SA-1 login/roles, SA-4 tenants, SA-5 provisioning, SA-6 packages (minimum to onboard a tenant end-to-end)
2. **MK-2 checkout + Part C wizard** — completes the self-serve loop (can start with test gateway)
3. **SA-8 billing + SA-11 notifications + SA-2 command center** (needs data flowing to be meaningful)
4. Tenant-portal new pages in module build order: Foundation (D-1…D-7) → Tracking (D-8…D-12) + mobile E-1/E-2/E-3/E-8/E-9 → Field (D-13…D-16) + E-4/E-7 → ATT D-17 + E-5 → Orders D-18/D-19 → Books D-20…D-29
5. SA-3 leads, SA-9/10 support/requests, SA-12 health — parallel, lower risk

Open items to confirm with user: payment gateway = Razorpay? trial length (14 days?); does SuperAdmin need SA-3 Leads at launch or after (manual sales works initially)?

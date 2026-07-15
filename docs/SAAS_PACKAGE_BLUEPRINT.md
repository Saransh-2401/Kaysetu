# Salexa SaaS — Package & Module Blueprint

> Status: DRAFT v1 for discussion — 2026-07-15
> Sources: `WEB_APPLICATION_Documentation.pdf`, `MOBILE_APPLICATION_Documentation.pdf`, Old Project code audit (`Old Project/backend/apps/*`, `Old Project/frontend/app/*`).
> This document defines WHAT we sell and how modules stay independent. Architecture (tenancy, DB-per-client, pooling, API scale) is the next document.

---

## 1. Why the Old Project cannot be sold in parts (audit result)

Cross-app import map of the old backend (17 Django apps):

```
sales      → analytics authentication core crm distributor_inventory field_sales notifications production warehouse
analytics  → core crm distributor_inventory field_sales office_attendance production purchase sales warehouse
core       → admin_module authentication crm field_sales sales        ← platform core imports business apps (!)
crm        → core distributor_inventory field_sales sales warehouse
warehouse  ↔ production ↔ distributor_inventory                        ← circular
field_sales→ admin_module core crm distributor_inventory notifications sales
```

Consequences: no module runs alone, the product catalog lives inside `warehouse` (6 apps FK it), every workflow assumes manufacturer → distributor → agent, and a fresh install is unusable without seed scripts. The rewrite keeps the proven business logic but re-homes every entity and severs every cross-module import.

---

## 2. The two planes

| Plane | Domain | Database | Who uses it |
|---|---|---|---|
| **Control plane** (SuperAdmin / Ops Console) | main domain — marketing site + enrollment + checkout + SuperAdmin dashboard | one central DB | visitors, Salexa staff |
| **Tenant plane** (the product) | subdomain sign-in (org code per business) | **one DB per client** | client admins + their users + their field agents |

Control plane owns: tenant registry, org codes, subscriptions/entitlements, packages & pricing, discounts, leads/demo requests, support tickets, broadcast notifications, tenant provisioning (creates the client DB + applies migrations automatically on purchase — this replaces seed scripts).

Tenant plane owns: everything the client does day-to-day. It reads its entitlements ("which modules are on") from a signed snapshot synced from the control plane, so tenant APIs never call the control plane on the hot path.

---

## 3. Foundation Core (included with every purchase — not sold separately)

The Foundation is the only code every module may depend on. **Modules never import each other — only Foundation.**

| Foundation service | Contents | Old Project source |
|---|---|---|
| Organization & settings | company profile, logo, GST numbers, financial year, working hours/holidays, numbering series, enabled modules | `core`, `company/` |
| Identity & access | users, **dynamic roles** (system templates + custom), permission matrix (menu/write/button), org-code login, single-session | `authentication`, `permissions/` |
| **Catalog (generic)** | sellable items = **product OR service** (`item_kind` flag). Stock/HSN/warehouse fields are optional capabilities, not columns every industry must fill. Categories, units, price, tax link | extracted from `warehouse` (the #1 decoupling job) |
| **Parties (generic)** | customer / supplier / generic party with GSTIN, addresses, credit terms. Modules attach their own facets (e.g. Field Sales adds beat/geo data; Books adds ledger link) | `crm` customers, `purchase` suppliers |
| Taxes | GST rates, HSN/SAC, TDS sections | `masters`, `taxes/` |
| Notifications | event catalog, `notify_event()`, channels (push/in-app/SMS/email), role defaults, user prefs | `notifications` |
| Audit log | who/what/when/old→new on every change | partial (`LoginActivity`, scattered) — generalize |
| Appearance | per-tenant theme: premade color schemes + logo + branding, admin-selectable | `frontend-theming` work (today GLOBAL scope → becomes per-tenant) |
| App shell | sidebar (module+role gated), top bar (global search, date range, bell, profile), quick links, exports, side-drawer detail pattern | `frontend/components` |
| Custom forms engine | form builder + submissions (photo/signature/GPS/dropdown fields), publishable to roles/teams | **NEW — does not exist** |
| Event bus & capability registry | how modules integrate without imports (see §6) | **NEW** |

---

## 4. Sellable modules (technical units)

Each module: what it does standalone, the role templates it ships, and how it upgrades when siblings are installed. **Every module must pass the "only module installed" test.**

### MOD-TRACK — Agent Live Tracking
- **Standalone:** field-staff attendance (punch in/out w/ GPS+selfie), background route tracking (adaptive/battery-safe), live map, route replay, attendance report, tracking health, fake-GPS flags, diagnostics, offline sync. This IS the entry product.
- **Roles shipped:** Field Agent (mobile), Field Manager (web).
- **With siblings:** feeds auto-distance to MOD-TA; visit GPS-verification to MOD-FIELD.
- **Old source:** `field_sales` tracking parts, GPS integrity work, adaptive tracking work.

### MOD-FIELD — Field Sales Operations
- **Standalone:** beat plans, customer visits (check-in/out, reports, photos), field order booking against the Foundation catalog, payment collection entries, expense claims w/ receipts, targets, agent leaderboard. Orders/collections live in a simple approve→done flow even with no back-office module.
- **Roles shipped:** Sales Manager, Sales Agent.
- **With siblings:** orders route into MOD-ORDERS approval queue; collections post to MOD-BOOKS; GPS verification from MOD-TRACK; TA from MOD-TA.
- **Old source:** `field_sales`, `sales` (agent side), visits, sales-targets.
- ⚠️ This is the user's "Sales Management" example: Sales Manager + Sales Agent + product listing (catalog comes from Foundation).

### MOD-ORDERS — Sales Orders & Dispatch (back office)
- **Standalone:** sales order entry/edit, approval, status chain (new→confirmed→packed→delivered→invoiced→paid), pick lists, delivery notes/challans, basic invoicing + payment recording + credit notes, sales reports.
- **Roles shipped:** Sales Manager (back-office facet), Dispatcher (new, optional).
- **With siblings:** stock checks/deduction via MOD-INV capability (without it: no stock warnings, orders still work); invoices auto-post to MOD-BOOKS; field orders arrive from MOD-FIELD.
- **Old source:** `sales` (orders/invoices/credit-notes), backordered, sales-orders.

### MOD-DIST — Distribution Network
- **Standalone-ish:** distributor accounts, distributor product allocation + inventory, stock requests, distributor invoices/adjustments. *Sold only alongside MOD-ORDERS (bundle rule, not code dependency).*
- **Roles shipped:** Distributor.
- **Old source:** `distributor_inventory`, distributors/, distributor-*/ screens.

### MOD-INV — Inventory & Warehouse
- **Standalone:** warehouses, stock on hand, stock ledger (source of truth), adjustments, transfers, reorder levels, stock reports. Registers the `inventory` capability others consume.
- **Roles shipped:** Warehouse Manager.
- **Old source:** `warehouse` minus catalog (catalog → Foundation).

### MOD-PROD — Production / Manufacturing
- **Standalone contract:** BOM, work orders, job cards, production planning. Consumes/produces stock strictly through the `inventory` capability → **sold only bundled with MOD-INV** (the user's "Production Management" = Production Manager + Warehouse Manager).
- **Roles shipped:** Production Manager.
- **Old source:** `production`, bom/, work-orders/, job-cards/, production-planning/.

### MOD-PURCH — Procurement
- **Standalone:** suppliers (Foundation party facet), material requests w/ approval trail, purchase orders w/ tax, goods receipt. Without MOD-INV, GRN is a paper record; with it, GRN posts stock.
- **Roles shipped:** Purchase Manager.
- **Old source:** `purchase`, material-requests/, purchase-orders/.

### MOD-BOOKS — Accounts & Finance
- **Standalone:** chart of accounts, journal vouchers w/ approval, customer/supplier/general ledgers, sales invoices (manual), purchase bills, payments in/out w/ allocation, expense recording, P&L / BS / cash flow / trial balance, ageing, **GST hub** (e-invoice IRN+QR, e-way bill, GSTR-1/3B/9 data, 2B reconciliation, TDS/TCS), banking & reconciliation.
- **Roles shipped:** Accounts Officer.
- **With siblings:** auto-journal from MOD-ORDERS invoices/payments, MOD-PURCH bills, MOD-FIELD collections/expenses. This is the "integrate the Accounts dashboard later" scenario — installing it backfills nothing silently; it offers an import-from-modules wizard.
- **Old source:** `accounts` (only Account/JournalEntry/JournalEntryAccount exist — most of this module is NEW).

### MOD-CRM — Leads & Pipeline
- **Standalone:** leads, opportunities, funnel, follow-ups.
- **Roles shipped:** uses Sales Manager template.
- **Old source:** `crm` (leads/opportunity parts).

### MOD-ATT — Office Attendance & Leave
- **Standalone:** office punch in/out, attendance calendar, **leave management (apply/approve, balances, rules, calendar — NEW, exists nowhere today)**, holidays.
- **Roles shipped:** none new (all roles get self-service; managers approve).
- **Old source:** `office_attendance` (+ new leave build).

### MOD-TA — Travel Allowance (add-on)
- **Standalone:** claim submission w/ receipts, Manager→Finance→Pay chain, policy rates. Distance auto-fills from MOD-TRACK when present, manual entry otherwise.
- **Old source:** `travel_allowance`.

### Retired / absorbed
`analytics` → each module ships its own dashboard cards + a Foundation dashboard composer aggregates installed modules. `reports` → per-module reports + Foundation export engine. `admin_module`, `masters`, `core` → Foundation. `mdo`, `quality_manager` roles → dropped (quality app already deleted).

---

## 5. Packages (what the pricing page sells)

Bundles are **composition only** — a bundle = list of modules + role templates + price. No bundle logic in code.

| # | Package | Modules | Role templates activated | Mobile app level |
|---|---|---|---|---|
| P1 | **Agent Live Tracking** | TRACK | Field Agent, Field Manager | Tracking |
| P2 | **Sales Management** | FIELD (+ Foundation catalog) | Sales Manager, Sales Agent | Sales |
| P3 | **Sales & Field Force** | TRACK + FIELD + CRM | + Field roles | Sales (full) |
| P4 | **Order & Distribution** | ORDERS + INV + DIST | Sales Mgr, Warehouse Mgr, Distributor, Dispatcher | Sales |
| P5 | **Production Management** | PROD + INV | Production Manager, Warehouse Manager | — |
| P6 | **Procurement** | PURCH | Purchase Manager | — |
| P7 | **Books / Accounts** | BOOKS | Accounts Officer | — |
| P8 | **Enterprise** | everything | all | full |
| A1 | Add-on: Travel Allowance | TA | — | adds Expenses+ |
| A2 | Add-on: Attendance & Leave | ATT | — | adds Leave |
| A3 | Add-on: Custom Forms+ | (Foundation feature unlock) | — | adds Forms |

Pricing mechanics (from web PDF §5.7, managed in SuperAdmin): per module — flat base + free-up-to-N users + per-user above N; monthly/annual; bundle discount %; discount master (package/combo/feature/volume/overall). All live-editable.

**Tenant admin can always:** create custom roles, rename role templates, and buy/activate additional modules from inside the portal (upgrade path = self-serve too).

---

## 6. How modules integrate without depending (the contract)

1. **Shared entities live only in Foundation** (catalog items, parties, taxes, users/roles, org). A module adds its own data via *facet tables in its own namespace* FK-ing Foundation IDs — never another module's tables.
2. **Domain events, not imports.** Modules emit events (`field.order_submitted`, `orders.invoice_issued`, `purchase.grn_received`, `track.day_closed`...). Installed modules subscribe; absent modules mean the event simply has no subscriber. No `if module_x_installed` branches inside business logic.
3. **Capability registry for synchronous needs.** A module asks the registry, never a peer: `inventory.stock_of(item, warehouse)`, `tracking.distance_for(agent, date)`, `books.post_journal(...)`. Registry returns the provider or `None`; every consumer defines its documented degraded behavior (table above).
4. **UI gating is entitlement × permission.** Sidebar/menu/buttons render from (modules the tenant bought) × (role permission matrix). No screen may hard-link a screen from another module without checking entitlement (else hidden).
5. **Terminology dictionary.** Foundation exposes tenant-configurable labels: "Products/Services/Policies", "Distributor/Dealer/Franchise", "Visit/Meeting". Setup wizard picks an industry preset (Manufacturing / Distribution / Services-Insurance / Generic) that pre-fills labels + which catalog fields are visible — this is how the same code serves an insurance firm.

---

## 7. Self-serve lifecycle (no seed scripts, ever)

```
Marketing site (main domain)
 → Register (business name, email/phone OTP, password)
 → Pick package + add-ons + users → Pay (gateway TBD: Razorpay assumed)
 → PROVISIONER (control plane): create tenant DB → run migrations → write entitlements
   → generate Organization Code → create owner Admin user
 → Setup Wizard (first login on subdomain portal):
   1 Company profile + logo + GST     2 Industry preset (labels/fields)
   3 Appearance (theme)               4 Working hours/holidays/numbering
   5 Invite users → assign role templates
   6 Catalog quick-add or Excel import  7 Parties quick-add or import
   8 Module-specific mini-setup (only for bought modules: warehouses / beat areas / CoA preset)
 → Landing on live dashboard. Every step skippable, resumable, re-runnable from Settings.
```

Old Project's default categories/roles/statuses become **industry preset templates applied by the wizard** — data in the tenant DB, not fixtures in code.

---

## 8. ⚠️ Gaps the user must know about (spec'd in PDFs but missing in Old Project)

**Completely new builds — web:** SuperAdmin/Ops Console (the entire control plane: command center, leads, customers/tenants, support, requests, broadcast, packages & pricing composer, discount master, admin roles); marketing site + enrollment + checkout; provisioning pipeline; setup wizard; org-code + subdomain sign-in; single-session enforcement; beat plan builder (calendar, drag-reorder, route suggest); custom form builder; leave management; tracking health screen; route replay time-slider; messages/broadcast to agents; pick lists; delivery notes (old `DeliveryNote` was deleted — rebuild); e-invoicing (IRN/QR), e-way bill, GSTR-1/3B/9 + 2B recon, TDS/TCS; banking & bank-statement reconciliation; recurring invoices + payment reminders; custom report builder + scheduled email reports; fixed assets (later phase per PDF); Tally import.

**Completely new builds — mobile:** permission setup wizard (brand-detected, 5 steps); diagnostics/self-check screen; Sync Centre screen (outbox exists in code; the agent-facing screen doesn't); collect-payment receipt generation; custom forms runner; leave apply/balance; auto punch-out; messages inbox. (Flutter app already has: login, punch, adaptive tracking, offline queue, orders, expenses — rebrand + module gating needed.)

**Major refactors (exists but wrong shape):** catalog out of `warehouse` → Foundation; customers/suppliers → Foundation parties; appearance GLOBAL → per-tenant; permission matrix → role templates per module; analytics/reports monolith → per-module cards; every hardcoded manufacturing assumption → industry presets; `accounts` app → full MOD-BOOKS.

---

## 9. Next steps

1. **Agree this blueprint** (packages, module boundaries, degraded behaviors).
2. **Architecture doc** (next, per user's sequencing): DB-per-tenant provisioning + routing, PgBouncer/connection strategy for "many tenant DBs, no connection exhaustion", API throughput design, async workers, control-plane↔tenant sync, deployment topology.
3. Then build order: Control plane + Foundation first (everything depends on them), TRACK second (entry product), then FIELD/ORDERS/INV, then BOOKS.

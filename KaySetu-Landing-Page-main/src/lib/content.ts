// Central content source for the KaySetu ERP + CRM marketing site.
// Rebuilt from the official product deck (Salexa_Presentation).
// `icon` fields are Lucide icon keys resolved in src/components/Icon.tsx.

export const brand = {
  name: "KaySetu",
  logoLead: "Kay",
  logoTail: "Setu",
  company: "by Kayease",
  domain: "kaysetu.kayease.com",
};

export const announce = {
  text: "KaySetu unifies field sales, distribution and accounts in one real-time platform",
  linkLabel: "See the walkthrough",
  href: "/#walkthrough",
};

export const nav = {
  primary: [
    { label: "Services", menu: "platform" as const },
    { label: "Industries", menu: "industries" as const },
    { label: "Walkthrough", href: "/walkthrough" },
    { label: "Contact", href: "/contact" },
  ],
  login: { label: "Login", href: "/#demo" },
  demo: { label: "Book a demo", href: "/contact" },
  cta: { label: "Instant Demo", href: "/#demo" },
};

export const platformMenu = {
  groups: [
    {
      title: "Sales & Field",
      links: [
        { icon: "MapPin", label: "Agent Live Tracking", href: "/walkthrough?module=agent-live-tracking" },
        { icon: "Navigation", label: "Field Sales Operations", href: "/walkthrough?module=field-sales-operations" },
        { icon: "Contact", label: "Leads & Pipeline", href: "/walkthrough?module=leads-pipeline" },
        { icon: "ReceiptText", label: "Sales Orders & Dispatch", href: "/walkthrough?module=sales-orders-dispatch" },
      ],
    },
    {
      title: "Operations",
      links: [
        { icon: "Boxes", label: "Inventory & Warehouse", href: "/walkthrough?module=inventory-warehouse" },
        { icon: "Factory", label: "Production", href: "/walkthrough?module=production" },
        { icon: "ShoppingCart", label: "Procurement", href: "/walkthrough?module=procurement" },
        { icon: "Landmark", label: "Accounts & Finance", href: "/walkthrough?module=accounts-finance" },
      ],
    },
    {
      title: "Channel & Team",
      links: [
        { icon: "Share2", label: "Distribution Network", href: "/walkthrough?module=distribution-network" },
        { icon: "CalendarCheck", label: "Attendance & Leave", href: "/walkthrough?module=attendance-leave" },
        { icon: "Plane", label: "Travel Allowance", href: "/walkthrough?module=travel-allowance" },
        { icon: "BarChart3", label: "Insights & Reports", href: "/walkthrough?module=insights-reports" },
      ],
    },
  ],
  promo: {
    kicker: "Overview",
    title: "See the whole connected workflow",
    text: "Lead → visit → order → dispatch → invoice → ledger — one system.",
    cta: "Explore the workspace",
    href: "/walkthrough",
  },
};

export const industriesMenu = {
  promo: {
    kicker: "Industries",
    title: "Configured for your vertical",
    text: "FMCG, pharma, building materials and more — matched to your channel.",
    cta: "See all industries",
    href: "/industries",
  },
};

export const hero = {
  eyebrow: "Premium Enterprise ERP + CRM · by Kayease",
  titleLead: "Your business.",
  titleAccent: "Unified.",
  subhead:
    "KaySetu is a next-generation ERP & CRM platform that unifies sales, field operations, inventory, production, procurement and accounts into one seamless workflow — replacing scattered spreadsheets and siloed tools with a single source of truth.",
  orbit: "Sales · Logistics · Production · Intelligence — in a single high-performance orbit.",
  primary: { label: "Book a Free Demo", href: "#demo" },
  secondary: { label: "Explore the modules", href: "#modules" },
  strip: [
    "11 modules, packaged P1–P8",
    "Web + mobile",
    "Real-time sync",
    "GST-ready",
  ],
  panel: {
    status: "Live · Real-time",
    metrics: [
      { label: "Leads today", value: "42" },
      { label: "Field visits live", value: "18" },
      { label: "Orders (MTD)", value: "₹4.2L" },
    ],
    flow: [
      { icon: "Contact", label: "Lead" },
      { icon: "Navigation", label: "Visit" },
      { icon: "ReceiptText", label: "Order" },
      { icon: "Boxes", label: "Stock" },
      { icon: "Landmark", label: "Ledger" },
    ],
  },
};

export const trustBar = [
  { icon: "LayoutGrid", text: "11 modules — buy what you need" },
  { icon: "MonitorSmartphone", text: "Web + mobile, access anywhere" },
  { icon: "RefreshCw", text: "Real-time sync across teams" },
  { icon: "Smartphone", text: "Native Android & iOS apps" },
];

export const problem = {
  title: "Your business runs on disconnected tools — and it's costing you.",
  intro:
    "Leads live in WhatsApp, stock lives in spreadsheets, and finance finds out last. When systems don't talk to each other, work slips through the cracks.",
  points: [
    { pain: "Leads in Excel & WhatsApp", cost: "Follow-ups missed, deals lost" },
    { pain: "Unverified field visits", cost: "Fake reports, no accountability" },
    { pain: "Quote → order → invoice re-keyed", cost: "Double-entry, costly errors" },
    { pain: "Stock guessed, not tracked", cost: "Stockouts and over-promising" },
    { pain: "Production blind to demand", cost: "Shortages and firefighting" },
    { pain: "Accounts reconciled month-end", cost: "No real-time cash picture" },
  ],
  closing: "KaySetu connects all of it into one workflow — one source of truth.",
};

export const flow = {
  title: "From the first lead to the ledger entry — every step connected.",
  body:
    "From the moment a lead is captured, to the field visit, the quotation, the production order, the warehouse dispatch, the invoice, and the ledger entry — every step flows into the next. Managers get real-time visibility; teams execute without friction, and with zero double-entry.",
  steps: [
    { icon: "Contact", label: "Lead captured" },
    { icon: "Navigation", label: "Field visit" },
    { icon: "ReceiptText", label: "Quotation" },
    { icon: "ClipboardCheck", label: "Sales order" },
    { icon: "Factory", label: "Production order" },
    { icon: "Warehouse", label: "Warehouse dispatch" },
    { icon: "FileText", label: "Invoice" },
    { icon: "Landmark", label: "Ledger entry" },
  ],
};

export const modules = {
  title: "Eleven modules. One unified platform.",
  lead: "Scroll through to explore each module. Every module shares the same data, so nothing is ever re-entered and nobody works blind.",
  // `slug` maps each card to its /platform/<slug> page — these are the only
  // crawlable links into the module pages from the homepage, so keep them in
  // sync with modulePages.ts.
  items: [
    { icon: "MapPin", slug: "agent-live-tracking", name: "Agent Live Tracking", desc: "Real-time field force monitoring with GPS attendance, live map, and route replay." },
    { icon: "Navigation", slug: "field-sales-operations", name: "Field Sales Operations", desc: "Tools for beat planning, visit logging, field orders, collections, and expense management." },
    { icon: "ReceiptText", slug: "sales-orders-dispatch", name: "Sales Orders & Dispatch", desc: "Manage fulfillment with order approval chains, warehouse pick lists, delivery notes, and invoicing." },
    { icon: "Share2", slug: "distribution-network", name: "Distribution Network", desc: "Handle distributor profiles, product allocations, stock requests, and invoicing for external partners." },
    { icon: "Boxes", slug: "inventory-warehouse", name: "Inventory & Warehouse", desc: "Track physical stock across locations with a real-time ledger, adjustments, and seamless transfers." },
    { icon: "Factory", slug: "production", name: "Production", desc: "Streamline manufacturing with Bills of Materials (BOM), work orders, job cards, and planning." },
    { icon: "ShoppingCart", slug: "procurement", name: "Procurement", desc: "Manage raw material purchasing, supplier databases, purchase orders (POs), and GRNs." },
    { icon: "Landmark", slug: "accounts-finance", name: "Accounts & Finance", desc: "Track ledgers, handle invoices and vendor bills, record payments, and manage GST compliance." },
    { icon: "Contact", slug: "leads-pipeline", name: "Leads & Pipeline", desc: "Capture and track leads, monitor opportunities through the sales funnel, and manage automated follow-ups." },
    { icon: "CalendarCheck", slug: "attendance-leave", name: "Attendance & Leave", desc: "Manage office attendance, process leave requests, and maintain the company holiday calendar." },
    { icon: "Plane", slug: "travel-allowance", name: "Travel Allowance", desc: "Automate travel expense claims using GPS-auto distance calculations and approval chains." },
  ],
};

// ============================================================
// COMPARISON — "KaySetu vs. the alternative" (fully editable)
// `values` in each row / cost line map 1:1 to `columns` order.
// Cell value: "yes" (✓), "partial" (limited), "no" (absent).
// ============================================================
export const comparison = {
  kicker: "Why KaySetu",
  title: "Built for modern business. Not legacy systems.",
  lead:
    "One platform does what a pile of spreadsheets, chat apps and legacy software can't: keep every team on the same live data.",
  // Full-bleed background image behind the section. Swap the file in
  // /public to change it (photo or SVG). Set to "" for a plain dark panel.
  background: "/comparison-bg.svg",
  capabilityLabel: "Core capabilities",
  columns: [
    { name: "Spreadsheets + apps" },
    { name: "KaySetu", highlight: true },
    { name: "Legacy ERP" },
  ],
  rows: [
    { label: "Unified data — zero re-entry", values: ["no", "yes", "partial"] },
    { label: "Real-time sync across teams", values: ["no", "yes", "partial"] },
    { label: "Field sales + office in one system", values: ["no", "yes", "no"] },
    { label: "Live inventory & production", values: ["no", "yes", "yes"] },
    { label: "GST-ready accounts built in", values: ["partial", "yes", "yes"] },
    { label: "Native mobile app (iOS & Android)", values: ["no", "yes", "no"] },
    { label: "One login, one vendor", values: ["no", "yes", "partial"] },
  ],
  cost: {
    label: "Total operational cost",
    note: "Based on a typical multi-tool setup.",
    values: ["4–5 separate bills", "One simple plan", "Heavy license + AMC"],
  },
};

export const packages = {
  title: "Buy only what you run.",
  lead: "Eight ready-made packages, from a single module to the full enterprise suite — plus two add-ons you can attach to any of them.",
  base: [
    { code: "P1", name: "Agent Live Tracking", modules: ["TRACK"] },
    { code: "P2", name: "Sales Management", modules: ["FIELD"] },
    { code: "P3", name: "Sales & Field Force", modules: ["TRACK", "FIELD", "CRM"] },
    { code: "P4", name: "Order & Distribution", modules: ["ORDERS", "INV", "DIST"] },
    { code: "P5", name: "Production Management", modules: ["PROD", "INV"] },
    { code: "P6", name: "Procurement", modules: ["PURCH"] },
    { code: "P7", name: "Books & Accounts", modules: ["BOOKS"] },
    { code: "P8", name: "Enterprise", modules: ["ALL 11 MODULES"], featured: true },
  ],
  addons: [
    { code: "A1", name: "Travel Allowance", modules: ["TA"] },
    { code: "A2", name: "Attendance & Leave", modules: ["ATT"] },
  ],
  note: "Modular pricing — pay only for the modules you use.",
  cta: { label: "Get pricing", href: "#demo" },
};

// Marquee feature spotlights (alternating sections)
export const spotlights = [
  {
    id: "crm",
    icon: "Contact",
    code: "CRM",
    kicker: "Capture every lead.",
    title: "Leads & pipeline that never let an opportunity slip.",
    roles: ["Manager", "Sales Agent"],
    points: [
      "A single structured pipeline for every lead and opportunity — no more leads lost in Excel and WhatsApp.",
      "A clear funnel view with stages, so managers always know what's about to close.",
      "Follow-ups with next-action prompts, so nothing goes cold.",
      "Convert a qualified lead straight into an order — with zero double-entry.",
      "Real-time alerts the moment a lead is added, claimed, or won.",
    ],
  },
  {
    id: "field",
    icon: "Navigation",
    code: "FIELD + TRACK",
    kicker: "Command the field.",
    title: "Field sales operations, live on the map.",
    roles: ["Manager", "Field Agent"],
    points: [
      "Beat plans and visit schedules for the whole field force — individually or in bulk.",
      "Live map with GPS attendance, route replay and tracking health for every agent.",
      "Field orders, collections and expenses captured right from the visit screen.",
      "Targets tracked per agent, team and territory — plan vs. achievement at a glance.",
      "Auto-generated daily activity reports, ready every morning.",
    ],
  },
  {
    id: "orders",
    icon: "ReceiptText",
    code: "ORDERS",
    kicker: "Order to dispatch.",
    title: "Sales orders & dispatch, without the double entry.",
    roles: ["Sales Manager", "Sales Agent"],
    points: [
      "A clean order approval chain — from raised to confirmed in a click.",
      "Pick lists and delivery notes generated straight from the order.",
      "Automatic invoicing with GST handled, no re-keying between steps.",
      "Live stock and price visibility while ordering prevents over-promising.",
      "Every status change — approved, dispatched, invoiced — pushed in real time.",
    ],
  },
];

export const operations = {
  title: "The operational backbone — inventory to accounts, automated.",
  lead: "Behind the sales floor, KaySetu keeps stock, production, purchasing and finance moving in lock-step.",
  cards: [
    {
      icon: "Boxes",
      code: "INV",
      name: "Inventory & Warehouse",
      points: [
        "Multiple warehouses with a single, real-time stock ledger",
        "Stock adjustments with reason codes and a full audit trail",
        "Stock transfers between warehouses — request, approve, ship",
        "Committed vs. available stock honoured across sales and production",
      ],
    },
    {
      icon: "Factory",
      code: "PROD",
      name: "Production",
      points: [
        "Bills of Material (BOM) per finished good, with sub-assemblies",
        "Work orders and job cards with operation-wise tracking",
        "Production planning that ties demand (orders) to capacity",
        "Material requests auto-created from work orders",
      ],
    },
    {
      icon: "ShoppingCart",
      code: "PURCH",
      name: "Procurement",
      points: [
        "Purchase orders raised straight from material requests",
        "Single supplier master — contact, GST, terms, ledger, history",
        "GRN-based receiving with three-way matching before payment",
        "Full audit trail on every PO and approval",
      ],
    },
    {
      icon: "Landmark",
      code: "BOOKS",
      name: "Accounts & Finance",
      points: [
        "Customer, supplier and general ledgers, always up to date",
        "Invoices, bills and payments posted automatically from operations",
        "Built-in GST hub — GST-ready invoicing, taxes and returns",
        "Banking and reconciliation, with drill-down to every voucher",
      ],
    },
  ],
};

export const distributor = {
  kicker: "Extend to your channel.",
  title: "Distributor network management, in the same system.",
  body: "Bring your distributors into the same platform your sales team uses — and watch the visibility gap disappear.",
  points: [
    "Manage every distributor as a first-class entity — with their own inventory, pricing and ledger.",
    "Track channel stock: what's sitting with distributors vs. reaching the end-customer.",
    "Distributor invoices, adjustments and stock transfers, all through one workflow.",
    "Approval-driven onboarding keeps the master list clean and audit-ready.",
    "Channel analytics: top distributors, slow movers, sell-in vs. sell-out trends.",
  ],
};

export const mobile = {
  kicker: "Built for the field.",
  title: "Your whole business, in your field team's pocket.",
  body: "Capture leads, plan visits, check in, and punch orders on the go — every action syncs in real time across web and mobile, so managers always see the latest.",
  features: [
    { icon: "Smartphone", title: "Native Android & iOS", text: "Built on Flutter — one codebase, identical experience." },
    { icon: "MapPin", title: "GPS-verified check-ins", text: "Check in with GPS, a selfie and a shop photo — no faked visits." },
    { icon: "KeyRound", title: "Secure sign-in", text: "OTP + 4-digit PIN with JWT-based session management." },
    { icon: "Languages", title: "Multi-language + dark mode", text: "English & Hindi UI, dark mode out of the box." },
    { icon: "Bell", title: "Real-time updates", text: "Push notifications and Socket.IO alerts for leads and approvals." },
    { icon: "MonitorSmartphone", title: "One identity everywhere", text: "Android, iOS and web with single sign-on." },
  ],
};

export const insights = {
  kicker: "Insights & reports. At a glance.",
  title: "The more your team uses KaySetu, the sharper it gets.",
  body: "Cross-cutting insights that join sales, stock, production and finance — surfacing patterns no single tool can show. Every report downloads as raw data, ready for Excel or your BI tools.",
  domains: [
    {
      icon: "BarChart3",
      name: "Sales & CRM",
      points: ["Pipeline, conversion rate & time-to-close", "Targets by agent, team & territory (MTD/QTD/YTD)", "Top customers, converting sources, agent leaderboard"],
    },
    {
      icon: "Navigation",
      name: "Field Force",
      points: ["Visits planned vs. completed vs. missed", "Visits per agent and per customer", "Attendance, late-marks & GPS-spoofing flags"],
    },
    {
      icon: "Wallet",
      name: "Operations & Finance",
      points: ["Stock-aging, fast/slow movers & inventory value", "Production yield, downtime & rejections", "Supplier spend, aged receivables/payables & DSO"],
    },
  ],
  quote: "“Wait — why didn't I think of that?” — what the right cross-cutting insight feels like.",
};

export const usps = [
  { icon: "Database", title: "One source of truth", text: "Sales, ops, inventory, production, procurement & accounts in one system." },
  { icon: "MonitorSmartphone", title: "Web + mobile", text: "Access anywhere, with native Android & iOS apps." },
  { icon: "RefreshCw", title: "Real-time", text: "Socket.IO sync and push alerts across every team." },
  { icon: "FileText", title: "Zero double-entry", text: "Quote → order → invoice flows through one connected system." },
  { icon: "BadgeCheck", title: "GST-ready", text: "Compliant invoicing, tax masters and HSN built in." },
  { icon: "ShieldCheck", title: "Verified field force", text: "GPS + selfie + photo check-ins end fake visit reports." },
];

export const industries = {
  title: "Built for how India's sales-led businesses actually run.",
  lead: "From FMCG distribution to pharma and building materials, KaySetu adapts to your products, pricing and channel.",
  items: [
    { icon: "ShoppingBasket", name: "FMCG & Consumer Goods", slug: "fmcg" },
    { icon: "Truck", name: "Distribution & Wholesale", slug: "distribution" },
    { icon: "Factory", name: "Manufacturing", slug: "manufacturing" },
    { icon: "Pill", name: "Pharma & Chemicals", slug: "pharma" },
    { icon: "Sparkles", name: "Cosmetics & Personal Care", slug: "cosmetics" },
    { icon: "Shirt", name: "Textiles & Apparel", slug: "textiles" },
    { icon: "HardHat", name: "Building Materials", slug: "building-materials" },
    { icon: "Sprout", name: "Agri-Inputs", slug: "agri-inputs" },
    { icon: "Cpu", name: "Electronics & Appliances", slug: "electronics" },
  ],
};

export const socialProof = {
  // NOTE: logo tiles and customer stories below are placeholders — swap in real ones.
  title: "One platform instead of five.",
  lead: "Teams move to KaySetu to stop stitching a CRM, an SFA app, an inventory tool and an accounting package together.",
  results: [
    { stat: "1", label: "unified platform replaces CRM + SFA + inventory + accounts" },
    { stat: "0", label: "double-entry between quote, order and invoice" },
    { stat: "Real-time", label: "visibility from the field to finance" },
  ],
  logosNote: "Trusted by growing, sales-led businesses",
  logos: 6,
  testimonials: [
    { tag: "Distribution", quote: "[ Add a customer outcome — e.g. cut order-to-invoice time in half. ]", name: "Customer name", role: "Role · Company" },
    { tag: "FMCG", quote: "[ Add a customer outcome — e.g. ended fake field visits with GPS check-ins. ]", name: "Customer name", role: "Role · Company" },
    { tag: "Manufacturing", quote: "[ Add a customer outcome — e.g. one system replaced four disconnected tools. ]", name: "Customer name", role: "Role · Company" },
  ],
};

export const market = {
  title: "A large, fast-growing, under-served market.",
  stats: [
    { value: "$786M", label: "India's sales-force-automation market by 2030 — growing 9.1%/yr, the fastest-growing SFA region in APAC.", source: "https://www.grandviewresearch.com/horizon/outlook/sales-force-automation-software-market/india" },
    { value: "$5.46B", label: "India's CRM software market in 2026, with SMEs the fastest-growing segment.", source: "https://www.fortunebusinessinsights.com/customer-relationship-management-crm-market-103418" },
    { value: "~16%", label: "annual growth of India's ERP market; SME installations growing 19.2%/yr.", source: "https://www.mordorintelligence.com/industry-reports/india-enterprise-resource-planning-market" },
    { value: "~12%", label: "of MSMEs use an ERP today despite 95%+ using some digital tool — a wide-open gap.", source: "https://www.marketresearchfuture.com/reports/india-erp-software-market-45931" },
  ],
  framing:
    "India's field-sales, CRM and ERP markets are all compounding at double digits — yet most SMEs still run on spreadsheets and WhatsApp. The winners will unify field sales and the back office in one system. That's KaySetu.",
};

export const competitive = {
  title: "Most tools automate the field — or the channel. KaySetu unifies the business.",
  lead: "SFA and DMS apps still leave you bolting on separate inventory, production and accounting. KaySetu is one system, end to end.",
  columns: [
    { label: "", eg: "" },
    { label: "KaySetu", eg: "ERP + CRM" },
    { label: "SFA-only", eg: "FieldAssist, Unolo" },
    { label: "DMS / retail", eg: "Bizom, BeatRoute" },
    { label: "Spreadsheets", eg: "Excel + Tally" },
  ],
  rows: [
    { k: "Field sales & visits", cells: [{ t: "Built-in, GPS-verified", v: "yes" }, { t: "Core strength", v: "yes" }, { t: "Partial", v: "warn" }, { t: "Manual", v: "no" }] },
    { k: "CRM & lead pipeline", cells: [{ t: "Full pipeline + 360°", v: "yes" }, { t: "Basic", v: "warn" }, { t: "Basic", v: "warn" }, { t: "None", v: "no" }] },
    { k: "Inventory & production", cells: [{ t: "Built-in", v: "yes" }, { t: "Separate ERP needed", v: "no" }, { t: "Stock only", v: "warn" }, { t: "Tally-ish", v: "warn" }] },
    { k: "Procurement & accounts", cells: [{ t: "Built-in, GST-ready", v: "yes" }, { t: "Integrate elsewhere", v: "no" }, { t: "Integrate elsewhere", v: "no" }, { t: "Separate", v: "warn" }] },
    { k: "Distributor network", cells: [{ t: "First-class module", v: "yes" }, { t: "Varies", v: "warn" }, { t: "Core strength", v: "yes" }, { t: "Manual", v: "no" }] },
    { k: "One source of truth", cells: [{ t: "End-to-end", v: "yes" }, { t: "Field only", v: "no" }, { t: "Channel only", v: "no" }, { t: "Siloed", v: "no" }] },
  ],
  quote: "From the first lead to the ledger entry, it's one system — nothing re-entered, no one working blind.",
};

export const faqs = [
  { q: "Does KaySetu work on both web and mobile?", a: "Yes — native Android & iOS apps plus a full web app, with single sign-on and one user identity everywhere." },
  { q: "How quickly does data sync across the team?", a: "In real time. Updates propagate instantly across web and mobile via Socket.IO, so managers see new leads, orders and approvals the moment they happen." },
  { q: "Is it GST-ready?", a: "Yes — GST-compliant invoicing with tax masters, HSN mapping and configurable invoice templates out of the box." },
  { q: "How do you prevent fake field visits?", a: "Check-ins are verified with GPS, a selfie and a shop photo — anti-spoof — so attendance and visits can't be faked." },
  { q: "Can I bring my distributors onto the platform?", a: "Yes. The distributor network module manages each distributor as a first-class entity with their own inventory, pricing and ledger." },
  { q: "Which languages does the app support?", a: "English and Hindi, with dark mode built in — so every team member is comfortable." },
  { q: "How are the insights generated?", a: "The more your team uses KaySetu, the sharper the cross-cutting insights become. Every report is also downloadable as raw data for your own analysis." },
];

export const finalCta = {
  title: "See your business, unified.",
  body:
    "Book a free, no-obligation demo. We'll walk your team through the whole flow — from a captured lead to the ledger entry — on your real scenarios.",
  primary: { label: "Book a Free Demo", href: "#demo" },
  secondary: { label: "Talk to Kayease", href: "mailto:hello@kayease.com" },
  reassurance: "ERP + CRM · Web + Mobile · Real-time · GST-ready",
};

// Footer modeled on dock.cool: a brand block + link columns, closed by a
// giant brand wordmark on a brand-tinted horizon band — opened by a navy
// CTA ribbon so the footer anchors the page instead of trailing off.
export const footer = {
  tagline: "Your business. Unified.",
  description:
    "KaySetu brings field sales, distribution, inventory, production and accounts into one real-time platform — web and mobile, always in sync.",
  builtBy: "Built by Kayease",
  copyright: "© 2026 KaySetu · by Kayease. All rights reserved.",
  wordmark: "kaysetu",
  // Navy CTA ribbon at the top of the footer.
  ribbon: {
    kicker: "Get started",
    title: "Ready to unify your business?",
    body: "See KaySetu run your sales, stock and accounts in one live workflow.",
    primary: { label: "Instant Demo", href: "/#demo" },
    secondary: { label: "Book a demo", href: "/contact" },
  },
  columns: [
    {
      title: "Product",
      links: [
        { label: "Module walkthroughs", href: "/walkthrough" },
        { label: "Field Sales Operations", href: "/platform/field-sales-operations" },
        { label: "Inventory & Warehouse", href: "/platform/inventory-warehouse" },
        { label: "Distribution Network", href: "/platform/distribution-network" },
        { label: "Accounts & Finance", href: "/platform/accounts-finance" },
        { label: "FAQ", href: "/#faq" },
      ],
    },
    {
      title: "Industries",
      links: [
        { label: "FMCG & Consumer Goods", href: "/industries/fmcg" },
        { label: "Distribution & Wholesale", href: "/industries/distribution" },
        { label: "Manufacturing", href: "/industries/manufacturing" },
        { label: "Pharma & Chemicals", href: "/industries/pharma" },
        { label: "All industries", href: "/industries" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Kayease", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Careers", href: "/careers" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Use", href: "/terms" },
      ],
    },
  ],
  // Contact block (fills the right column) + social icon pills.
  contact: {
    title: "Get in touch",
    email: "sales@kayease.com",
    location: "Jaipur, India",
    badge: "India-first · GST-ready",
  },
  socials: [
    { label: "X (Twitter)", icon: "twitter", href: "https://twitter.com/kayease" },
    { label: "LinkedIn", icon: "linkedin", href: "https://www.linkedin.com/company/kayease" },
    { label: "YouTube", icon: "youtube", href: "https://www.youtube.com/@kayease" },
    { label: "Email", icon: "mail", href: "mailto:hello@kayease.com" },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

/* ============================================================
   Sub-page content (About · Contact · Careers · Privacy · Terms)
   ============================================================ */

export const aboutPage = {
  kicker: "About Kayease",
  title: "We build the bridge between every part of your business.",
  lead:
    "Kayease is a product studio building software for fast-moving Indian SMEs. KaySetu is our answer to a problem we kept seeing everywhere: great teams held back by disconnected tools, double-entry and blind spots.",
  stats: [
    { value: "12+", label: "Integrated modules" },
    { value: "2", label: "Native mobile apps (Android & iOS)" },
    { value: "Real-time", label: "Sync across web & mobile" },
    { value: "GST-ready", label: "Built for India from day one" },
  ],
  story: {
    title: "Why we built KaySetu",
    paragraphs: [
      "Most businesses don't fail for lack of effort. They lose deals because a lead sat unanswered in WhatsApp, or over-promise stock they didn't have, or find out about a cash crunch a month too late. The work is fine — the systems don't talk to each other.",
      "The market is full of tools that automate one slice: the field, or the channel, or the ledger. Bolting five of them together just moves the disconnection somewhere else. We wanted one system where a lead flows all the way to the ledger entry with zero re-keying.",
      "That's KaySetu — Kayease + Setu, the Sanskrit word for 'bridge'. One source of truth for sales, field operations, inventory, production, procurement, accounts and your distributor network. Web and mobile, real-time, and ready for the way Indian businesses actually run.",
    ],
  },
  values: [
    {
      icon: "Share2",
      title: "Connection over features",
      text: "A feature that lives in a silo isn't worth much. Everything we ship has to make the whole system more connected.",
    },
    {
      icon: "BadgeCheck",
      title: "Concrete over vague",
      text: "GPS + selfie + shop photo, not 'engagement'. We describe what the software actually does, in plain words.",
    },
    {
      icon: "MapPin",
      title: "Built for the field",
      text: "The people using KaySetu are often on a two-wheeler between shops. If it doesn't work on a phone on a patchy network, it doesn't ship.",
    },
    {
      icon: "ShieldCheck",
      title: "Trust by default",
      text: "Verified visits, audit trails and one identity everywhere. Accountability shouldn't be an add-on.",
    },
  ],
};

export const contactPage = {
  kicker: "Contact",
  title: "Talk to the team behind KaySetu.",
  lead:
    "Book a demo, ask a question, or tell us about your business. We usually reply within one business day.",

  // ── Hero: trust chips + reassurance panel (fills the header) ─
  chips: ["Free demo", "No obligation", "Reply within 1 business day"],
  highlights: [
    { icon: "Clock", title: "Fast, human replies", text: "A real member of the Kayease team gets back to you — usually within one business day." },
    { icon: "BadgeCheck", title: "A demo on your terms", text: "We walk your team through the whole flow on your real scenarios. Free, no obligation." },
    { icon: "ShieldCheck", title: "Private by default", text: "Your details are only ever used to reply to you — never sold or spammed." },
  ],

  // ── Left card: the "Get in touch" message form ──────────────
  form: {
    eyebrow: "Contact us",
    titleLead: "Get in",
    titleAccent: "touch",
    note:
      "We're here to help you make field operations smarter, faster and more reliable with KaySetu.",
    // Fields render with a leading icon (Lucide key) inside the input.
    fields: [
      { name: "name", icon: "User", label: "Full Name", type: "text", placeholder: "Full Name", required: true, full: true },
      { name: "company", icon: "Building2", label: "Company", type: "text", placeholder: "Company", required: false, full: false },
      { name: "phone", icon: "Phone", label: "Phone Number", type: "tel", placeholder: "Phone Number", required: false, full: false },
      { name: "email", icon: "Mail", label: "Email Address", type: "email", placeholder: "Email Address", required: true, full: true },
    ],
    message: { name: "message", icon: "MessageSquare", placeholder: "Let us know how we can help you…", required: true },
    attachment: {
      title: "Upload Attachment",
      optional: "(Optional)",
      hint: "PNG, JPG, PDF up to 5MB",
      accept: ".png,.jpg,.jpeg,.pdf",
    },
    consent: { lead: "I agree to the", privacy: "Privacy Policy", and: "and", terms: "Terms of Use." },
    submit: "Send Message",
    reassurance: "No spam — we only use your details to reply and, if you like, schedule your demo.",
    // Success state after submit
    success: {
      title: "Thanks — we'll be in touch.",
      body: "Your message is in. A member of the Kayease team usually replies within one business day.",
    },
  },

  // ── Right card: product demo video ─────────────────────────
  // Clip lives at /public/media/product-tour.mp4 (repoint `video` to swap it).
  // Falls back to a branded panel if the file is missing.
  media: {
    video: "/media/product-tour.mp4",
    poster: "", // optional still frame, e.g. "/media/product-tour.jpg"
    kicker: "Product tour",
    title: "See KaySetu in action.",
    caption: "A quick look at the unified ERP + CRM workflow — from the first lead to the ledger entry.",
  },

  // ── Office location (used by the Head Office quick card) ─────
  // Placeholder head-office details — edit to your real address.
  office: {
    brand: "KaySetu",
    company: "Kayease Global Solutions",
    address: ["B-50 A, Bhagat Singh Tilak Nagar,", "Jaipur, Rajasthan 302004, India"],
    directionsLabel: "Get Directions",
    directionsHref:
      "https://www.google.com/maps/dir/?api=1&destination=Bhagat+Singh+Tilak+Nagar,+Jaipur,+Rajasthan+302004",
    // Keyless Google Maps embed (works without an API key).
    mapEmbed:
      "https://maps.google.com/maps?q=Tilak%20Nagar%2C%20Jaipur%2C%20Rajasthan%20302004&t=&z=13&ie=UTF8&iwloc=&output=embed",
    mapLargeLabel: "View Larger Map",
    mapLargeHref:
      "https://www.google.com/maps/search/?api=1&query=Bhagat+Singh+Tilak+Nagar,+Jaipur,+Rajasthan+302004",
  },

  // ── Quick-contact cards (below the form / map) ──────────────
  // Phone is a placeholder — swap in your real sales line.
  quick: [
    { icon: "Headphones", label: "Talk to Sales", value: "+919887664666", href: "tel:+919887664666" },
    { icon: "Mail", label: "Email Us", value: "sales@kayease.com", href: "mailto:sales@kayease.com" },
    { icon: "Clock", label: "Business Hours", value: "Mon – Sat, 10AM – 7PM", href: null },
    { icon: "MapPin", label: "Head Office", value: "Jaipur, Rajasthan, India", href: "https://www.google.com/maps/search/?api=1&query=Bhagat+Singh+Tilak+Nagar,+Jaipur,+Rajasthan+302004" },
  ],
};

export const careersPage = {
  kicker: "Careers",
  title: "Help us unify the way businesses run.",
  lead:
    "We're a small, product-obsessed team building software that real field teams depend on every day. If that sounds like your kind of work, we'd love to talk.",
  perks: [
    { icon: "Sparkles", title: "Real ownership", text: "Small team, big surface area. You'll own features end to end, from spec to production." },
    { icon: "MonitorSmartphone", title: "Web + mobile + real-time", text: "Modern stack — Next.js, Flutter, Socket.IO — solving genuinely hard connected-systems problems." },
    { icon: "MapPin", title: "Close to the customer", text: "We ship for field teams and distributors. You'll hear from the people who use what you build." },
    { icon: "CalendarCheck", title: "Flexible & remote-friendly", text: "Focused work over face time. We care about outcomes, not hours logged." },
  ],
  roles: [
    { title: "Senior Full-Stack Engineer", team: "Engineering", location: "Remote / India", type: "Full-time" },
    { title: "Flutter Mobile Engineer", team: "Mobile", location: "Remote / India", type: "Full-time" },
    { title: "Product Designer", team: "Design", location: "Remote / India", type: "Full-time" },
    { title: "Customer Success Lead", team: "Success", location: "India", type: "Full-time" },
  ],
  cta: {
    title: "Don't see your role?",
    text: "We're always glad to meet sharp people. Tell us what you'd want to build.",
    label: "Email careers@kayease.com",
    href: "mailto:careers@kayease.com",
  },
};

export const legalPages = {
  privacy: {
    kicker: "Legal",
    title: "Privacy Policy",
    updated: "Last updated: 23 July 2026",
    intro:
      "This policy explains what information KaySetu (by Kayease) collects, how we use it, and the choices you have. This is a template summary for the marketing site and is not a substitute for legal advice.",
    sections: [
      {
        heading: "Information we collect",
        body: "We collect information you provide directly — such as your name, company, email and phone when you request a demo or contact us — and standard technical data (like IP address and browser type) needed to operate and secure the site.",
      },
      {
        heading: "How we use information",
        body: "To respond to your enquiries, schedule and run demos, improve our product and website, and communicate about KaySetu. We do not sell your personal information.",
      },
      {
        heading: "Data from the KaySetu platform",
        body: "For customers using the KaySetu ERP + CRM platform, business data you enter (leads, orders, inventory, ledgers) is processed on your behalf under your account. You control that data; we act as a processor and keep it confidential.",
      },
      {
        heading: "Cookies & analytics",
        body: "We use essential cookies to run the site and may use privacy-respecting analytics to understand aggregate usage. You can control cookies through your browser settings.",
      },
      {
        heading: "Data retention & security",
        body: "We keep personal data only as long as needed for the purposes above or as required by law, and protect it with reasonable technical and organisational safeguards.",
      },
      {
        heading: "Your rights & contact",
        body: "You can request access to, correction of, or deletion of your personal data by writing to privacy@kayease.com. We'll respond within a reasonable time.",
      },
    ],
    contact: { label: "privacy@kayease.com", href: "mailto:privacy@kayease.com" },
  },
  terms: {
    kicker: "Legal",
    title: "Terms of Service",
    updated: "Last updated: 23 July 2026",
    intro:
      "These terms govern your use of the KaySetu website and product. This is a template summary for the marketing site and is not a substitute for a signed agreement.",
    sections: [
      {
        heading: "Use of the site",
        body: "You may use this website for lawful purposes and in line with these terms. You agree not to misuse the site, attempt to disrupt it, or access it in ways not permitted here.",
      },
      {
        heading: "The KaySetu service",
        body: "Access to the KaySetu ERP + CRM platform is governed by your separate subscription or order agreement with Kayease. Where those terms conflict with these, the subscription agreement prevails.",
      },
      {
        heading: "Intellectual property",
        body: "KaySetu, Kayease, the logo, and all site content are owned by Kayease. You may not copy, modify or redistribute them without written permission.",
      },
      {
        heading: "Disclaimers",
        body: "The website is provided 'as is'. We work hard to keep information accurate but make no warranty that it is complete, current or error-free.",
      },
      {
        heading: "Limitation of liability",
        body: "To the extent permitted by law, Kayease is not liable for indirect or consequential losses arising from use of this website.",
      },
      {
        heading: "Changes & contact",
        body: "We may update these terms from time to time; continued use means you accept the changes. Questions? Write to legal@kayease.com.",
      },
    ],
    contact: { label: "legal@kayease.com", href: "mailto:legal@kayease.com" },
  },
};

/* ============================================================
   Interactive showcase — scroll-driven product demo narrative
   (home page). Section order mirrors onboarding → daily use.
   `screen` keys map to coded mockups in src/components/AppScreens.tsx.
   `video` is an optional /public/media path; when present it plays
   in place of the coded mockup (falls back to the mockup on error).
   ============================================================ */

export const showcaseHero = {
  eyebrow: "The unified ERP + CRM portal",
  titleLines: ["Run the whole", "business on"],
  titleAccent: "one screen.",
  subhead:
    "KaySetu turns scattered spreadsheets, WhatsApp threads and five disconnected tools into a single, real-time workflow — from the first lead to the ledger entry.",
  primary: { label: "Explore the portal", href: "#walkthrough" },
  secondary: { label: "Watch the walkthrough", href: "#walkthrough" },
  trustLabel: "Built for fast-moving businesses across",
  trust: [
    "FMCG",
    "Distribution",
    "Pharma",
    "Building materials",
    "Manufacturing",
    "Agri-inputs",
    "Textiles",
    "Cosmetics",
  ],
};

// ============================================================
// HOME HERO / BANNER — fully editable
// Change any copy below to update the home page banner. Swap the
// banner illustration by editing `banner.src` (drop your file in
// /public and point to it, e.g. "/hero-distribution.svg" or a .png).
// ============================================================
export const homeHero = {
  // Small pill above the headline
  badge: "8 Packages. 11 Modules. 1 Platform.",
  // Headline — `titleLines` render in navy, `titleAccent` in orange
  titleLines: ["Smarter Operations."],
  titleAccent: "Stronger Growth.",
  subhead:
    "KaySetu unifies your sales, distribution, operations, finance and workforce on one intelligent platform built for growing businesses.",
  primary: { label: "Explore Packages", href: "/#packages" },
  // Editable banner illustration (left/foreground scene). Swap the file
  // in /public to change it. Set `src` to "" to hide the image.
  banner: {
    src: "/hero-banner.png",
    alt: "KaySetu unifies warehouse, distribution, field sales and analytics on one platform",
    width: 1774,
    height: 887,
  },
  // Right-side module constellation. Ordered clockwise starting from the top.
  modules: [
    { code: "FIELD", name: "Sales Management", icon: "Users" },
    { code: "ORDERS", name: "Sales Orders & Dispatch", icon: "ReceiptText" },
    { code: "DIST", name: "Distribution Network", icon: "Truck" },
    { code: "INV", name: "Inventory & Warehouse", icon: "Boxes" },
    { code: "TA", name: "Travel Allowance", icon: "Plane" },
    { code: "ATT", name: "Attendance & Leave", icon: "CalendarCheck" },
    { code: "CRM", name: "Leads & Pipeline", icon: "Contact" },
    { code: "BOOKS", name: "Accounts & Finance", icon: "Landmark" },
    { code: "PURCH", name: "Procurement Management", icon: "ShoppingCart" },
    { code: "PROD", name: "Production Management", icon: "Factory" },
    { code: "TRACK", name: "Agent Live Tracking", icon: "MapPin" },
  ],
  // Packages tailored strip (P1–P8)
  packagesTitle: "Packages tailored for every business",
  packages: [
    { code: "P1", label: "Agent Live Tracking", color: "#2563eb" },
    { code: "P2", label: "Sales Management", color: "#f97316" },
    { code: "P3", label: "Sales & Field Force", color: "#16a34a" },
    { code: "P4", label: "Order & Distribution", color: "#ea580c" },
    { code: "P5", label: "Production Management", color: "#7c3aed" },
    { code: "P6", label: "Procurement", color: "#d97706" },
    { code: "P7", label: "Books & Accounts", color: "#0d9488" },
    { code: "P8", label: "Enterprise (All Modules)", color: "#10234b" },
  ],
  // Trust features row
  features: [
    { icon: "ShieldCheck", title: "Secure & Reliable", text: "Enterprise-grade security you can trust" },
    { icon: "Cloud", title: "Accessible Anywhere", text: "Access your business from any device" },
    { icon: "BarChart3", title: "Built for Growth", text: "Designed to scale with your business" },
    { icon: "LifeBuoy", title: "Dedicated Support", text: "We're here to help you succeed" },
  ],
};

export const problemShift = {
  kicker: "The shift",
  old: "Today, the business runs on spreadsheets, WhatsApp and five tools that don't talk.",
  new: "KaySetu connects every step into one live system — so nothing is re-entered and no one works blind.",
};

export const walkthrough = {
  kicker: "Guided walkthrough",
  title: "See exactly how the portal works — step by step.",
  lead: "This is the same flow your team lives in every day. Follow it from onboarding to daily use.",
  steps: [
    {
      n: 1,
      icon: "Contact",
      kicker: "Capture",
      title: "Capture every lead in one pipeline.",
      body: "Leads from the field, calls and campaigns land in one structured pipeline — auto-routed, scored, and impossible to lose in a chat.",
      points: [
        "Single structured pipeline",
        "Clear funnel view with stages",
        "Next-action prompts",
        "Zero double-entry to convert"
      ],
      ctaLabel: "Explore Lead Capture >",
      screen: "leads",
      video: "",
    },
    {
      n: 2,
      icon: "Navigation",
      kicker: "Verify",
      title: "Hit the field — verified in real time.",
      body: "Plan visits, watch live routes on a map, and confirm every check-in with GPS, a selfie and a shop photo. Fake reports become impossible.",
      points: [
        "Live GPS map tracking",
        "Photo & location verification",
        "Bulk visit scheduling",
        "Auto-generated daily reports"
      ],
      ctaLabel: "Explore Field Operations >",
      screen: "field",
      video: "",
    },
    {
      n: 3,
      icon: "ReceiptText",
      kicker: "Sell",
      title: "Quote to cash, without re-keying.",
      body: "Build a quotation in seconds, then convert quote → order → GST invoice in one flow. Live stock and price stop over-promising.",
      points: [
        "Quote-to-order in one click",
        "Live stock visibility",
        "Automatic GST invoicing",
        "Real-time order statuses"
      ],
      ctaLabel: "Explore Sales Orders >",
      screen: "quote",
      video: "",
    },
    {
      n: 4,
      icon: "Boxes",
      kicker: "Fulfil",
      title: "See every unit of stock, live.",
      body: "Real-time stock across every warehouse and bin, with low-stock alerts and reorder built in — tied straight to orders and production.",
      points: [
        "Multi-warehouse tracking",
        "Low-stock automated alerts",
        "Seamless stock transfers",
        "Full audit trails"
      ],
      ctaLabel: "Explore Inventory >",
      screen: "inventory",
      video: "",
    },
    {
      n: 5,
      icon: "BarChart3",
      kicker: "Command",
      title: "Your whole business, on one command center.",
      body: "Sales, field, stock and cash join up on a single dashboard — surfacing patterns no standalone tool can see.",
      points: [
        "Real-time cross-module data",
        "Customizable widgets",
        "Role-based visibility",
        "Actionable insights"
      ],
      ctaLabel: "Explore Dashboard >",
      screen: "dashboard",
      video: "",
    },
    {
      n: 6,
      icon: "Smartphone",
      kicker: "Anywhere",
      title: "Run the field from your pocket.",
      body: "Native Android & iOS apps put capture, visits, check-ins and orders in the field team's hand — every action syncs in real time.",
      points: [
        "Native Android & iOS",
        "Offline-capable data entry",
        "Push notifications & alerts",
        "Instant ledger sync"
      ],
      ctaLabel: "Explore Mobile App >",
      screen: "mobile",
      video: "",
    },
  ],
};

export const stats = {
  kicker: "One platform, packaged your way",
  items: [
    { value: 11, suffix: "", label: "Modules — from live tracking to accounts" },
    { value: 8, suffix: "", label: "Packages (P1–P8) — buy only what you run" },
    { value: 1, suffix: "", label: "Platform, one login, one source of truth" },
  ],
  caption: "Web + mobile · real-time sync · GST-ready · zero double-entry",
};

/* Store links for the mobile agent app. Replace with the live listings. */
export const appLinks = {
  ios: "https://apps.apple.com/app/kaysetu",
  android: "https://play.google.com/store/apps/details?id=com.kaysetu",
};

export const productReveal = {
  kicker: "The workspace behind the motion",
  title: "One connected system. Every team, the same truth.",
  lead: "Everything you just walked through rolls up here — the single screen leaders actually run the business from.",
  legend: [
    { n: 1, label: "Capture", text: "Leads & CRM pipeline" },
    { n: 2, label: "Verify", text: "Field visits & GPS check-ins" },
    { n: 3, label: "Quote", text: "Quote → order → invoice" },
    { n: 4, label: "Fulfil", text: "Inventory, production & dispatch" },
    { n: 5, label: "Reconcile", text: "Accounts, ledgers & insights" },
  ],
};

export const builtFor = {
  kicker: "Built for every role",
  title: "One portal, tuned to how each team works.",
  tiles: [
    {
      icon: "Navigation",
      tag: "For sales & field teams",
      title: "Close more, from anywhere.",
      points: ["Live pipeline & 360° customers", "GPS-verified visits & routes", "Quote & order from the visit screen"],
    },
    {
      icon: "Landmark",
      tag: "For operations & finance",
      title: "The back office, automated.",
      points: ["Real-time stock & production", "PO → GRN → supplier ledgers", "GST invoicing & aged AR/AP"],
    },
    {
      icon: "Share2",
      tag: "For distributors & channel",
      title: "Bring the channel in.",
      points: ["Distributor stock & pricing", "Sell-in vs. sell-out visibility", "Approval-driven onboarding"],
    },
  ],
};

export const toolbox = {
  kicker: "Connects with your stack",
  title: "Fits the tools your team already uses.",
  note: "Illustrative — confirm your live integrations before launch.",
  // Shown as a restrained static strip (not a marquee).
  tools: ["Tally", "WhatsApp", "Razorpay", "Google Maps", "GST Portal", "Excel / CSV", "Shiprocket", "Zoho"],
};

export const taglineMarquee = [
  "Your business. Unified.",
  "Lead → Ledger",
  "Zero double-entry",
  "Real-time sync",
  "GST-ready",
  "Web + mobile",
  "Verified field force",
];

export const testimonials = {
  kicker: "What changes on day one",
  title: "The outcomes teams come to KaySetu for.",
  // Honest framing: these are outcomes by role, not attributed customer
  // quotes. Swap `items` for real, named customer stories once you have them.
  note: "Outcomes by role — we'll publish named customer stories as we onboard our first teams.",
  items: [
    {
      icon: "Navigation",
      role: "Sales & field teams",
      quote:
        "A lead flows to the invoice without anyone re-typing it — no double entry between the field and the back office.",
    },
    {
      icon: "MapPin",
      role: "Field managers",
      quote:
        "GPS-, selfie- and photo-verified check-ins settle the fake-visit question, so the whole field day is visible by 9 AM.",
    },
    {
      icon: "Landmark",
      role: "Operations & finance",
      quote:
        "Stock, production and accounts finally reconcile against each other instead of three separate spreadsheets.",
    },
    {
      icon: "Share2",
      role: "Channel & distribution",
      quote:
        "Distributors work in the same system you do, so channel stock and sell-through stop being a guess.",
    },
  ],
};

// "Don't take our word for it" — testimonial wall (marquee of quote cards),
// modeled on the Stokt layout. Placeholder people/companies with real KaySetu
// outcomes as the quotes — swap `items` for named customer stories once live.
export const proofWall = {
  kicker: "Testimonials",
  title: "Don't take our word for it",
  subtitle: "Take theirs",
  items: [
    {
      quote:
        "A lead flows straight to the invoice — nobody re-types anything between the field and the back office. We closed our books three days sooner the very first month.",
      name: "Priya Nair",
      role: "VP · Sales",
      company: "Regional FMCG Distributor",
    },
    {
      quote:
        "The fake-visit debate is over. GPS-, selfie- and photo-verified check-ins mean the entire field day is visible by 9 AM.",
      name: "Rahul Mehta",
      role: "National Field Manager",
      company: "Consumer Goods",
    },
    {
      quote:
        "Stock, production and accounts finally reconcile against each other instead of living in three separate spreadsheets that never agreed. One source of truth, end to end.",
      name: "Anjali Rao",
      role: "Head of Operations",
      company: "Mid-size Manufacturer",
    },
    {
      quote:
        "Our distributors now work in the same system we do. Channel stock and sell-through stopped being a guess overnight.",
      name: "Vikram Shah",
      role: "Channel & Distribution Head",
      company: "Beverages",
    },
    {
      quote:
        "We replaced four disconnected tools with one. Onboarding a new sales rep went from a week of logins to a single afternoon, and everyone finally sees the same numbers.",
      name: "Sanjay Gupta",
      role: "Founder & CEO",
      company: "SME · Wholesale",
    },
    {
      quote:
        "GST-ready invoicing that just works. Procurement, accounts and the field team all speak to each other now — no exports, no reconciliation nights.",
      name: "Meera Krishnan",
      role: "Finance Controller",
      company: "Personal Care Brand",
    },
    {
      quote:
        "The web and mobile apps stay in perfect sync in real time. My managers approve from their phones and the office sees it instantly.",
      name: "Arjun Desai",
      role: "Regional Sales Director",
      company: "Building Materials",
    },
    {
      quote:
        "Honestly the best rollout we've done. The team walked our real scenarios in the demo, and what they showed is exactly what we run today.",
      name: "Kavya Reddy",
      role: "COO",
      company: "Food & Agri",
    },
  ],
};

export const closing = {
  line: "Stop bolting five tools together.",
  lineAccent: "Run the whole business on one.",
  body: "Book a free, no-obligation demo — we'll walk your team through the entire flow on your real scenarios.",
  primary: { label: "Book a Free Demo", href: "#demo" },
  secondary: { label: "Talk to Kayease", href: "mailto:hello@kayease.com" },
};

/* ============================================================
   INDUSTRY PAGES — /industries and /industries/[slug]
   One entry per vertical, each a full landing page with its own
   SEO metadata, hero, challenges, capabilities, workflow, outcomes,
   testimonial, FAQ and CTA. Icons are Lucide keys (see Icon.tsx).
   Keep slugs in sync with `industries.items[].slug`.
   ============================================================ */

export type IndustryPage = {
  slug: string;
  icon: string;
  name: string;
  eyebrow: string;
  tagline: string; // short one-liner for cards / index
  seo: { title: string; description: string; keywords: string[] };
  hero: {
    title: string;
    titleAccent: string;
    subhead: string;
    stats: { value: string; label: string }[];
  };
  challenges: {
    title: string;
    intro: string;
    items: { pain: string; impact: string }[];
  };
  capabilities: {
    title: string;
    lead: string;
    cards: { icon: string; name: string; desc: string }[];
  };
  workflow: {
    title: string;
    lead: string;
    steps: { icon: string; label: string }[];
  };
  outcomes: {
    title: string;
    lead: string;
    metrics: { value: string; label: string }[];
  };
  testimonial: { quote: string; name: string; role: string; company: string };
  faqs: { q: string; a: string }[];
  cta: { title: string; body: string };
};

// Shared closing copy for every industry CTA band.
const industryCtaBody =
  "Book a free, no-obligation demo. We'll model your channel, your SKUs and your GST flow on real scenarios — a working session, not a slide deck.";

export const industryIndex = {
  kicker: "Industries",
  title: "Built for how your industry actually sells.",
  lead: "KaySetu adapts to your products, pricing and channel — from FMCG beats and pharma batches to building-materials dealers and agri-input seasons. One unified ERP + CRM, tuned to your vertical.",
  seo: {
    title: "Industries — ERP + CRM built for your vertical | KaySetu",
    description:
      "A unified ERP + CRM tuned for FMCG, distribution, manufacturing, pharma, cosmetics, textiles, building materials and agri-inputs — one real-time platform.",
    keywords: [
      "ERP CRM by industry",
      "FMCG sales software",
      "distribution management software",
      "manufacturing ERP India",
      "pharma distribution software",
      "field sales automation",
      "GST ERP software",
      "industry specific ERP",
    ],
  },
};

export const industryPages: IndustryPage[] = [
  {
    slug: "fmcg",
    icon: "ShoppingBasket",
    name: "FMCG & Consumer Goods",
    eyebrow: "FMCG & Consumer Goods",
    tagline: "Beat-to-bill field sales, distribution and GST accounts in one real-time system.",
    seo: {
      title: "FMCG ERP + CRM | Field Sales & Distribution — KaySetu",
      description:
        "Unify FMCG field sales, distributor management, primary & secondary sales and GST accounts in one real-time platform. GPS-verified visits, live stock.",
      keywords: [
        "FMCG sales software",
        "FMCG distribution management system",
        "secondary sales tracking software",
        "field sales automation FMCG",
        "DMS software India",
        "retail execution software",
        "FMCG SFA app",
        "beat plan software",
        "distributor management software",
        "primary and secondary sales software",
        "GST billing FMCG",
      ],
    },
    hero: {
      title: "The whole FMCG business,",
      titleAccent: "on one platform.",
      subhead:
        "From the salesman's beat to the distributor's ledger, KaySetu connects field sales, secondary sales, stock and accounts in real time — so high-velocity SKUs never stock out and no order is ever re-keyed.",
      stats: [
        { value: "GPS-verified", label: "field visits, no fake reports" },
        { value: "Real-time", label: "primary & secondary sales" },
        { value: "GST-ready", label: "invoicing & e-way bills" },
      ],
    },
    challenges: {
      title: "Why FMCG sales leaders lose velocity",
      intro:
        "FMCG runs on speed and reach — thousands of outlets, fast-moving SKUs, thin margins. When the field, the distributor and the back office run on different tools, that speed leaks away.",
      items: [
        { pain: "Beat plans on paper, visits unverified", impact: "Fake reports, skipped outlets, no coverage proof" },
        { pain: "Secondary sales invisible till month-end", impact: "You're blind to what actually sells through" },
        { pain: "Distributor stock guessed, not tracked", impact: "Stockouts on hero SKUs, dumping on slow ones" },
        { pain: "Schemes & claims in spreadsheets", impact: "Leaking margins and disputed distributor claims" },
        { pain: "Orders re-keyed from field into Tally", impact: "Double-entry, delayed invoices, costly errors" },
        { pain: "Returns & near-expiry unmanaged", impact: "Write-offs and shelf-life losses" },
      ],
    },
    capabilities: {
      title: "One platform, tuned for FMCG velocity",
      lead: "Every FMCG workflow — beat to bill — in a single connected system your field, channel and finance teams share.",
      cards: [
        { icon: "Navigation", name: "Beat plans & field sales", desc: "Assign daily beats, take orders on the visit screen with live stock and price, and capture collections and expenses on the spot." },
        { icon: "MapPin", name: "GPS-verified visits", desc: "Every check-in carries GPS, a selfie and a shop photo — outlet coverage you can actually prove, with full route replay." },
        { icon: "Share2", name: "Distributor & channel network", desc: "Bring every distributor onto the same system: their stock, pricing, ledgers, claims and invoices in one workflow." },
        { icon: "BarChart3", name: "Primary & secondary sales", desc: "See sell-in and sell-through side by side, by SKU, territory and outlet — no more month-end surprises." },
        { icon: "ReceiptText", name: "Schemes, pricing & claims", desc: "Configure trade schemes and price slabs, settle distributor claims cleanly, and protect margin with approval workflows." },
        { icon: "Landmark", name: "GST invoicing & e-way bills", desc: "Auto-generate GST invoices and e-way bills from orders — zero re-keying between field, channel and finance." },
      ],
    },
    workflow: {
      title: "From the salesman's beat to the ledger entry",
      lead: "The exact path an FMCG order takes through KaySetu — end to end, without a single re-entry.",
      steps: [
        { icon: "MapPin", label: "Beat visit" },
        { icon: "ReceiptText", label: "Field order" },
        { icon: "Share2", label: "Distributor allocation" },
        { icon: "Warehouse", label: "Stock dispatch" },
        { icon: "FileText", label: "GST invoice" },
        { icon: "BarChart3", label: "Sell-through insight" },
      ],
    },
    outcomes: {
      title: "What changes on the ground",
      lead: "The shifts FMCG teams feel in the first weeks on one connected platform.",
      metrics: [
        { value: "100%", label: "visits verified with GPS + selfie + photo" },
        { value: "Real-time", label: "primary & secondary sales visibility" },
        { value: "Zero", label: "double-entry from field order to GST invoice" },
        { value: "One", label: "system for field, distributor and finance" },
      ],
    },
    testimonial: {
      quote:
        "A lead-to-ledger flow means our field orders hit the distributor and the invoice without anyone re-typing them. We finally see sell-through by outlet, not just dispatch.",
      name: "Priya Nair",
      role: "VP · Sales",
      company: "Regional FMCG Distributor",
    },
    faqs: [
      { q: "Does KaySetu track both primary and secondary sales?", a: "Yes. KaySetu shows sell-in to your distributors and sell-through to retail outlets side by side — by SKU, territory and outlet — so you're never guessing what actually moved off the shelf." },
      { q: "Can it prevent fake field visits?", a: "Every outlet check-in is verified with GPS, a selfie and a shop photo, with route replay for the whole beat. Coverage is provable, not self-reported." },
      { q: "Can our distributors work in the same system?", a: "Yes — the distributor network module manages each distributor as a first-class entity with their own stock, pricing, ledger, claims and invoices, in the same platform your field team uses." },
      { q: "Does it handle trade schemes and claims?", a: "You can configure slab- and scheme-based pricing and settle distributor claims through an approval workflow — so margins are protected and claims aren't disputed." },
      { q: "Is invoicing GST-compliant with e-way bills?", a: "Yes. GST invoices and e-way bills generate straight from confirmed orders, with tax masters and HSN built in — no re-keying into a separate accounting tool." },
      { q: "Does the field team get a mobile app?", a: "Native Android and iOS apps let agents run their beat, take orders, check in and collect payments, syncing in real time with the office." },
    ],
    cta: { title: "See your FMCG business, unified.", body: industryCtaBody },
  },

  {
    slug: "distribution",
    icon: "Truck",
    name: "Distribution & Wholesale",
    eyebrow: "Distribution & Wholesale",
    tagline: "Order-to-dispatch, live stock, credit control and GST billing on one platform.",
    seo: {
      title: "Wholesale ERP | Distributor Management Software — KaySetu",
      description:
        "Run distribution and wholesale on one platform — distributor network, order-to-dispatch, multi-warehouse stock, credit control, e-way bills and GST.",
      keywords: [
        "distribution management software",
        "wholesale ERP software",
        "distributor management system India",
        "order to dispatch software",
        "wholesale billing software",
        "inventory management software",
        "credit control software",
        "e-way bill software",
        "GST billing distribution",
        "DMS software",
      ],
    },
    hero: {
      title: "Distribution that runs",
      titleAccent: "in real time.",
      subhead:
        "KaySetu connects your distributors, orders, warehouses and ledgers into one live system — so every order moves from request to dispatch to invoice without a single re-entry.",
      stats: [
        { value: "Real-time", label: "stock across every godown" },
        { value: "Live", label: "credit exposure & ageing" },
        { value: "Automated", label: "e-way bills & delivery notes" },
      ],
    },
    challenges: {
      title: "Where distribution margins leak",
      intro:
        "Distribution is a thin-margin, high-volume game. Every re-keyed order, blind stock position and unwatched credit line eats straight into the spread.",
      items: [
        { pain: "Orders on WhatsApp & phone", impact: "Missed, mis-keyed and impossible to audit" },
        { pain: "Stock unclear across godowns", impact: "Over-promising, stockouts and dead inventory" },
        { pain: "Credit & outstanding tracked by memory", impact: "Bad debt and over-exposed customers" },
        { pain: "Dispatch & delivery notes manual", impact: "Slow fulfilment and disputed deliveries" },
        { pain: "Distributor claims & returns messy", impact: "Month-end reconciliation nightmares" },
        { pain: "Billing separate from stock", impact: "Double-entry and mismatched books" },
      ],
    },
    capabilities: {
      title: "One system from order to dispatch to ledger",
      lead: "Every wholesale workflow, connected — so the field, the warehouse and accounts finally work off the same live data.",
      cards: [
        { icon: "Share2", name: "Distributor & customer network", desc: "Every distributor and retailer as a first-class account — own pricing, credit terms, ledger and full order history." },
        { icon: "ReceiptText", name: "Order to dispatch", desc: "Order approval chain, pick lists and delivery notes generated straight from the order — nothing re-keyed." },
        { icon: "Boxes", name: "Multi-warehouse inventory", desc: "Real-time stock across every godown and bin, with transfers, adjustments and a single stock ledger." },
        { icon: "Wallet", name: "Credit control & collections", desc: "Credit limits, ageing and outstanding tracked live — with collection reminders from the field." },
        { icon: "Truck", name: "Delivery & e-way bills", desc: "Delivery notes, dispatch tracking and e-way bills generated automatically from confirmed orders." },
        { icon: "Landmark", name: "GST billing & ledgers", desc: "GST invoices post automatically to customer, supplier and general ledgers — no re-keying into Tally." },
      ],
    },
    workflow: {
      title: "From stock request to settled ledger",
      lead: "One clean path for every wholesale order, from raised to reconciled.",
      steps: [
        { icon: "Contact", label: "Order raised" },
        { icon: "ClipboardCheck", label: "Approval" },
        { icon: "Warehouse", label: "Pick & pack" },
        { icon: "Truck", label: "Dispatch + e-way" },
        { icon: "FileText", label: "GST invoice" },
        { icon: "Wallet", label: "Collection" },
      ],
    },
    outcomes: {
      title: "What changes across the warehouse",
      lead: "The shifts wholesale teams feel once order, stock and accounts share one system.",
      metrics: [
        { value: "Real-time", label: "stock across every godown" },
        { value: "Zero", label: "re-entry from order to invoice" },
        { value: "Live", label: "credit exposure & ageing" },
        { value: "One", label: "ledger for the whole channel" },
      ],
    },
    testimonial: {
      quote:
        "Order-to-invoice time halved once the field, the warehouse and accounts stopped working off separate sheets. Credit exposure is finally something we watch live, not discover late.",
      name: "Sanjay Gupta",
      role: "Founder & CEO",
      company: "SME · Wholesale",
    },
    faqs: [
      { q: "Can KaySetu manage multiple warehouses and godowns?", a: "Yes — real-time stock across every warehouse and bin, with a single stock ledger, transfers, adjustments and committed-vs-available quantities honoured across sales." },
      { q: "Does it control credit limits and outstanding?", a: "Credit limits, ageing and outstanding balances are tracked live per customer, with collection follow-ups from the field, so you never over-expose a risky account." },
      { q: "Are e-way bills and delivery notes automated?", a: "Delivery notes and e-way bills generate straight from confirmed orders, and dispatch status is tracked all the way to delivery." },
      { q: "Can distributors and retailers place their own orders?", a: "Yes — bring them onto the same platform with their own pricing and ledger; their orders flow into the same approval and dispatch chain." },
      { q: "Does billing stay in sync with stock and accounts?", a: "Every GST invoice posts automatically to the stock ledger and the customer/general ledgers — one entry, no reconciliation between tools." },
      { q: "Is there a mobile app for field orders and collections?", a: "Native Android and iOS apps let your team take orders, check stock and record collections on the move, syncing in real time." },
    ],
    cta: { title: "See your distribution business, unified.", body: industryCtaBody },
  },

  {
    slug: "manufacturing",
    icon: "Factory",
    name: "Manufacturing",
    eyebrow: "Manufacturing",
    tagline: "BOM-driven production tied to real orders, procurement, stock and GST accounts.",
    seo: {
      title: "Manufacturing ERP | Production, Inventory & Sales — KaySetu",
      description:
        "Unify production, procurement, inventory, field sales and GST accounts — BOM-driven work orders, demand-linked planning and quote-to-cash in real time.",
      keywords: [
        "manufacturing ERP software India",
        "production management software",
        "BOM software",
        "work order management software",
        "material requirements planning",
        "procurement software",
        "inventory management manufacturing",
        "quote to cash software",
        "GST ERP for manufacturers",
        "job card tracking",
      ],
    },
    hero: {
      title: "From shop floor to sales order,",
      titleAccent: "one system.",
      subhead:
        "KaySetu ties demand to capacity — connecting BOM-driven production, procurement, inventory, field sales and accounts so plans match orders and nothing is built blind.",
      stats: [
        { value: "Demand-linked", label: "production, not guesswork" },
        { value: "3-way", label: "matched procurement" },
        { value: "Real-time", label: "raw, WIP & finished stock" },
      ],
    },
    challenges: {
      title: "What breaks when production runs blind",
      intro:
        "Manufacturing fails at the seams — between what sales promised, what the floor can build, and what the store actually holds. Disconnected tools hide those gaps until it's too late.",
      items: [
        { pain: "Production planned off gut feel", impact: "Shortages, overtime and constant firefighting" },
        { pain: "BOM & material needs in spreadsheets", impact: "Wrong purchases and stalled work orders" },
        { pain: "Stock, WIP & finished goods siloed", impact: "No true picture of what's actually available" },
        { pain: "Sales promises stock that isn't there", impact: "Missed delivery dates and unhappy customers" },
        { pain: "Procurement disconnected from demand", impact: "Excess inventory and cash locked up" },
        { pain: "Costing & GST reconciled month-end", impact: "No live view of margin or cash" },
      ],
    },
    capabilities: {
      title: "The whole plant-to-customer chain, connected",
      lead: "From the sales order to the finished good to the ledger entry — one system where demand, capacity and cash finally agree.",
      cards: [
        { icon: "Factory", name: "Production & work orders", desc: "BOM-driven work orders and job cards with operation-wise tracking and quality checkpoints." },
        { icon: "ClipboardCheck", name: "Planning tied to demand", desc: "Production plans that link real sales orders to capacity, with material requests auto-created from work orders." },
        { icon: "ShoppingCart", name: "Procurement", desc: "POs raised straight from material requests, a single supplier master, and GRN three-way matching before payment." },
        { icon: "Boxes", name: "Inventory & WIP", desc: "Real-time raw-material, work-in-progress and finished-goods stock across warehouses, with a full audit trail." },
        { icon: "Navigation", name: "Field sales & orders", desc: "Quote → order → dispatch from the field with live stock and price — so nobody over-promises." },
        { icon: "Landmark", name: "Costing & GST accounts", desc: "Costs, GST invoicing and ledgers post automatically, so margin and cash are visible in real time." },
      ],
    },
    workflow: {
      title: "From sales order to finished goods to invoice",
      lead: "One connected line from demand to dispatch — every step feeding the next.",
      steps: [
        { icon: "Contact", label: "Sales order" },
        { icon: "ClipboardCheck", label: "Production plan" },
        { icon: "ShoppingCart", label: "Material purchase" },
        { icon: "Factory", label: "Work order" },
        { icon: "Warehouse", label: "Finished goods" },
        { icon: "FileText", label: "Dispatch & invoice" },
      ],
    },
    outcomes: {
      title: "What changes on the floor",
      lead: "The shifts operations leaders feel once the plant and the office share one truth.",
      metrics: [
        { value: "Demand-linked", label: "production instead of guesswork" },
        { value: "Real-time", label: "raw material, WIP & FG stock" },
        { value: "3-way", label: "matched procurement before payment" },
        { value: "One", label: "system from floor to finance" },
      ],
    },
    testimonial: {
      quote:
        "Stock, production and accounts finally reconcile against each other instead of three spreadsheets that never agreed. Planning against real orders ended most of our firefighting.",
      name: "Anjali Rao",
      role: "Head of Operations",
      company: "Mid-size Manufacturer",
    },
    faqs: [
      { q: "Does KaySetu support BOM and work orders?", a: "Yes — bills of material per finished good (with sub-assemblies), plus work orders and job cards with operation-wise tracking and quality checkpoints." },
      { q: "Can production planning use real sales demand?", a: "Production plans tie actual sales orders to capacity, and material requests are auto-created from work orders so purchasing matches what's actually being built." },
      { q: "Does procurement connect to production needs?", a: "POs are raised straight from material requests, with a single supplier master and GRN three-way matching before any payment is made." },
      { q: "Can I see raw material, WIP and finished goods together?", a: "Yes — real-time stock across raw materials, work-in-progress and finished goods, in one ledger with a full audit trail." },
      { q: "Is it GST-ready for manufacturers?", a: "GST invoicing, tax masters and HSN are built in, and costs and taxes post automatically to your ledgers." },
      { q: "Does the sales team get live stock while quoting?", a: "Yes — field and inside sales quote and order against live stock and price, so you don't promise what you can't ship." },
    ],
    cta: { title: "See your plant and sales, unified.", body: industryCtaBody },
  },

  {
    slug: "pharma",
    icon: "Pill",
    name: "Pharma & Chemicals",
    eyebrow: "Pharma & Chemicals",
    tagline: "Batch and expiry traceability from production to the stockist, with GST billing.",
    seo: {
      title: "Pharma ERP | Batch, Expiry & Distribution — KaySetu",
      description:
        "Run pharma and chemicals on one platform — batch & expiry tracking, FEFO stock, distributor network, field reps, production QC and GST accounts.",
      keywords: [
        "pharma ERP software",
        "pharmaceutical distribution software",
        "batch and expiry management software",
        "chemical manufacturing ERP",
        "pharma SFA app",
        "medical representative app",
        "drug distribution management system",
        "FEFO inventory software",
        "GST billing pharma",
        "lot tracking software",
      ],
    },
    hero: {
      title: "Pharma & chemicals,",
      titleAccent: "batch-perfect and connected.",
      subhead:
        "KaySetu tracks every batch and expiry from production to the distributor's shelf — connecting field reps, channel, inventory and GST accounts in one compliant, real-time system.",
      stats: [
        { value: "Batch-wise", label: "traceability end to end" },
        { value: "FEFO", label: "picking & near-expiry alerts" },
        { value: "GST-ready", label: "batch, expiry & HSN on invoices" },
      ],
    },
    challenges: {
      title: "Where pharma & chemical operations get exposed",
      intro:
        "In pharma and chemicals, a lost batch number or a missed expiry isn't just margin — it's compliance and safety. Disconnected systems make traceability nearly impossible.",
      items: [
        { pain: "Batch & expiry tracked manually", impact: "Expired stock, recalls and compliance risk" },
        { pain: "Rep visits & sampling unverified", impact: "No proof of coverage or sample accountability" },
        { pain: "Distributor stock & returns opaque", impact: "Near-expiry dumping and disputed returns" },
        { pain: "Production & QC records scattered", impact: "Weak traceability and audit pain" },
        { pain: "Regulated handling untracked", impact: "Regulatory and safety exposure" },
        { pain: "Billing separate from batch data", impact: "Errors on GST, HSN and batch on invoices" },
      ],
    },
    capabilities: {
      title: "Compliance-grade control, end to end",
      lead: "Every unit traceable by batch and expiry — from the production floor to the stockist's shelf to the GST invoice.",
      cards: [
        { icon: "ShieldCheck", name: "Batch & expiry tracking", desc: "Every lot tracked by batch and expiry from production to dispatch, with FEFO picking and near-expiry alerts." },
        { icon: "Navigation", name: "Field & medical reps", desc: "Plan rep visits, verify with GPS + selfie, and record sampling and orders right from the visit screen." },
        { icon: "Share2", name: "Distributor & stockist network", desc: "Manage stockists as first-class accounts — batch-wise stock, returns, claims and ledgers in one workflow." },
        { icon: "Factory", name: "Production & QC", desc: "BOM-driven work orders with quality checkpoints and full batch traceability for audits." },
        { icon: "Boxes", name: "Inventory & FEFO", desc: "Real-time, batch-wise stock across warehouses with first-expiry-first-out picking and returns handling." },
        { icon: "Landmark", name: "GST billing with batch & HSN", desc: "Invoices carry batch, expiry and HSN automatically — GST-ready, with no re-keying." },
      ],
    },
    workflow: {
      title: "From production batch to compliant invoice",
      lead: "The traceable path every unit takes — batch intact at every step.",
      steps: [
        { icon: "Factory", label: "Batch produced" },
        { icon: "ClipboardCheck", label: "QC passed" },
        { icon: "Warehouse", label: "FEFO stock" },
        { icon: "Navigation", label: "Rep order" },
        { icon: "Share2", label: "Stockist dispatch" },
        { icon: "FileText", label: "Batch-wise invoice" },
      ],
    },
    outcomes: {
      title: "What changes for compliance",
      lead: "The shifts pharma and chemical teams feel once every batch is connected end to end.",
      metrics: [
        { value: "Batch-wise", label: "traceability from floor to stockist" },
        { value: "FEFO", label: "picking with near-expiry alerts" },
        { value: "GPS-verified", label: "rep visits & sampling" },
        { value: "GST-ready", label: "invoices with batch, expiry & HSN" },
      ],
    },
    testimonial: {
      quote:
        "Every unit is traceable by batch and expiry from the floor to the stockist, and near-expiry alerts ended most of our write-offs. Audits stopped being a fire drill.",
      name: "Rakesh Menon",
      role: "Director · Operations",
      company: "Pharma Distribution",
    },
    faqs: [
      { q: "Does KaySetu track batch numbers and expiry?", a: "Yes — every lot is tracked by batch and expiry from production through dispatch, with FEFO (first-expiry-first-out) picking and near-expiry alerts to cut write-offs." },
      { q: "Can invoices carry batch, expiry and HSN?", a: "GST invoices automatically include batch, expiry and HSN details, so compliance data is never re-keyed or missed." },
      { q: "Does it support medical and field rep workflows?", a: "Reps plan visits, check in with GPS and a selfie, and record sampling and orders from the visit screen — with real-time sync to the office." },
      { q: "How are stockist returns and near-expiry handled?", a: "Stockists are managed as first-class accounts with batch-wise stock, returns and claims in one workflow, so near-expiry stock is visible and actionable." },
      { q: "Is production traceable for audits?", a: "BOM-driven work orders carry quality checkpoints and full batch traceability, so you can trace any unit back through QC and materials." },
      { q: "Is it suitable for chemical distribution too?", a: "Yes — the same batch, inventory, channel and GST controls apply to chemical manufacturing and distribution." },
    ],
    cta: { title: "See your pharma business, unified.", body: industryCtaBody },
  },

  {
    slug: "cosmetics",
    icon: "Sparkles",
    name: "Cosmetics & Personal Care",
    eyebrow: "Cosmetics & Personal Care",
    tagline: "Omni-channel sell-through, shelf-life control and retail execution in one system.",
    seo: {
      title: "Cosmetics ERP + CRM | Retail & Distribution — KaySetu",
      description:
        "Unify cosmetics and personal-care sales — omni-channel distribution, retail execution, batch & shelf-life, field sales and GST accounts in real time.",
      keywords: [
        "cosmetics ERP software",
        "personal care distribution software",
        "beauty brand ERP",
        "retail execution software",
        "shelf life management software",
        "omni-channel distribution software",
        "field sales cosmetics",
        "modern trade management software",
        "GST billing beauty products",
        "SFA for cosmetics",
      ],
    },
    hero: {
      title: "Beauty brands that",
      titleAccent: "sell through, not just in.",
      subhead:
        "KaySetu connects your retail counters, distributors, modern trade and field team on one platform — with batch and shelf-life control, live sell-through and GST accounts in real time.",
      stats: [
        { value: "Verified", label: "counter & merchandising visits" },
        { value: "Omni-channel", label: "sell-through visibility" },
        { value: "FEFO", label: "shelf-life control on SKUs" },
      ],
    },
    challenges: {
      title: "What holds personal-care brands back",
      intro:
        "Cosmetics live and die on shelf presence, freshness and fast-moving trends. When channels and stock run on separate tools, hero SKUs stock out while slow lines quietly expire.",
      items: [
        { pain: "Counter & retail execution unverified", impact: "Poor shelf presence and lost visibility" },
        { pain: "Shelf-life & batch tracked manually", impact: "Expiry write-offs on sensitive stock" },
        { pain: "Sell-through invisible across channels", impact: "Over-produce slow SKUs, stock out heroes" },
        { pain: "Distributor & modern trade siloed", impact: "No single view of the channel" },
        { pain: "Schemes, gifting & returns messy", impact: "Margin leaks and reconciliation pain" },
        { pain: "Orders re-keyed into accounts", impact: "Delayed, error-prone GST billing" },
      ],
    },
    capabilities: {
      title: "One platform for every counter and channel",
      lead: "From the merchandiser's shelf photo to the GST invoice — every channel and every batch in one connected system.",
      cards: [
        { icon: "MapPin", name: "Retail & counter execution", desc: "GPS-verified merchandiser visits with shelf and planogram photos — proof of presence at every counter." },
        { icon: "ShieldCheck", name: "Batch & shelf-life", desc: "Batch-wise stock with FEFO picking and near-expiry alerts on shelf-life-sensitive SKUs." },
        { icon: "BarChart3", name: "Omni-channel sell-through", desc: "See sell-in vs. sell-through across general trade, modern trade, distributors and D2C in one view." },
        { icon: "Share2", name: "Distributor & MT network", desc: "Distributors and modern-trade accounts on one system — pricing, claims, returns and ledgers." },
        { icon: "ReceiptText", name: "Schemes, gifting & returns", desc: "Configure trade schemes and gift-with-purchase, and handle returns cleanly with approvals." },
        { icon: "Landmark", name: "GST invoicing & accounts", desc: "GST invoices and ledgers post automatically from orders — zero double-entry." },
      ],
    },
    workflow: {
      title: "From counter visit to sell-through insight",
      lead: "The path a personal-care order takes across every channel, without re-entry.",
      steps: [
        { icon: "MapPin", label: "Counter visit" },
        { icon: "ReceiptText", label: "Order & scheme" },
        { icon: "Share2", label: "Channel dispatch" },
        { icon: "Boxes", label: "Batch stock" },
        { icon: "FileText", label: "GST invoice" },
        { icon: "BarChart3", label: "Sell-through" },
      ],
    },
    outcomes: {
      title: "What changes at the shelf",
      lead: "The shifts beauty and personal-care teams feel with one channel and one truth.",
      metrics: [
        { value: "Verified", label: "counter & merchandising visits" },
        { value: "FEFO", label: "shelf-life control on sensitive SKUs" },
        { value: "Omni-channel", label: "sell-through visibility" },
        { value: "Zero", label: "double-entry to GST accounts" },
      ],
    },
    testimonial: {
      quote:
        "We finally see which SKUs sell through at each counter, not just what we shipped. Shelf-life alerts and one channel view cut both stockouts and write-offs.",
      name: "Kavya Reddy",
      role: "Head of Sales",
      company: "Personal Care Brand",
    },
    faqs: [
      { q: "Can KaySetu verify merchandiser and counter visits?", a: "Yes — merchandiser check-ins carry GPS, a selfie and shelf/planogram photos, so counter presence is provable, not self-reported." },
      { q: "Does it manage shelf-life and batch for sensitive SKUs?", a: "Batch-wise stock with FEFO picking and near-expiry alerts helps you move shelf-life-sensitive products before they expire." },
      { q: "Can I see sell-through across all channels?", a: "Yes — sell-in vs. sell-through across general trade, modern trade, distributors and D2C in a single view, by SKU and territory." },
      { q: "Does it handle schemes, gifting and returns?", a: "Configure trade schemes and gift-with-purchase, and process returns through an approval workflow to protect margin." },
      { q: "Is billing GST-ready?", a: "GST invoices and ledgers generate automatically from orders, so nothing is re-keyed into a separate accounting tool." },
      { q: "Is there a mobile app for the field team?", a: "Native Android and iOS apps let merchandisers and field reps check in, capture orders and photos, and sync in real time." },
    ],
    cta: { title: "See your beauty business, unified.", body: industryCtaBody },
  },

  {
    slug: "textiles",
    icon: "Shirt",
    name: "Textiles & Apparel",
    eyebrow: "Textiles & Apparel",
    tagline: "Style-size-colour matrix inventory across production, wholesale and retail.",
    seo: {
      title: "Textiles & Apparel ERP | Production to Retail — KaySetu",
      description:
        "Unify textiles and apparel — style/size/colour matrix inventory, production & job-work, wholesale and retail distribution, field sales and GST accounts.",
      keywords: [
        "textile ERP software",
        "apparel ERP India",
        "garment manufacturing software",
        "matrix inventory size colour",
        "apparel distribution software",
        "wholesale textile billing software",
        "production planning apparel",
        "job work management software",
        "GST ERP textiles",
        "fashion supply chain software",
      ],
    },
    hero: {
      title: "Textiles & apparel,",
      titleAccent: "thread to retail.",
      subhead:
        "KaySetu handles style, size and colour variants across production, wholesale and retail — connecting field sales, inventory and GST accounts in one real-time system.",
      stats: [
        { value: "Matrix", label: "stock by style, size & colour" },
        { value: "Order-linked", label: "production & job-work" },
        { value: "One", label: "view of wholesale & retail" },
      ],
    },
    challenges: {
      title: "Where textile & apparel businesses tangle up",
      intro:
        "Apparel means endless SKUs — styles, sizes, colours, seasons. Spreadsheets can't hold a size-colour matrix, so stock, orders and production drift out of sync.",
      items: [
        { pain: "Size-colour matrix in spreadsheets", impact: "Wrong stock counts and over-selling" },
        { pain: "Season & style demand guessed", impact: "Dead stock and stockouts by size" },
        { pain: "Production disconnected from orders", impact: "Late deliveries and missed seasons" },
        { pain: "Wholesale & retail on separate tools", impact: "No single view of the channel" },
        { pain: "Job-work & vendors untracked", impact: "Lost material and unclear costing" },
        { pain: "Billing separate from stock", impact: "GST errors and double-entry" },
      ],
    },
    capabilities: {
      title: "Built for style, size and colour",
      lead: "A system that actually holds a size-colour matrix — and ties it to production, channel and accounts.",
      cards: [
        { icon: "Boxes", name: "Variant (matrix) inventory", desc: "Track stock by style, size and colour across warehouses with a single real-time ledger." },
        { icon: "Factory", name: "Production & job-work", desc: "BOM-driven work orders and job-work tracking with operation-wise costing and quality checks." },
        { icon: "Navigation", name: "Wholesale field sales", desc: "Take orders by style and size from the field with live stock and price — no over-selling." },
        { icon: "Share2", name: "Wholesale & retail channel", desc: "Distributors, wholesalers and retail counters on one system — pricing, ledgers and returns." },
        { icon: "ClipboardCheck", name: "Order to dispatch", desc: "Order approval, pick lists and delivery notes generated straight from the order." },
        { icon: "Landmark", name: "GST billing & accounts", desc: "GST invoices and ledgers post automatically — one entry, from order to books." },
      ],
    },
    workflow: {
      title: "From style order to dispatched goods",
      lead: "One path from a size-colour order to a GST invoice — accurate at every step.",
      steps: [
        { icon: "Contact", label: "Style order" },
        { icon: "ClipboardCheck", label: "Production / job-work" },
        { icon: "Boxes", label: "Matrix stock" },
        { icon: "Warehouse", label: "Pick & pack" },
        { icon: "Truck", label: "Dispatch" },
        { icon: "FileText", label: "GST invoice" },
      ],
    },
    outcomes: {
      title: "What changes across the line",
      lead: "The shifts apparel teams feel once the matrix, the floor and the books agree.",
      metrics: [
        { value: "Matrix", label: "stock by style, size & colour" },
        { value: "Order-linked", label: "production & job-work" },
        { value: "One", label: "view of wholesale & retail" },
        { value: "Zero", label: "double-entry to GST books" },
      ],
    },
    testimonial: {
      quote:
        "A size-colour matrix that's actually accurate changed everything — sales stopped over-selling and production finally builds to real orders instead of last season's guess.",
      name: "Arjun Desai",
      role: "Director",
      company: "Apparel Wholesaler",
    },
    faqs: [
      { q: "Does KaySetu handle size-colour (matrix) inventory?", a: "Yes — stock is tracked by style, size and colour across every warehouse in one real-time ledger, so counts stay accurate and you don't oversell." },
      { q: "Can it manage job-work and outside vendors?", a: "Job-work and vendor operations are tracked with material issue/receipt and operation-wise costing, so nothing is lost and costing is clear." },
      { q: "Is production tied to real orders?", a: "BOM-driven work orders link to actual sales orders, so you build to demand rather than to a guess." },
      { q: "Can I sell wholesale and retail from one system?", a: "Distributors, wholesalers and retail counters live on the same platform, with their own pricing, ledgers and returns." },
      { q: "Is billing GST-compliant?", a: "GST invoices, tax masters and HSN are built in, and every invoice posts automatically to your ledgers." },
      { q: "Is there a mobile app for field order-taking?", a: "Native Android and iOS apps let your sales team take style-and-size orders against live stock, syncing in real time." },
    ],
    cta: { title: "See your apparel business, unified.", body: industryCtaBody },
  },

  {
    slug: "building-materials",
    icon: "HardHat",
    name: "Building Materials",
    eyebrow: "Building Materials",
    tagline: "Dealer & project sales, delivery, e-way bills and credit control on one platform.",
    seo: {
      title: "Building Materials ERP | Dealer & Project Sales — KaySetu",
      description:
        "Unify building materials — dealer & distributor network, project sales CRM, delivery & e-way bills, multi-depot inventory, credit control and GST.",
      keywords: [
        "building materials ERP",
        "cement and steel distribution software",
        "dealer management system",
        "project sales CRM",
        "construction supply ERP",
        "e-way bill software",
        "tiles sanitaryware distribution software",
        "GST billing building materials",
        "credit control software",
        "field sales construction materials",
      ],
    },
    hero: {
      title: "Building materials,",
      titleAccent: "dealer to job site.",
      subhead:
        "KaySetu connects your dealers, project sales, deliveries and accounts on one platform — with live stock, credit control, e-way bills and GST billing in real time.",
      stats: [
        { value: "One", label: "pipeline for project & dealer sales" },
        { value: "Automated", label: "e-way bills & delivery notes" },
        { value: "Real-time", label: "credit exposure & ageing" },
      ],
    },
    challenges: {
      title: "What weighs building-materials sales down",
      intro:
        "Building materials means heavy loads, long credit cycles, dealers and project sites. When orders, deliveries and credit run on separate books, cash and trust leak away.",
      items: [
        { pain: "Dealer orders on phone & paper", impact: "Mis-keyed orders and no audit trail" },
        { pain: "Project & dealer pipeline in memory", impact: "Lost enquiries and slow follow-up" },
        { pain: "Credit & outstanding untracked", impact: "Over-exposure and bad debt" },
        { pain: "Delivery & e-way bills manual", impact: "Slow, disputed dispatches" },
        { pain: "Stock across depots unclear", impact: "Over-promising heavy, high-value SKUs" },
        { pain: "Billing separate from stock", impact: "GST errors and double-entry" },
      ],
    },
    capabilities: {
      title: "From enquiry to delivered load",
      lead: "Project pipeline, dealer network, depot stock and accounts — one system from the first enquiry to the settled ledger.",
      cards: [
        { icon: "Contact", name: "Project & dealer CRM", desc: "Track project enquiries and dealer leads in one pipeline with follow-ups, so nothing goes cold." },
        { icon: "Share2", name: "Dealer & distributor network", desc: "Dealers and distributors as first-class accounts — pricing, credit terms and ledgers in one system." },
        { icon: "Truck", name: "Delivery & e-way bills", desc: "Delivery notes, dispatch tracking and e-way bills generated straight from confirmed orders." },
        { icon: "Boxes", name: "Multi-depot inventory", desc: "Real-time stock across depots and yards, with transfers and a single stock ledger." },
        { icon: "Wallet", name: "Credit control & collections", desc: "Credit limits, ageing and outstanding tracked live, with field collections and reminders." },
        { icon: "Landmark", name: "GST billing & accounts", desc: "GST invoices post automatically to ledgers — no re-keying between order, stock and books." },
      ],
    },
    workflow: {
      title: "From enquiry to delivered, invoiced load",
      lead: "One path for every dealer and project order — approved, loaded, delivered, collected.",
      steps: [
        { icon: "Contact", label: "Enquiry / dealer order" },
        { icon: "ClipboardCheck", label: "Approval & credit check" },
        { icon: "Warehouse", label: "Load from depot" },
        { icon: "Truck", label: "Delivery + e-way" },
        { icon: "FileText", label: "GST invoice" },
        { icon: "Wallet", label: "Collection" },
      ],
    },
    outcomes: {
      title: "What changes across the depot",
      lead: "The shifts building-materials teams feel once sales, dispatch and credit share one system.",
      metrics: [
        { value: "One", label: "pipeline for project & dealer sales" },
        { value: "Live", label: "stock across every depot" },
        { value: "Automated", label: "e-way bills & delivery notes" },
        { value: "Real-time", label: "credit exposure & ageing" },
      ],
    },
    testimonial: {
      quote:
        "My managers approve orders and credit from their phones and the depot sees it instantly. Deliveries, e-way bills and collections finally live in one place.",
      name: "Vikram Shah",
      role: "Regional Sales Director",
      company: "Building Materials",
    },
    faqs: [
      { q: "Can KaySetu manage both dealer and project sales?", a: "Yes — dealer orders and project enquiries live in one pipeline with follow-ups and a full 360° view, so leads don't go cold and orders stay auditable." },
      { q: "Are e-way bills and delivery notes automated?", a: "Delivery notes and e-way bills generate straight from confirmed orders, with dispatch tracked to delivery — important for heavy, high-value loads." },
      { q: "Does it control dealer credit and outstanding?", a: "Credit limits, ageing and outstanding are tracked live per dealer, with field collections and reminders, so you don't over-expose an account." },
      { q: "Can I see stock across multiple depots?", a: "Yes — real-time stock across every depot and yard, with transfers and a single stock ledger, so you don't over-promise heavy SKUs." },
      { q: "Is billing GST-compliant?", a: "GST invoices post automatically to your ledgers with tax masters and HSN built in — no re-keying between order, stock and books." },
      { q: "Is there a mobile app for the field team?", a: "Native Android and iOS apps let sales and collection teams work orders, credit and payments on site, syncing in real time." },
    ],
    cta: { title: "See your building-materials business, unified.", body: industryCtaBody },
  },

  {
    slug: "agri-inputs",
    icon: "Sprout",
    name: "Agri-Inputs",
    eyebrow: "Agri-Inputs",
    tagline: "Seasonal field sales, batch & expiry and liquidation tracking on one platform.",
    seo: {
      title: "Agri-Input ERP | Seeds, Fertilizer & Crop — KaySetu",
      description:
        "Unify agri-inputs — dealer & retailer network, seasonal field sales, batch & expiry, liquidation tracking and GST accounts on one real-time platform.",
      keywords: [
        "agri input ERP software",
        "fertilizer distribution software",
        "seed and pesticide dealer management",
        "agri SFA app",
        "crop protection distribution software",
        "batch expiry agri inputs",
        "seasonal demand planning software",
        "liquidation tracking software",
        "GST billing agri inputs",
        "field officer app agriculture",
      ],
    },
    hero: {
      title: "Agri-inputs,",
      titleAccent: "season to soil.",
      subhead:
        "KaySetu connects your dealers, retailers and field officers on one platform — with seasonal demand, batch and expiry, liquidation tracking and GST accounts in real time.",
      stats: [
        { value: "Batch-wise", label: "expiry control on inputs" },
        { value: "Sell-out", label: "(liquidation) visibility" },
        { value: "GPS-verified", label: "officer & dealer visits" },
      ],
    },
    challenges: {
      title: "What makes agri-input seasons hard",
      intro:
        "Agri-inputs are intensely seasonal, credit-heavy and batch-sensitive. When dealers, field officers and stock run on separate tools, you over-stock one season and stock out the next.",
      items: [
        { pain: "Seasonal demand guessed", impact: "Over-stock, expiry, and stockouts at peak" },
        { pain: "Field officer visits unverified", impact: "No proof of dealer/retailer coverage" },
        { pain: "Batch & expiry tracked manually", impact: "Expired agri-chem and compliance risk" },
        { pain: "Liquidation (sell-out) invisible", impact: "Stock stuck in the channel" },
        { pain: "Dealer credit & seasonal terms messy", impact: "Over-exposure across the cycle" },
        { pain: "Orders re-keyed into accounts", impact: "Delayed, error-prone GST billing" },
      ],
    },
    capabilities: {
      title: "Built for the agri-input season",
      lead: "From the field officer's beat to the farmer's sell-out — one system that respects the season, the batch and the credit cycle.",
      cards: [
        { icon: "Navigation", name: "Field officer & dealer visits", desc: "Plan officer beats, verify with GPS + selfie, and take dealer orders on the visit screen." },
        { icon: "ShieldCheck", name: "Batch & expiry", desc: "Batch-wise stock with FEFO picking and near-expiry alerts on seeds, fertiliser and crop protection." },
        { icon: "Share2", name: "Dealer & retailer network", desc: "Dealers and retailers on one system — pricing, seasonal credit, claims and ledgers." },
        { icon: "BarChart3", name: "Liquidation & sell-out", desc: "Track sell-in to dealers vs. liquidation to farmers, so seasonal stock doesn't get stuck." },
        { icon: "Wallet", name: "Seasonal credit & collections", desc: "Manage seasonal credit terms and outstanding live, with field collections and reminders." },
        { icon: "Landmark", name: "GST billing & accounts", desc: "GST invoices and ledgers post automatically from orders — zero double-entry." },
      ],
    },
    workflow: {
      title: "From season plan to farmer sell-out",
      lead: "One path from the officer's visit to the GST invoice — batch and season intact.",
      steps: [
        { icon: "Navigation", label: "Officer visit" },
        { icon: "ReceiptText", label: "Dealer order" },
        { icon: "ShieldCheck", label: "Batch dispatch" },
        { icon: "Share2", label: "Retailer stock" },
        { icon: "BarChart3", label: "Liquidation" },
        { icon: "FileText", label: "GST invoice" },
      ],
    },
    outcomes: {
      title: "What changes through the season",
      lead: "The shifts agri-input teams feel once channel, stock and season live in one system.",
      metrics: [
        { value: "Batch-wise", label: "expiry control on inputs" },
        { value: "Sell-out", label: "(liquidation) visibility to the farmer" },
        { value: "GPS-verified", label: "officer & dealer visits" },
        { value: "Season-ready", label: "credit & demand view" },
      ],
    },
    testimonial: {
      quote:
        "We can finally see liquidation to the farmer, not just dispatch to the dealer — so peak-season stock lands where it sells. Batch and expiry alerts cut our returns.",
      name: "Nitin Patel",
      role: "Managing Director",
      company: "Agri-Inputs",
    },
    faqs: [
      { q: "Does KaySetu track liquidation (retailer/farmer sell-out)?", a: "Yes — you see sell-in to dealers vs. liquidation to retailers and farmers, so seasonal stock doesn't get stuck in the channel." },
      { q: "Can it track batch and expiry on agri-chemicals?", a: "Batch-wise stock with FEFO picking and near-expiry alerts helps you move seeds, fertiliser and crop-protection stock before it expires." },
      { q: "Does it verify field officer visits?", a: "Officer check-ins carry GPS and a selfie, with dealer orders taken from the visit screen, so coverage is provable." },
      { q: "Can it manage seasonal dealer credit?", a: "Seasonal credit terms, limits and outstanding are tracked live, with field collections and reminders across the cycle." },
      { q: "Is billing GST-ready?", a: "GST invoices and ledgers generate automatically from orders, with tax masters and HSN built in — no re-keying." },
      { q: "Is there a mobile app for field officers?", a: "Native Android and iOS apps let officers plan beats, verify visits and take orders, syncing in real time." },
    ],
    cta: { title: "See your agri-input business, unified.", body: industryCtaBody },
  },
];

export function industryBySlug(slug: string): IndustryPage | undefined {
  return industryPages.find((i) => i.slug === slug);
}

export type ModulePage = {
  slug: string;
  // Lucide name resolved through <Icon />; keep in sync with the same module's
  // icon in content.ts `modules.items` so the homepage and the walkthrough
  // directory don't disagree about what a module looks like.
  icon: string;
  // Per-module search targeting. Module pages own *feature* intent
  // ("BOM software", "beat plan software"); the /industries pages own
  // *vertical* intent - keep the two sets from overlapping.
  seo: { title: string; description: string; keywords: string[] };
  hero: {
    kicker: string;
    title: string;
    lead: string;
  };
  walkthrough: {
    title: string;
    lead: string;
    steps: {
      n: number;
      icon: string;
      kicker: string;
      title: string;
      body: string;
      points: string[];
      screen: string;
    }[];
  };
};

// The 11 platform-registry modules, in registry order (TRACK → TA). Each
// walkthrough's steps must cover the module's full registry scope - the same
// coverage lines shown in the Modules nav menu (content.ts `platformMenu`).
export const modulePages: ModulePage[] = [
  {
    slug: "agent-live-tracking",
    icon: "MapPin",
    seo: {
      title: "GPS Employee Tracking App | Field Force | KaySetu",
      description:
        "Track your field team live: GPS-verified attendance, real-time territory map and full route replay. Fake visits become impossible. Web + mobile.",
      keywords: [
        "GPS employee tracking app",
        "field force tracking software",
        "geo attendance app",
        "route replay software",
        "live location tracking sales team",
        "field staff monitoring India",
      ],
    },
    hero: {
      kicker: "TRACK",
      title: "Agent Live Tracking",
      lead: "Real-time field force monitoring with GPS attendance, live map, route replay, and tracking health.",
    },
    walkthrough: {
      title: "See Live Tracking in Action",
      lead: "From starting the day to verifying every journey, see how we track the field force.",
      steps: [
        {
          n: 1,
          icon: "MapPin",
          kicker: "GPS Attendance",
          title: "GPS-Verified Check-ins",
          body: "Agents check in with their live location and a selfie. Fake check-ins are instantly flagged and blocked.",
          points: ["Geo-fenced attendance", "Selfie verification", "Time-stamped logs", "Anti-spoof checks"],
          screen: "field",
        },
        {
          n: 2,
          icon: "Navigation",
          kicker: "Live Map",
          title: "Real-time territory visibility",
          body: "Managers can see exactly where every agent is right now on a live interactive map.",
          points: ["Live agent dots", "Status filters (Active/Idle)", "Territory boundaries", "Idle & off-route alerts"],
          screen: "dashboard",
        },
        {
          n: 3,
          icon: "TrendingUp",
          kicker: "Route Replay",
          title: "Verify the day's journey",
          body: "Playback the exact route an agent took during the day to ensure optimal coverage and travel claims.",
          points: ["Path playback", "Stop durations", "Distance calculation", "Coverage analysis"],
          screen: "field",
        },
        {
          n: 4,
          icon: "ShieldCheck",
          kicker: "Tracking Health",
          title: "Trust every signal",
          body: "A health panel for the tracking itself: battery, network and GPS integrity for every device in the field.",
          points: ["Battery & network health", "GPS-spoofing flags", "Offline gap detection", "Device status reports"],
          screen: "mobile",
        },
      ],
    },
  },
  {
    slug: "field-sales-operations",
    icon: "Navigation",
    seo: {
      title: "Field Sales Automation Software | Beat Plan | KaySetu",
      description:
        "Run field sales end to end: beat planning, visit logging with photo proof, on-the-spot orders, collections, expenses and targets. Web + mobile.",
      keywords: [
        "field sales automation software",
        "beat plan software",
        "SFA app India",
        "sales force automation",
        "field visit tracking app",
        "field order collection app",
      ],
    },
    hero: {
      kicker: "FIELD",
      title: "Field Sales Operations",
      lead: "Beat plans, visit logging, field orders, collections, expenses, and targets in one field toolkit.",
    },
    walkthrough: {
      title: "Master the Field",
      lead: "Equip your on-the-ground team with everything they need to sell more, faster.",
      steps: [
        {
          n: 1,
          icon: "Calendar",
          kicker: "Beat Planning",
          title: "Optimized visit schedules",
          body: "Assign beat plans and schedules so agents know exactly who to visit and when.",
          points: ["Bulk beat assignment", "Route optimization", "Ad-hoc visit planning", "Visit compliance tracking"],
          screen: "mobile",
        },
        {
          n: 2,
          icon: "CheckSquare",
          kicker: "Visits",
          title: "Log visits with proof",
          body: "Agents log visit outcomes, capture shop photos, and record competitor activity right from the app.",
          points: ["Custom forms", "Photo capture", "Voice notes", "Competitor intel"],
          screen: "field",
        },
        {
          n: 3,
          icon: "Wallet",
          kicker: "Orders & Collections",
          title: "Sell and collect on the spot",
          body: "Field orders punched at the counter with live stock and pricing, and payment collections recorded in the same visit.",
          points: ["On-the-spot field orders", "Live stock & price checks", "Payment collections", "Digital receipts"],
          screen: "quote",
        },
        {
          n: 4,
          icon: "Target",
          kicker: "Expenses & Targets",
          title: "Claims filed, targets tracked",
          body: "Expense claims flow from the field into approvals, while targets track plan vs. achievement per agent, team and territory.",
          points: ["Field expense claims", "Approval workflows", "Agent & team targets", "Plan vs. achievement views"],
          screen: "dashboard",
        },
      ],
    },
  },
  {
    slug: "sales-orders-dispatch",
    icon: "ReceiptText",
    seo: {
      title: "Order Management Software | Order to Dispatch | KaySetu",
      description:
        "From field order to dispatch with zero re-entry: approval chains, warehouse pick lists, delivery notes and GST invoices in one connected flow.",
      keywords: [
        "order management software",
        "order to dispatch software",
        "sales order software India",
        "delivery note software",
        "warehouse pick list software",
        "order approval workflow software",
      ],
    },
    hero: {
      kicker: "ORDERS",
      title: "Sales Orders & Dispatch",
      lead: "Manage fulfillment with order approval chains, warehouse pick lists, delivery notes, and invoicing.",
    },
    walkthrough: {
      title: "Frictionless Fulfillment",
      lead: "Connect the field order directly to the warehouse floor without any data entry.",
      steps: [
        {
          n: 1,
          icon: "ClipboardCheck",
          kicker: "Approval Chain",
          title: "From raised to confirmed in a click",
          body: "Orders placed on the mobile app instantly appear in the manager's approval queue, checked against live stock and pricing rules.",
          points: ["Live stock check", "Custom pricing tiers", "Discount limits", "One-click approvals"],
          screen: "quote",
        },
        {
          n: 2,
          icon: "Truck",
          kicker: "Pick & Dispatch",
          title: "Pick, pack, and ship",
          body: "Approved orders generate warehouse pick lists and delivery notes automatically.",
          points: ["Pick lists", "Delivery notes", "Courier tracking", "Partial fulfillment"],
          screen: "inventory",
        },
        {
          n: 3,
          icon: "Receipt",
          kicker: "Invoicing",
          title: "Invoice without re-keying",
          body: "Dispatch closes into a GST-ready invoice generated straight from the order - nothing typed twice, every status pushed live.",
          points: ["GST invoices from orders", "Zero re-entry", "Credit notes", "Real-time order statuses"],
          screen: "dashboard",
        },
      ],
    },
  },
  {
    slug: "distribution-network",
    icon: "Share2",
    seo: {
      title: "Distributor Management System | DMS | KaySetu",
      description:
        "Run your whole distributor network on one platform: partner portal, product allocation, stock requests and invoicing with live visibility.",
      keywords: [
        "distributor management system",
        "DMS software India",
        "distributor portal software",
        "channel partner management software",
        "stock request management",
        "distributor invoicing software",
      ],
    },
    hero: {
      kicker: "DIST",
      title: "Distribution Network",
      lead: "Handle distributor profiles, product allocations, stock requests, and invoicing for external partners.",
    },
    walkthrough: {
      title: "Your Channel, One System",
      lead: "Give distributors a portal of their own while you keep full visibility of the channel.",
      steps: [
        {
          n: 1,
          icon: "Share2",
          kicker: "Distributors",
          title: "Distributor self-service portal",
          body: "Distributors log in, view their specific pricing, and place stock requests directly - each one a first-class entity with its own ledger.",
          points: ["Custom price lists", "Live stock view", "Order history", "Ledger statements"],
          screen: "mobile",
        },
        {
          n: 2,
          icon: "Boxes",
          kicker: "Allocation",
          title: "Allocate products per partner",
          body: "Control exactly which products, prices and schemes each distributor sees, and watch channel stock in real time.",
          points: ["Per-distributor allocation", "Territory mapping", "Scheme & pricing control", "Channel stock visibility"],
          screen: "inventory",
        },
        {
          n: 3,
          icon: "ArrowRightLeft",
          kicker: "Requests & Invoices",
          title: "Stock request to distributor invoice",
          body: "Stock requests flow through approval and dispatch, closing into distributor invoices with adjustments and returns handled in the same workflow.",
          points: ["Stock request workflow", "Approval & dispatch", "Distributor invoicing", "Adjustments & returns"],
          screen: "quote",
        },
      ],
    },
  },
  {
    slug: "inventory-warehouse",
    icon: "Boxes",
    seo: {
      title: "Multi-Warehouse Inventory Software | Stock | KaySetu",
      description:
        "Real-time stock across every location: live inventory ledger, adjustments and inter-warehouse transfers. Never oversell or run out again.",
      keywords: [
        "multi warehouse inventory software",
        "real-time stock ledger",
        "inventory management software India",
        "stock transfer software",
        "warehouse management system",
        "stock adjustment software",
      ],
    },
    hero: {
      kicker: "INV",
      title: "Inventory & Warehouse",
      lead: "Track physical stock across locations with a real-time ledger, adjustments, and seamless transfers.",
    },
    walkthrough: {
      title: "Complete Stock Control",
      lead: "Never oversell or run out of stock with real-time, multi-warehouse visibility.",
      steps: [
        {
          n: 1,
          icon: "Boxes",
          kicker: "Stock Ledger",
          title: "Real-time stock ledger",
          body: "Every item movement is recorded in a unified ledger across all warehouses, giving you a live view of available stock.",
          points: ["Multi-warehouse", "Batch tracking", "Expiry management", "Low-stock alerts"],
          screen: "inventory",
        },
        {
          n: 2,
          icon: "Scan",
          kicker: "Adjustments",
          title: "Adjust with a full audit trail",
          body: "Damage, counts and corrections are posted as reason-coded adjustments, so the ledger always explains itself.",
          points: ["Reason-coded adjustments", "Cycle counts", "Full audit trail", "Discrepancy reports"],
          screen: "dashboard",
        },
        {
          n: 3,
          icon: "ArrowRightLeft",
          kicker: "Transfers",
          title: "Seamless location transfers",
          body: "Move stock between warehouses or vans with a simple request and approval workflow.",
          points: ["Stock requests", "In-transit tracking", "Approval chains", "Warehouse & van moves"],
          screen: "field",
        },
      ],
    },
  },
  {
    slug: "production",
    icon: "Factory",
    seo: {
      title: "BOM Software India | Work Orders & Job Cards | KaySetu",
      description:
        "Run the factory floor off real sales demand: bills of material, work orders, job cards and production planning tied to live stock levels.",
      keywords: [
        "BOM software India",
        "work order management software",
        "job card software",
        "production planning software",
        "bill of materials software",
        "production management system",
      ],
    },
    hero: {
      kicker: "PROD",
      title: "Production",
      lead: "Streamline manufacturing with Bills of Materials (BOM), work orders, job cards, and planning.",
    },
    walkthrough: {
      title: "Manufacturing Made Simple",
      lead: "Connect your sales demand directly to your factory floor capacity.",
      steps: [
        {
          n: 1,
          icon: "Factory",
          kicker: "BOM",
          title: "Bills of Material",
          body: "Define exact recipes and material requirements for every finished good.",
          points: ["Multi-level BOMs", "Scrap percentages", "Routing steps", "Costing rollups"],
          screen: "inventory",
        },
        {
          n: 2,
          icon: "ClipboardCheck",
          kicker: "Work Orders & Job Cards",
          title: "Run the floor, operation by operation",
          body: "Work orders break into operation-wise job cards, so you always know what's on which machine and what's blocked.",
          points: ["Work orders from demand", "Operation-wise job cards", "Floor status tracking", "Material issue & returns"],
          screen: "dashboard",
        },
        {
          n: 3,
          icon: "TrendingUp",
          kicker: "Planning",
          title: "Plan production off real demand",
          body: "Production planning ties confirmed orders to capacity and live stock, auto-raising material requests for what's short.",
          points: ["Demand-driven planning", "Capacity view", "Auto material requests", "Shortage alerts"],
          screen: "quote",
        },
      ],
    },
  },
  {
    slug: "procurement",
    icon: "ShoppingCart",
    seo: {
      title: "Purchase Order Software | Procurement ERP | KaySetu",
      description:
        "Purchasing that triggers itself from low-stock alerts and production demand, with supplier masters, purchase orders and GRN matching in one place.",
      keywords: [
        "purchase order software",
        "procurement management software",
        "GRN software",
        "supplier management software",
        "vendor management system",
        "raw material purchase software",
      ],
    },
    hero: {
      kicker: "PURCH",
      title: "Procurement",
      lead: "Manage suppliers, material requests, purchase orders (POs), and GRN-based receiving.",
    },
    walkthrough: {
      title: "Smarter Sourcing",
      lead: "Automate your purchasing based on low stock alerts and production demand.",
      steps: [
        {
          n: 1,
          icon: "Store",
          kicker: "Suppliers & Requests",
          title: "One supplier master, clean requests",
          body: "Every supplier lives in a single master with GST, terms and price history, while material requests flow in from stores and production.",
          points: ["Single supplier master", "GST, terms & contacts", "Price history", "Material requests from demand"],
          screen: "leads",
        },
        {
          n: 2,
          icon: "ShoppingCart",
          kicker: "Purchase Orders",
          title: "POs raised in seconds",
          body: "Generate POs automatically from material requests and send them to suppliers through approval chains.",
          points: ["Auto-PO from requests", "Approval chains", "Rate comparison", "Delivery schedules"],
          screen: "quote",
        },
        {
          n: 3,
          icon: "BadgeCheck",
          kicker: "GRN",
          title: "Receive against the PO",
          body: "GRN-based receiving matches goods, PO and bill before payment, and posts stock the moment it lands.",
          points: ["GRN-based receiving", "Three-way matching", "Quality checks", "Instant stock update"],
          screen: "inventory",
        },
      ],
    },
  },
  {
    slug: "accounts-finance",
    icon: "Landmark",
    seo: {
      title: "GST Billing Software | Ledgers & Invoicing | KaySetu",
      description:
        "Every transaction flows straight into the ledger: GST-ready invoices, vendor bills, payments, banking and reconciliation with zero double-entry.",
      keywords: [
        "GST billing software",
        "GST invoicing software India",
        "accounting ERP software",
        "ledger management software",
        "vendor bill software",
        "GST compliance software",
      ],
    },
    hero: {
      kicker: "BOOKS",
      title: "Accounts & Finance",
      lead: "Ledgers, invoices, bills and payments, with a built-in GST hub and banking.",
    },
    walkthrough: {
      title: "Integrated Ledger",
      lead: "Every transaction across the platform flows automatically into the general ledger.",
      steps: [
        {
          n: 1,
          icon: "Landmark",
          kicker: "Ledgers",
          title: "Books that write themselves",
          body: "Customer, supplier and general ledgers post automatically from sales, purchases and dispatches - always current, never re-keyed.",
          points: ["Customer & supplier ledgers", "Auto-posting from operations", "Drill-down to every voucher", "Always up to date"],
          screen: "dashboard",
        },
        {
          n: 2,
          icon: "Receipt",
          kicker: "Invoices & Payments",
          title: "Invoices, bills and payments in one flow",
          body: "Generate compliant tax invoices from sales orders, record vendor bills and settle both sides with tracked payments.",
          points: ["GST-ready invoicing", "Vendor bills", "Payment recording", "Credit notes"],
          screen: "quote",
        },
        {
          n: 3,
          icon: "Percent",
          kicker: "GST Hub & Banking",
          title: "Compliance and cash, together",
          body: "The built-in GST hub keeps taxes, HSN and returns data ready, while banking and reconciliation close the loop on cash.",
          points: ["GST hub & returns data", "HSN & tax masters", "Banking & reconciliation", "E-invoicing"],
          screen: "dashboard",
        },
      ],
    },
  },
  {
    slug: "leads-pipeline",
    icon: "Contact",
    seo: {
      title: "Sales Pipeline CRM India | Lead Management | KaySetu",
      description:
        "Capture every lead, move deals through a visual funnel and automate follow-ups with a CRM that shares live data with your ERP, not a separate silo.",
      keywords: [
        "sales pipeline CRM India",
        "lead management software",
        "sales funnel software",
        "CRM for field sales",
        "follow up automation CRM",
        "opportunity management software",
      ],
    },
    hero: {
      kicker: "CRM",
      title: "Leads & Pipeline",
      lead: "Capture and track leads, monitor opportunities through the sales funnel, and manage automated follow-ups.",
    },
    walkthrough: {
      title: "Close More Deals",
      lead: "Never let a lead slip through the cracks with our unified CRM pipeline.",
      steps: [
        {
          n: 1,
          icon: "Contact",
          kicker: "Leads",
          title: "All leads in one place",
          body: "Web inquiries, field leads, and marketing campaigns flow into a single dashboard.",
          points: ["Auto-routing", "Lead scoring", "Duplicate detection", "Custom tags"],
          screen: "leads",
        },
        {
          n: 2,
          icon: "Target",
          kicker: "Funnel",
          title: "Visual funnel management",
          body: "Drag and drop opportunities through stages to keep the whole team aligned on deal status.",
          points: ["Kanban boards", "Stage conversion rates", "Expected revenue", "Win/Loss analysis"],
          screen: "dashboard",
        },
        {
          n: 3,
          icon: "Bell",
          kicker: "Follow-ups",
          title: "Nothing goes cold",
          body: "Next-action prompts and automated reminders keep every deal moving, with real-time alerts the moment a lead is added, claimed or won.",
          points: ["Next-action prompts", "Automated reminders", "Activity timeline", "Instant win alerts"],
          screen: "mobile",
        },
      ],
    },
  },
  {
    slug: "attendance-leave",
    icon: "CalendarCheck",
    seo: {
      title: "Attendance Management Software | Leave & HR | KaySetu",
      description:
        "Attendance for office and field teams in one system: geo-verified check-ins, leave request workflows and a shared company holiday calendar.",
      keywords: [
        "attendance management software",
        "leave management system",
        "employee attendance app India",
        "HR software for SME",
        "leave approval workflow",
        "holiday calendar software",
      ],
    },
    hero: {
      kicker: "ATT",
      title: "Attendance & Leave",
      lead: "Manage office attendance, process leave requests, and maintain the company holiday calendar.",
    },
    walkthrough: {
      title: "Team Management",
      lead: "Simple HR tools designed to keep your office and field teams aligned.",
      steps: [
        {
          n: 1,
          icon: "Clock",
          kicker: "Office Attendance",
          title: "Check-in for every desk",
          body: "Office teams punch in from web or mobile, with late-marks and shift timings tracked automatically alongside the field force.",
          points: ["Web & mobile check-in", "Late-mark tracking", "Shift timings", "Attendance reports"],
          screen: "dashboard",
        },
        {
          n: 2,
          icon: "CalendarCheck",
          kicker: "Leave Management",
          title: "Leave workflows",
          body: "Employees request leave, check balances, and get manager approvals in the app.",
          points: ["Leave balances", "Custom leave types", "Approval workflows", "Auto-deductions"],
          screen: "mobile",
        },
        {
          n: 3,
          icon: "Calendar",
          kicker: "Holidays",
          title: "One holiday calendar for everyone",
          body: "The company holiday calendar keeps every team and region on the same page, feeding straight into attendance and leave math.",
          points: ["Company holiday calendar", "Region-wise calendars", "Year planner", "Team-wide visibility"],
          screen: "leads",
        },
      ],
    },
  },
  {
    slug: "travel-allowance",
    icon: "Plane",
    seo: {
      title: "Travel Expense Management Software | TA/DA | KaySetu",
      description:
        "GPS measures the distance, so TA/DA settles itself, with automated travel expense claims with approval chains and a full audit trail. No odometer arguments.",
      keywords: [
        "travel expense management software",
        "TA DA software",
        "field expense claim app",
        "GPS distance travel claim",
        "employee reimbursement software",
        "expense approval workflow",
      ],
    },
    hero: {
      kicker: "TA",
      title: "Travel Allowance",
      lead: "Automate travel expense claims using GPS-auto distance calculations and approval chains.",
    },
    walkthrough: {
      title: "Automated Expenses",
      lead: "Stop arguing over odometer readings. GPS handles it all.",
      steps: [
        {
          n: 1,
          icon: "Plane",
          kicker: "GPS-Auto Claims",
          title: "Auto-calculated distances",
          body: "The app calculates exact travel distance based on the GPS route, generating perfect TA claims.",
          points: ["GPS-auto distance", "Per-km rates", "Expense uploads", "Zero odometer disputes"],
          screen: "field",
        },
        {
          n: 2,
          icon: "ClipboardCheck",
          kicker: "Approval Chain",
          title: "Claim to payout, audited",
          body: "Every claim moves through a manager approval chain with policy limits enforced and a full audit trail behind it.",
          points: ["Manager approval chain", "Policy limits", "Full audit trail", "Payout-ready reports"],
          screen: "mobile",
        },
      ],
    },
  },
];

export type ModulePage = {
  slug: string;
  // Lucide name resolved through <Icon />; keep in sync with the same module's
  // icon in content.ts `modules.items` so the homepage and the walkthrough
  // directory don't disagree about what a module looks like.
  icon: string;
  // Per-module search targeting. Module pages own *feature* intent
  // ("BOM software", "beat plan software"); the /industries pages own
  // *vertical* intent — keep the two sets from overlapping.
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
      lead: "Real-time field force monitoring with GPS attendance, live map, and route replay.",
    },
    walkthrough: {
      title: "See Live Tracking in Action",
      lead: "From starting the day to verifying visits, see how we track the field force.",
      steps: [
        {
          n: 1,
          icon: "MapPin",
          kicker: "Attendance",
          title: "GPS-Verified Check-ins",
          body: "Agents check in with their live location and a selfie. Fake check-ins are instantly flagged and blocked.",
          points: ["Geo-fenced attendance", "Selfie verification", "Time-stamped logs", "Leave tracking"],
          screen: "field",
        },
        {
          n: 2,
          icon: "Navigation",
          kicker: "Live Map",
          title: "Real-time territory visibility",
          body: "Managers can see exactly where every agent is right now on a live interactive map.",
          points: ["Live agent dots", "Status filters (Active/Idle)", "Territory boundaries", "Battery & network health"],
          screen: "dashboard",
        },
        {
          n: 3,
          icon: "TrendingUp",
          kicker: "Route Replay",
          title: "Verify the day's journey",
          body: "Playback the exact route an agent took during the day to ensure optimal coverage and travel claims.",
          points: ["Path playback", "Stop durations", "Speed analysis", "Distance calculation"],
          screen: "leads",
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
        "Run field sales end to end: beat planning, visit logging with photo proof, on-the-spot orders, collections and expense claims. Web + mobile.",
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
      lead: "Tools for beat planning, visit logging, field orders, collections, and expense management.",
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
          kicker: "Execution",
          title: "Log visits with proof",
          body: "Agents log visit outcomes, capture shop photos, and record competitor activity right from the app.",
          points: ["Custom forms", "Photo capture", "Voice notes", "Competitor intel"],
          screen: "field",
        }
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
          kicker: "Capture",
          title: "All leads in one place",
          body: "Web inquiries, field leads, and marketing campaigns flow into a single dashboard.",
          points: ["Auto-routing", "Lead scoring", "Duplicate detection", "Custom tags"],
          screen: "leads",
        },
        {
          n: 2,
          icon: "Target",
          kicker: "Pipeline",
          title: "Visual funnel management",
          body: "Drag and drop leads through stages to keep the whole team aligned on deal status.",
          points: ["Kanban boards", "Stage conversion rates", "Expected revenue", "Win/Loss analysis"],
          screen: "dashboard",
        }
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
          icon: "ReceiptText",
          kicker: "Order",
          title: "Instant field orders",
          body: "Orders placed on the mobile app instantly appear in the manager's approval queue.",
          points: ["Live stock check", "Custom pricing tiers", "Discount limits", "Auto-calculation"],
          screen: "quote",
        },
        {
          n: 2,
          icon: "Truck",
          kicker: "Dispatch",
          title: "Pick, pack, and ship",
          body: "Approved orders generate warehouse pick lists and delivery challans automatically.",
          points: ["Pick lists", "Delivery notes", "Courier tracking", "Partial fulfillment"],
          screen: "inventory",
        }
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
          kicker: "Ledger",
          title: "Real-time stock ledger",
          body: "Every item movement is recorded in a unified ledger, giving you a live view of available stock.",
          points: ["Multi-warehouse", "Batch tracking", "Expiry management", "Low-stock alerts"],
          screen: "inventory",
        },
        {
          n: 2,
          icon: "ArrowRightLeft",
          kicker: "Transfers",
          title: "Seamless location transfers",
          body: "Move stock between warehouses or vans with a simple request and approval workflow.",
          points: ["Stock requests", "In-transit tracking", "Discrepancy logs", "Approval chains"],
          screen: "field",
        }
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
        }
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
      lead: "Manage raw material purchasing, supplier databases, purchase orders (POs), and GRNs.",
    },
    walkthrough: {
      title: "Smarter Sourcing",
      lead: "Automate your purchasing based on low stock alerts and production demand.",
      steps: [
        {
          n: 1,
          icon: "ShoppingCart",
          kicker: "POs",
          title: "Purchase Orders",
          body: "Generate POs automatically from material requests and send them to suppliers.",
          points: ["Supplier database", "Price history", "Auto-PO generation", "Approval chains"],
          screen: "quote",
        }
      ],
    },
  },
  {
    slug: "accounts-finance",
    icon: "Landmark",
    seo: {
      title: "GST Billing Software | Ledgers & Invoicing | KaySetu",
      description:
        "Every transaction flows straight into the ledger: GST-ready invoices, vendor bills, payments and reconciliation with zero double-entry.",
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
      lead: "Track ledgers, handle invoices and vendor bills, record payments, and manage GST compliance.",
    },
    walkthrough: {
      title: "Integrated Ledger",
      lead: "Every transaction across the platform flows automatically into the general ledger.",
      steps: [
        {
          n: 1,
          icon: "Landmark",
          kicker: "Invoicing",
          title: "GST-Ready Invoices",
          body: "Generate compliant tax invoices directly from sales orders with zero manual entry.",
          points: ["E-invoicing", "GST calculations", "Credit notes", "Payment links"],
          screen: "dashboard",
        }
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
      title: "Partner Portal",
      lead: "Give your distributors a dedicated portal to place orders and check stock.",
      steps: [
        {
          n: 1,
          icon: "Share2",
          kicker: "Portal",
          title: "Distributor Self-Service",
          body: "Distributors can log in, view their specific pricing, and place stock requests directly.",
          points: ["Custom price lists", "Live stock view", "Order history", "Ledger statements"],
          screen: "mobile",
        }
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
      kicker: "HR",
      title: "Attendance & Leave",
      lead: "Manage office attendance, process leave requests, and maintain the company holiday calendar.",
    },
    walkthrough: {
      title: "Team Management",
      lead: "Simple HR tools designed to keep your office and field teams aligned.",
      steps: [
        {
          n: 1,
          icon: "CalendarCheck",
          kicker: "Leave",
          title: "Leave Workflows",
          body: "Employees can request leave, check balances, and get manager approvals in the app.",
          points: ["Leave balances", "Custom leave types", "Holiday calendars", "Auto-deductions"],
          screen: "leads",
        }
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
          kicker: "Claims",
          title: "Auto-calculated distances",
          body: "The app calculates exact travel distance based on the GPS route, generating perfect TA claims.",
          points: ["GPS distance", "Per-km rates", "Expense uploads", "Manager approval"],
          screen: "field",
        }
      ],
    },
  },
  {
    slug: "insights-reports",
    icon: "BarChart3",
    seo: {
      title: "Sales Analytics Dashboard | Business Reports | KaySetu",
      description:
        "Custom dashboards built on live data from every module: drag-and-drop report builder, scheduled emails, Excel export and role-based access.",
      keywords: [
        "sales analytics dashboard",
        "business reporting software",
        "custom report builder software",
        "ERP dashboard software",
        "MIS reporting software India",
        "real-time business intelligence SME",
      ],
    },
    hero: {
      kicker: "BI",
      title: "Insights & Reports",
      lead: "Customizable dashboards and reports that pull data from every module.",
    },
    walkthrough: {
      title: "Command Center",
      lead: "Make better decisions with real-time data from across the entire business.",
      steps: [
        {
          n: 1,
          icon: "BarChart3",
          kicker: "Reports",
          title: "Drag-and-drop builder",
          body: "Build custom reports by mixing sales, inventory, and finance data.",
          points: ["Custom widgets", "Scheduled emails", "Export to Excel", "Role-based access"],
          screen: "dashboard",
        }
      ],
    },
  }
];

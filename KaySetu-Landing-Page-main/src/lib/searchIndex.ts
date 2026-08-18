import { modules, industries } from "@/lib/content";

export type SearchEntry = {
  title: string;
  href: string;
  /** Grouping label shown beside the result. */
  kind: "Module" | "Industry" | "Page";
  icon: string;
  /** Extra words matched against but not displayed. */
  keywords: string;
};

/* Static routes under src/app. Kept here rather than derived at runtime because
   the nav is a client component and has no filesystem access. */
const pages: SearchEntry[] = [
  { title: "Packages", href: "/packages", kind: "Page", icon: "LayoutGrid", keywords: "pricing plans bundles modules P1 P2 P3 P4 P5 P6 P7 P8 add-ons enterprise" },
  { title: "Industries", href: "/industries", kind: "Page", icon: "Building2", keywords: "verticals sectors" },
  { title: "Contact", href: "/contact", kind: "Page", icon: "Mail", keywords: "sales enquiry support talk demo" },
  { title: "About", href: "/about", kind: "Page", icon: "Info", keywords: "company team kayease story" },
  { title: "Careers", href: "/careers", kind: "Page", icon: "Briefcase", keywords: "jobs hiring openings work" },
  { title: "Privacy Policy", href: "/privacy", kind: "Page", icon: "ShieldCheck", keywords: "data gdpr legal" },
  { title: "Terms of Service", href: "/terms", kind: "Page", icon: "FileText", keywords: "legal agreement" },
];

export const searchIndex: SearchEntry[] = [
  ...modules.items.map((m) => ({
    title: m.name,
    href: `/modules?module=${m.slug}`,
    kind: "Module" as const,
    icon: m.icon,
    keywords: m.desc,
  })),
  ...industries.items.map((i) => ({
    title: i.name,
    href: `/industries/${i.slug}`,
    kind: "Industry" as const,
    icon: i.icon,
    keywords: i.slug.replace(/-/g, " "),
  })),
  ...pages,
];

/**
 * Ranks title matches above keyword matches, and prefix matches above
 * mid-word ones, so typing "inv" surfaces "Inventory & Warehouse" before a
 * module that merely mentions inventory in its description.
 */
export function searchSite(query: string, limit = 7): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return searchIndex
    .map((entry) => {
      const title = entry.title.toLowerCase();
      let score = 0;
      if (title.startsWith(q)) score = 100;
      else if (title.includes(q)) score = 70;
      else if (`${entry.keywords}`.toLowerCase().includes(q)) score = 30;
      // Shorter titles win ties: "Production" over "Sales Orders & Dispatch".
      return { entry, score: score ? score - title.length / 100 : 0 };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry);
}

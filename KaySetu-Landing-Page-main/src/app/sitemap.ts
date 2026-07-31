import type { MetadataRoute } from "next";
import { industryPages } from "@/lib/content";
import { modulePages } from "@/lib/modulePages";

const BASE = "https://kaysetu.kayease.com";

// Stamped at build time so it can't go stale the way a hardcoded date does.
const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const industryRoutes: MetadataRoute.Sitemap = industryPages.map((i) => ({
    url: `${BASE}/industries/${i.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const moduleRoutes: MetadataRoute.Sitemap = modulePages.map((m) => ({
    url: `${BASE}/platform/${m.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    { url: `${BASE}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/industries`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    ...industryRoutes,
    { url: `${BASE}/walkthrough`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    ...moduleRoutes,
    { url: `${BASE}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/contact`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/careers`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}

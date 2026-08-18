import { redirect } from "next/navigation";
import { modulePages } from "@/lib/modulePages";

// Only the known modules render; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return modulePages.map((page) => ({
    slug: page.slug,
  }));
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/modules?module=${slug}`);
}

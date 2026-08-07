"use client";
/**
 * Entitlement guard — blocks pages whose sellable module the tenant hasn't bought.
 *
 * The sidebar already hides non-entitled modules, but nothing stopped a typed
 * URL, bookmark or deep link: every such page rendered in full and then filled
 * with 403s. This guard closes that hole for all routes at once.
 *
 * Runs INSIDE AuthGuard, so the user is authenticated and org context is loaded.
 * Fails OPEN: if entitlements are unknown (older session with no cached org
 * context, or an unlisted route) the page renders as before.
 */
import { usePathname } from "next/navigation";
import { authService } from "@/lib/auth-service";
import { moduleForPath } from "@/lib/route-modules";
import ModuleLocked from "./ModuleLocked";

export default function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const required = moduleForPath(pathname || "/");

  // Unlisted / foundation route → always allowed.
  if (!required) return <>{children}</>;

  // Fail open when we have no entitlement list to judge against.
  const modules = authService.getOrgContext()?.modules;
  if (!modules || modules.length === 0) return <>{children}</>;

  return modules.includes(required) ? <>{children}</> : <ModuleLocked module={required} />;
}

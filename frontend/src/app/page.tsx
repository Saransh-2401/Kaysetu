import { redirect } from "next/navigation";

/**
 * This app is the SuperAdmin ops console only. The public site and tenant
 * sign-in live in the separate portal app (app.kaysetu.kayease.com), so the
 * ops domain must never offer a tenant-facing landing or login.
 */
export default function RootPage() {
  redirect("/ops/login");
}

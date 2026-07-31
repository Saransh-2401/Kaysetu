import { redirect } from "next/navigation";

/**
 * app.kaysetu.in is the tenant dashboard, not a website.
 *
 * The marketing site now lives on its own domain (kaysetu.in), so this root
 * used to be a second, competing landing page. It redirects straight to
 * sign-in; AuthGuard treats "/login" as public and routes the user on to their
 * role's dashboard once they authenticate.
 */
export default function RootPage() {
  redirect("/login");
}

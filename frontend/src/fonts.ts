// Fonts for the ops console, loaded via next/font (build-time, self-hosted).
// Matches the tenant portal: Roboto body + Cinzel for the KAYSETU wordmark.
import { Cinzel, Roboto } from "next/font/google";

export const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Brand display font for the KAYSETU wordmark — same as the portal's logo.
export const cinzel = Cinzel({
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

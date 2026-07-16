import type { Metadata } from "next";

import ThemeRegistry from "@/components/ThemeRegistry";

export const metadata: Metadata = {
  title: "Salexa — Run your field business, your way",
  description:
    "Modular business platform: agent tracking, field sales, orders, inventory, production and GST-ready accounts. Buy only the modules you need.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}

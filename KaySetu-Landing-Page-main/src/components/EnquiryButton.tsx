"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

/**
 * Floating "Enquiry" pill. It hides itself once the footer scrolls into view so
 * it never sits on top of the footer links.
 */
export default function EnquiryButton() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      // Fire a little before the footer's top edge clears the button.
      { rootMargin: "0px 0px -24px 0px" }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <Link
      href="/contact"
      className={`fixed bottom-20 sm:bottom-24 right-8 z-50 flex items-center gap-2 bg-[#009688] text-white px-5 py-3 rounded-full shadow-lg hover:bg-[#007b6f] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 font-medium tracking-wide group ${
        hidden
          ? "opacity-0 translate-y-4 pointer-events-none"
          : "opacity-100 translate-y-0"
      }`}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : undefined}
      aria-label="Make an enquiry"
    >
      <Icon
        name="MessageSquare"
        className="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
      />
      <span className="hidden sm:inline">Enquiry</span>
    </Link>
  );
}

"use client";
import React from "react";
import { usePathname } from "next/navigation";
import DynamicLayout from "./DynamicLayout";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/"];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Don't wrap public pages with the authenticated layout
    if (PUBLIC_PATHS.includes(pathname)) {
        return <>{children}</>;
    }

    return <DynamicLayout>{children}</DynamicLayout>;
}

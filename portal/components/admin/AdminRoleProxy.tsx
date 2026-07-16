"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * AdminRoleProxy - Redirects to role pages but maintains admin context
 * This component redirects to the actual role page while preserving admin session
 */
export default function AdminRoleProxy({ targetPath }: { targetPath: string }) {
    const router = useRouter();

    useEffect(() => {
        // Store that we're coming from admin
        sessionStorage.setItem("adminAccess", "true");
        sessionStorage.setItem("returnToAdmin", window.location.pathname);

        // Redirect to the actual page
        router.push(targetPath);
    }, [targetPath, router]);

    return (
        <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh"
        }}>
            <p>Loading...</p>
        </div>
    );
}

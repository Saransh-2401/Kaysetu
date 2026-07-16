
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService } from "@/lib/auth-service";
import KineticDotsLoader from "@/components/kinetic-dots-loader";

interface AuthGuardProps {
    children: React.ReactNode;
}

// Define role-based access
const rolePermissions: Record<string, string[]> = {
    "/admin/attendance": ["admin", "mdo", "executive", "sales_manager"],
    "/admin": ["admin", "mdo", "executive"],
    "/sales-manager-mobile": ["sales_manager", "admin", "mdo"],
    "/sales-manager": ["sales_manager", "admin", "mdo", "warehouse_manager", "accounts_officer", "production_manager", "purchase_manager", "quality_manager", "sales_agent"],
    "/sales-agent": ["sales_agent", "admin"],
    "/warehouse": ["warehouse_manager", "admin", "production_manager", "purchase_manager"],
    "/production": ["production_manager", "admin", "quality_manager"],
    "/purchase": ["purchase_manager", "admin", "warehouse_manager", "accounts_officer"],
    "/accounts": ["accounts_officer", "admin", "mdo"],
    "/distributors": ["admin", "mdo", "sales_manager", "sales_agent"],
    "/distributor": ["distributor", "admin"],
    "/quality": ["quality_manager", "admin"],
};

export default function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const hasCheckedOnce = useRef(false);

    useEffect(() => {
        const checkAuth = async () => {
            const isAuthenticated = authService.isAuthenticated();
            const publicPaths = ["/login", "/forgot-password", "/"];

            // If accessing a public path, allow immediately
            if (publicPaths.includes(pathname)) {
                setAuthorized(true);
                setInitialLoading(false);
                return;
            }

            if (!isAuthenticated) {
                router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
                return;
            }

            try {
                const user = await authService.getCurrentUser();

                // Find if the current path requires specific roles
                const matchedSection = Object.keys(rolePermissions).find(route => pathname.startsWith(route));

                if (matchedSection) {
                    const allowedRoles = rolePermissions[matchedSection];
                    if (!allowedRoles.includes(user.role)) {
                        console.warn(`Access denied. Role ${user.role} not allowed in ${matchedSection}`);

                        const roleRedirects: Record<string, string> = {
                            'admin': '/admin',
                            'sales_manager': '/sales-manager',
                            'sales_agent': '/sales-agent',
                            'warehouse_manager': '/warehouse',
                            'production_manager': '/production',
                            'purchase_manager': '/purchase',
                            'accounts_officer': '/accounts',
                            'distributor': '/distributor',
                            'quality_manager': '/quality',
                            'mdo': '/admin'
                        };

                        const targetPath = roleRedirects[user.role] || '/login';
                        if (pathname !== targetPath && !pathname.startsWith(targetPath)) {
                            router.replace(targetPath);
                        }
                        return;
                    }
                }

                setAuthorized(true);
            } catch (error) {
                console.error("Auth Guard Error:", error);
                authService.logout();
                router.push("/login");
            } finally {
                setInitialLoading(false);
                hasCheckedOnce.current = true;
            }
        };

        checkAuth();
    }, [pathname, router]);

    // Only show full-screen loader on first load, not on every route change
    if (initialLoading && !hasCheckedOnce.current) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a' }}>
                <KineticDotsLoader />
            </div>
        );
    }

    return authorized ? <>{children}</> : null;
}

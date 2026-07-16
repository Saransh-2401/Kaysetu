"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService, UserProfile } from "@/lib/auth-service";
import KineticDotsLoader from "@/components/kinetic-dots-loader";

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: string[]; // e.g. ['admin', 'sales_manager']
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // 1. Check if token exists
                if (!authService.isAuthenticated()) {
                    router.push("/auth/login");
                    return;
                }

                // 2. Fetch current user profile to verify role
                const user = await authService.getCurrentUser();

                // 3. Check role - Admin bypasses all checks
                if (user.role === 'admin' || allowedRoles.includes(user.role)) {
                    setIsAuthorized(true);
                } else {
                    console.warn(`Access denied. Role ${user.role} not allowed in protected route. Redirecting...`);
                    // Redirect to their appropriate dashboard based on their role
                    switch (user.role) {
                        case 'admin':
                            router.push('/admin');
                            break;
                        case 'sales_manager':
                            router.push('/sales-manager');
                            break;
                        case 'sales_agent':
                            router.push('/sales-agent');
                            break;
                        case 'warehouse_manager':
                            router.push('/warehouse');
                            break;
                        case 'production_manager':
                            router.push('/production');
                            break;
                        case 'purchase_manager':
                            router.push('/purchase');
                            break;
                        case 'accounts_officer':
                            router.push('/accounts');
                            break;
                        case 'distributor':
                            router.push('/distributor');
                            break;
                        default:
                            router.push('/auth/login');
                    }
                    return;
                }
            } catch (error) {
                console.error("Auth check failed:", error);
                router.push("/auth/login");
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, [router, JSON.stringify(allowedRoles)]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a' }}>
                <KineticDotsLoader />
            </div>
        );
    }

    if (!isAuthorized) {
        return null; // Will redirect
    }

    return <>{children}</>;
}

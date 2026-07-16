"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import AdminLayout from "@/components/admin/layout/AdminLayout";
import PurchaseLayout from "@/components/purchase/layout/PurchaseLayout";
import WarehouseLayout from "@/components/warehouse/layout/WarehouseLayout";
import SalesManagerLayout from "@/components/sales-manager/layout/SalesManagerLayout";
import ProductionLayout from "@/components/production/layout/ProductionLayout";
import AccountsLayout from "@/components/accounts/layout/AccountsLayout";
import DistributorLayout from "@/components/distributor/layout/DistributorLayout";
import SalesAgentLayout from "@/components/sales-agent/layout/SalesAgentLayout";
import { authService } from "@/lib/auth-service";
import KineticDotsLoader from "@/components/kinetic-dots-loader";

// Module-level cache so role survives component remounts across navigations
let cachedRole: string | null = null;

export default function DynamicLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [role, setRole] = useState<string | null>(cachedRole);
    const [loading, setLoading] = useState(!cachedRole);

    useEffect(() => {
        if (cachedRole) {
            setRole(cachedRole);
            setLoading(false);
            return;
        }
        const loadRole = async () => {
            try {
                const user = await authService.getCurrentUser();
                const userRole = user?.role || null;
                cachedRole = userRole;
                setRole(userRole);
            } catch (error) {
                console.error("Failed to load user role", error);
            } finally {
                setLoading(false);
            }
        };
        loadRole();
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a' }}>
                <KineticDotsLoader />
            </div>
        );
    }

    // Role-based layout selection with route awareness for primary managers
    switch (role) {
        case "admin":
        case "mdo":
        case "executive":
            if (pathname?.startsWith('/purchase') || pathname?.startsWith('/material-requests') ||
                pathname?.startsWith('/suppliers')) {
                return <PurchaseLayout>{children}</PurchaseLayout>;
            }
            if (pathname?.startsWith('/warehouse') || pathname?.startsWith('/stock-') ||
                pathname?.startsWith('/warehouses')) {
                return <WarehouseLayout>{children}</WarehouseLayout>;
            }
            if (pathname?.startsWith('/production') || pathname?.startsWith('/work-orders') ||
                pathname?.startsWith('/job-cards') ||
                pathname?.startsWith('/bom') ||
                pathname?.startsWith('/quality')) {
                return <ProductionLayout>{children}</ProductionLayout>;
            }
            if (pathname?.startsWith('/accounts') || pathname?.startsWith('/general-ledgers') ||
                pathname?.startsWith('/customer-ledgers') ||
                pathname?.startsWith('/supplier-ledgers')) {
                return <AccountsLayout>{children}</AccountsLayout>;
            }
            if (pathname?.startsWith('/sales-manager') || pathname?.startsWith('/sales-orders') ||
                pathname?.startsWith('/sales-team') || pathname?.startsWith('/sales-targets') ||
                pathname?.startsWith('/customers') || pathname?.startsWith('/leads')) {
                return <SalesManagerLayout>{children}</SalesManagerLayout>;
            }
            return <AdminLayout>{children}</AdminLayout>;

        case "purchase_manager":
            return <PurchaseLayout>{children}</PurchaseLayout>;

        case "warehouse_manager":
            return <WarehouseLayout>{children}</WarehouseLayout>;

        case "sales_manager":
            return <SalesManagerLayout>{children}</SalesManagerLayout>;

        case "production_manager":
        case "quality_manager":
            return <ProductionLayout>{children}</ProductionLayout>;

        case "accounts_officer":
            return <AccountsLayout>{children}</AccountsLayout>;

        case "distributor":
            return <DistributorLayout>{children}</DistributorLayout>;

        case "sales_agent":
            return <SalesAgentLayout>{children}</SalesAgentLayout>;

        default:
            return <AdminLayout>{children}</AdminLayout>;
    }
}

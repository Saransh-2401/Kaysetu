"use client";
import React, { useState, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import PurchaseHeader from "./PurchaseHeader";
import PurchaseSidebar from "./PurchaseSidebar";
import AdminLayout from "@/components/admin/layout/AdminLayout";
import { authService } from "@/lib/auth-service";

import RoleGuard from "@/components/auth/RoleGuard";

const drawerWidth = 280;

export default function PurchaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const user = await authService.getCurrentUser();
        setIsAdmin(user.role === 'admin');
      } catch (error) {
        console.error("Failed to get user role:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkUserRole();
  }, []);

  // If admin is accessing, use AdminLayout
  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (isAdmin) {
    return (
      <RoleGuard allowedRoles={['purchase_manager', 'warehouse_manager', 'accounts_officer']}>
        <AdminLayout>{children}</AdminLayout>
      </RoleGuard>
    );
  }

  // Regular purchase manager layout
  return (
    <RoleGuard allowedRoles={['purchase_manager', 'warehouse_manager', 'accounts_officer']}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <PurchaseHeader
          handleDrawerToggle={() => setMobileOpen(!mobileOpen)}
        />
        <PurchaseSidebar
          mobileOpen={mobileOpen}
          handleDrawerToggle={() => setMobileOpen(!mobileOpen)}
        />

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 4 },
            width: {
              xl: `calc(100% - ${drawerWidth}px)`,
            },
            transition: theme.transitions.create(["width", "margin"]),
            mt: "80px",
          }}
        >
          {children}
        </Box>
      </Box>
    </RoleGuard>
  );
}

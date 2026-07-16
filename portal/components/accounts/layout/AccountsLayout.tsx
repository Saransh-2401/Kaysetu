"use client";
import React, { useState, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import AccountsHeader from "./AccountsHeader";
import AccountsSidebar from "./AccountsSidebar";
import AdminLayout from "@/components/admin/layout/AdminLayout";
import { authService } from "@/lib/auth-service";

import RoleGuard from "@/components/auth/RoleGuard";

const drawerWidth = 280;

export default function AccountsLayout({
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

  if (isLoading) {
    return null;
  }

  if (isAdmin) {
    return (
      <RoleGuard allowedRoles={['accounts_officer']}>
        <AdminLayout>{children}</AdminLayout>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={['accounts_officer']}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <AccountsHeader
          handleDrawerToggle={() => setMobileOpen(!mobileOpen)}
        />
        <AccountsSidebar
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

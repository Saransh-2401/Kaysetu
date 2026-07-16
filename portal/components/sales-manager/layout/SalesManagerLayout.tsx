"use client";
import React, { useState, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import SalesManagerHeader from "./SalesManagerHeader";
import SalesManagerSidebar from "./SalesManagerSidebar";
import RoleGuard from "@/components/auth/RoleGuard";
import AdminLayout from "@/components/admin/layout/AdminLayout";
import { authService } from "@/lib/auth-service";

export default function SalesManagerLayout({
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

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  if (isLoading) {
    return null;
  }

  if (isAdmin) {
    return (
      <RoleGuard allowedRoles={['sales_manager', 'mdo']}>
        <AdminLayout>{children}</AdminLayout>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={['sales_manager', 'mdo']}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <SalesManagerHeader handleDrawerToggle={handleDrawerToggle} />
        <SalesManagerSidebar
          mobileOpen={mobileOpen}
          handleDrawerToggle={handleDrawerToggle}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 4 },
            minWidth: 0,
            mt: "80px",
            transition: theme.transitions.create(["margin", "width"], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          }}
        >
          {children}
        </Box>
      </Box>
    </RoleGuard>
  );
}

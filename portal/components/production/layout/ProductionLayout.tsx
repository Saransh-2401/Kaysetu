"use client";
import React, { useState, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import ProductionHeader from "./ProductionHeader";
import ProductionSidebar from "./ProductionSidebar";
import AdminLayout from "@/components/admin/layout/AdminLayout";
import { authService } from "@/lib/auth-service";

import RoleGuard from "@/components/auth/RoleGuard";

export default function ProductionLayout({
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
      <RoleGuard allowedRoles={['production_manager', 'quality_manager']}>
        <AdminLayout>{children}</AdminLayout>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={['production_manager', 'quality_manager']}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <ProductionHeader handleDrawerToggle={handleDrawerToggle} />
        <ProductionSidebar
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

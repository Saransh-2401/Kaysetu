"use client";
import React, { useState } from "react";
import { Box, useTheme } from "@mui/material";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";
import RoleGuard from "@/components/auth/RoleGuard";

const drawerWidth = 280;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <RoleGuard allowedRoles={['admin', 'mdo', 'executive']}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        {/* 1. Header (Right Side) */}
        <AdminHeader handleDrawerToggle={handleDrawerToggle} />

        {/* 2. Sidebar (Left Side - Full Height) */}
        <AdminSidebar
          mobileOpen={mobileOpen}
          handleDrawerToggle={handleDrawerToggle}
        />

        {/* 3. Main Content Area — own scroll region under the fixed 80px header */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            height: "100vh",
            overflowY: "auto",
            px: { xs: 2, md: 4 },
            pb: { xs: 2, md: 4 },
            pt: { xs: "88px", md: "104px" }, // 80px header + page gap
            width: {
              xl: `calc(100% - ${drawerWidth}px)`,
            },
            transition: theme.transitions.create(["width", "margin"], {
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

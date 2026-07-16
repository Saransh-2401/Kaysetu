"use client";
import React, { useState } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import SalesAgentHeader from "./SalesAgentHeader";
import SalesAgentSidebar from "./SalesAgentSidebar";
import SalesAgentBottomNav from "./SalesAgentBottomNav";
import RoleGuard from "@/components/auth/RoleGuard";

const drawerWidth = 280;

export default function SalesAgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();
  // We treat "md" (tablet) and down as Mobile for the app-like experience
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Drawer state for below-xl screens (hamburger menu)
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  return (
    <RoleGuard allowedRoles={['sales_agent']}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        {/* 1. Header (Responsive) */}
        <SalesAgentHeader
          handleDrawerToggle={handleDrawerToggle}
        />

        {/* 2. Navigation Strategy */}
        {isMobile ? (
          <SalesAgentBottomNav />
        ) : (
          <SalesAgentSidebar
            mobileOpen={mobileOpen}
            handleDrawerToggle={handleDrawerToggle}
          />
        )}

        {/* 3. Main Content Area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 4 },
            width: "100%",
            ml: isMobile
              ? 0
              : { xl: `${drawerWidth}px` },
            // Ensure content is not hidden behind Fixed Header
            pt: { xs: "88px", md: "110px" },
            // Ensure content is not hidden behind Fixed Bottom Nav on Mobile
            pb: isMobile ? "130px" : 4,
            transition: theme.transitions.create(["margin", "width"]),
          }}
        >
          {children}
        </Box>
      </Box>
    </RoleGuard>
  );
}

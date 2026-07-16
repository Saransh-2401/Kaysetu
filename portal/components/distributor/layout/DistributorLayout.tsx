"use client";
import React, { useState } from "react";
import { Box, useTheme } from "@mui/material";
import DistributorHeader from "./DistributorHeader";
import DistributorSidebar from "./DistributorSidebar";
import RoleGuard from "@/components/auth/RoleGuard";

export default function DistributorLayout({
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
    <RoleGuard allowedRoles={['distributor']}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <DistributorHeader handleDrawerToggle={handleDrawerToggle} />
        <DistributorSidebar
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
          }}
        >
          {children}
        </Box>
      </Box>
    </RoleGuard>
  );
}

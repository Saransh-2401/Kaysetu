"use client";
import React, { useState } from "react";
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Fab,
  Box,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Fade,
} from "@mui/material";
import { usePathname, useRouter } from "next/navigation";

// Icons
import { HomeIcon, StoreIcon, DirectionsWalkIcon, ShoppingCartIcon, PersonAddIcon, AddIcon } from "@/components/icons";

/**
 * SalesAgentBottomNav Component
 *
 * Provides a mobile-optimized bottom navigation bar with a central Floating Action Button (FAB).
 * - Handles navigation between main sales modules.
 * - Central FAB opens a quick action menu for creating orders, visits, etc.
 * - Styled with glassmorphism and safe-area padding for modern mobile devices.
 */
export default function SalesAgentBottomNav() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // FAB Menu State
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleFabClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleNavChange = (event: any, newValue: string) => {
    // Prevent navigation when clicking the spacer for the FAB
    if (newValue !== "add") {
      router.push(newValue);
    }
  };

  return (
    <>
      {/* 
        Quick Action Menu (New Order/Visit) 
        - Appears when FAB is clicked
      */}
      <Menu
        id="fab-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        TransitionComponent={Fade}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        PaperProps={{
          elevation: 8,
          sx: {
            mb: 2,
            minWidth: 200,
            overflow: "hidden",
            bgcolor: alpha(theme.palette.background.paper, 0.9),
            backdropFilter: "blur(12px)",
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          },
        }}
        MenuListProps={{ sx: { py: 0 } }}
      >
        <MenuItem
          onClick={() => {
            router.push("/sales-agent/visits?action=new");
            handleClose();
          }}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <DirectionsWalkIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="Check-In Visit" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            router.push("/sales-agent/orders?action=new");
            handleClose();
          }}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <ShoppingCartIcon fontSize="small" color="secondary" />
          </ListItemIcon>
          <ListItemText primary="New Order" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            router.push("/sales-agent/leads?action=new");
            handleClose();
          }}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <PersonAddIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText primary="Create Lead" />
        </MenuItem>
      </Menu>

      {/* 
        Bottom Navigation Container
        - Fixed at the bottom of the screen
        - High Z-Index to stay above everything
      */}
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300, // Higher than default AppBars to float properly
          borderRadius: "24px 24px 0 0", // Modern rounded top
          overflow: "visible", // Allowed to let FAB overflow if needed
          boxShadow: "0px -4px 20px rgba(0,0,0,0.08)",
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.85),
          backdropFilter: "blur(16px)", // Glassmorphism
          paddingBottom: "env(safe-area-inset-bottom, 20px)", // iOS Safe Area support
        }}
        elevation={0}
      >
        {/* Central FAB - Floating above the nav */}
        <Box
          sx={{
            position: "absolute",
            top: -28, // Pull up to float
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1301,
          }}
        >
          <Fab
            color="secondary"
            aria-label="add"
            onClick={handleFabClick}
            sx={{
              width: 56,
              height: 56,
              boxShadow: `0px 8px 20px ${alpha(
                theme.palette.secondary.main,
                0.4
              )}`,
              background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
              transition: "transform 0.2s",
              "&:active": { transform: "translateX(-50%) scale(0.95)" },
            }}
          >
            <AddIcon sx={{ fontSize: 32, color: "white" }} />
          </Fab>
        </Box>

        <BottomNavigation
          value={pathname}
          onChange={handleNavChange}
          showLabels // Keep labels for clarity
          sx={{
            height: 70, // Standard height
            bgcolor: "transparent",
            "& .MuiBottomNavigationAction-root": {
              minWidth: "auto",
              padding: "6px 0",
              color: "text.secondary",
              "&.Mui-selected": {
                color: "primary.main",
              },
            },
          }}
        >
          <BottomNavigationAction
            label="Home"
            value="/sales-agent"
            icon={<HomeIcon />}
          />
          <BottomNavigationAction
            label="Clients"
            value="/sales-agent/customers"
            icon={<StoreIcon />}
          />

          {/* Spacer for FAB */}
          <BottomNavigationAction
            label=""
            value="add"
            disabled
            sx={{ minWidth: 80, opacity: 0 }}
          />

          <BottomNavigationAction
            label="Visits"
            value="/sales-agent/visits"
            icon={<DirectionsWalkIcon />}
          />
          <BottomNavigationAction
            label="Orders"
            value="/sales-agent/orders"
            icon={<ShoppingCartIcon />}
          />
        </BottomNavigation>
      </Paper>
    </>
  );
}

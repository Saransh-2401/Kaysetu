"use client";
import React from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  useTheme,
  alpha,
  Typography,
  Stack,
} from "@mui/material";
import { usePathname } from "next/navigation";
import { MenuIcon } from "@/components/icons";
import UserProfileMenu from "@/components/common/UserProfileMenu";
import QuickLinksBar from "@/components/layout/QuickLinksBar";
import NotificationBell from "@/components/layout/NotificationBell";

const drawerWidth = 280;

export interface PageTitleRule {
  match: string;
  title: string;
  exact?: boolean;
}

interface BaseHeaderProps {
  handleDrawerToggle: () => void;
  titleRules: PageTitleRule[];
  fallbackTitle?: string;
  breadcrumbPrefix?: string;
}

export default function BaseHeader({
  handleDrawerToggle,
  titleRules,
  fallbackTitle = "Dashboard",
  breadcrumbPrefix = "Pages",
}: BaseHeaderProps) {
  const theme = useTheme();
  const pathname = usePathname();

  const gold = theme.palette.secondary.main;
  const goldDark = theme.palette.secondary.dark;
  const slate = theme.palette.primary.main;

  // Resolve page title from rules
  let pageTitle = fallbackTitle;
  for (const rule of titleRules) {
    if (rule.exact ? pathname === rule.match : pathname.includes(rule.match)) {
      pageTitle = rule.title;
      break;
    }
  }

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { xl: `calc(100% - ${drawerWidth}px)` },
        ml: { xl: `${drawerWidth}px` },
        backgroundColor: alpha(theme.palette.background.paper, 0.75),
        backdropFilter: "blur(16px) saturate(180%)",
        borderBottom: `1px solid ${alpha(gold, 0.08)}`,
        color: "text.primary",
        transition: theme.transitions.create(["width", "margin"], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
      }}
    >
      <Toolbar
        sx={{
          height: 72,
          justifyContent: "space-between",
          px: { xs: 2, md: 3 },
        }}
      >
        {/* Left: Toggle + Breadcrumb */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{
              mr: 2,
              display: { xl: "none" },
              color: alpha(slate, 0.6),
              "&:hover": { color: gold },
            }}
          >
            <MenuIcon />
          </IconButton>

          <Box>
            {/* Breadcrumb */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ mb: -0.25 }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 500,
                  color: alpha(slate, 0.4),
                  fontSize: "0.7rem",
                  letterSpacing: "0.02em",
                }}
              >
                {breadcrumbPrefix}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: alpha(slate, 0.25),
                  fontSize: "0.7rem",
                }}
              >
                /
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: alpha(gold, 0.8),
                  fontSize: "0.7rem",
                }}
              >
                {pageTitle}
              </Typography>
            </Stack>

            {/* Title */}
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: slate,
                fontSize: "1.15rem",
                letterSpacing: "-0.02em",
                lineHeight: 1.3,
              }}
            >
              {pageTitle}
            </Typography>
          </Box>
        </Box>

        {/* Right: Notifications + Profile */}
        <Stack direction="row" spacing={1} alignItems="center">
          <NotificationBell />
          <UserProfileMenu />
        </Stack>
      </Toolbar>

      {/* Role-aware Quick Links: pull-tab at the header's bottom-center */}
      <QuickLinksBar />
    </AppBar>
  );
}

"use client";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar, Avatar, Box, Chip, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Stack, Toolbar, Typography, alpha,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { clearSession, type Scope } from "@/lib/api";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  testId: string;
}

const DRAWER_WIDTH = 280;

export default function DashboardShell({
  scope,
  title,
  subtitle,
  nav,
  children,
}: {
  scope: Scope;
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = () => {
    clearSession(scope);
    router.push("/ops/login");
  };

  const drawer = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: (t) =>
          `linear-gradient(180deg, ${t.palette.background.paper} 0%, ${alpha(t.palette.primary.main, 0.05)} 100%)`,
      }}
      data-testid={`${scope}-sidebar-container`}
    >
      {/* Brand wordmark — gold-gradient Cinzel, matching the portal logo */}
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "secondary.main",
              boxShadow: (t) => `0 0 12px ${alpha(t.palette.secondary.main, 0.9)}`,
            }}
          />
          <Typography
            variant="h4"
            sx={{
              fontSize: "1.4rem",
              background: (t) =>
                `linear-gradient(135deg, ${t.palette.secondary.main} 0%, ${t.palette.secondary.dark} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            KAYSETU
          </Typography>
        </Stack>
        {subtitle && (
          <Chip
            size="small"
            color="secondary"
            label={subtitle}
            sx={{ mt: 1, fontWeight: 700, letterSpacing: 0.5 }}
            data-testid={`${scope}-sidebar-subtitle-chip`}
          />
        )}
      </Box>

      <List sx={{ flexGrow: 1, px: 1.5 }}>
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={active}
              onClick={() => setMobileOpen(false)}
              data-testid={item.testId}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                py: 1.1,
                position: "relative",
                color: active ? "primary.dark" : "text.secondary",
                fontWeight: active ? 700 : 500,
                "&.Mui-selected, &.Mui-selected:hover": {
                  background: (t) =>
                    `linear-gradient(135deg, ${alpha(t.palette.secondary.main, 0.22)} 0%, ${alpha(t.palette.secondary.main, 0.1)} 100%)`,
                },
                "&::before": active
                  ? {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      borderRadius: 3,
                      bgcolor: "secondary.main",
                    }
                  : undefined,
              }}
            >
              <ListItemIcon
                sx={{ minWidth: 40, color: active ? "secondary.dark" : "text.secondary" }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: "0.95rem" }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* Footer identity card + logout */}
      <Box sx={{ p: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            p: 1.5,
            borderRadius: 3,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.08)}`,
          }}
        >
          <Avatar
            sx={{
              width: 38,
              height: 38,
              background: (t) =>
                `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
              fontWeight: 700,
              fontSize: "0.9rem",
            }}
          >
            SA
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              SuperAdmin
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Platform operator
            </Typography>
          </Box>
          <IconButton size="small" onClick={logout} data-testid={`${scope}-logout-btn`}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Glass header — offset by the drawer so the sidebar brand shows through */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            sx={{ mr: 2, display: { md: "none" }, color: "text.primary" }}
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid={`${scope}-menu-toggle-btn`}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            sx={{ color: "text.primary", fontWeight: 700 }}
            data-testid={`${scope}-topbar-title`}
          >
            {title}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0 }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, borderRight: "none" },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              borderRight: (t) => `1px solid ${alpha(t.palette.primary.main, 0.08)}`,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, px: { xs: 2, md: 4 }, py: 3, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

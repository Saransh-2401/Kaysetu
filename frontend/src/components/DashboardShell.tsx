"use client";
/**
 * Ops console app shell — the portal's layout (280px gradient sidebar with the
 * gold KAYSETU wordmark, 72px glass header with a breadcrumb) rebuilt for a
 * platform operator: nav items are grouped into sections, each carries an
 * optional live badge, and the identity block opens a real profile menu instead
 * of a bare logout icon.
 */
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PORTAL_URL, clearSession, getContext, type Scope } from "@/lib/api";
import { RADIUS } from "@/theme";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  testId: string;
  /** Optional group heading rendered above this item. */
  section?: string;
  /** Live count badge (e.g. tickets needing attention). */
  badge?: number;
}

interface OpsUser {
  email?: string;
  full_name?: string;
  admin_role?: string;
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
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const gold = theme.palette.secondary.main;
  const goldDark = theme.palette.secondary.dark;
  const slate = theme.palette.primary.main;

  const user = getContext<OpsUser>(scope);
  const displayName = user?.full_name || user?.email || "SuperAdmin";
  const initials =
    displayName
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "SA";

  const logout = () => {
    clearSession(scope);
    router.push("/ops/login");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? nav.filter((n) => n.label.toLowerCase().includes(q)) : nav;
  }, [nav, query]);

  /**
   * Longest-prefix match, so /ops/tenants highlights Tenants while /ops itself
   * stays on Command Center — a plain `startsWith` would light up both.
   */
  const activeHref = useMemo(() => {
    const matches = nav
      .map((n) => n.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`));
    return matches.sort((a, b) => b.length - a.length)[0] ?? null;
  }, [nav, pathname]);

  const activeLabel = nav.find((n) => n.href === activeHref)?.label ?? title;

  const drawer = (
    <Box
      data-testid={`${scope}-sidebar-container`}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${alpha(slate, 0.03)} 100%)`,
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────────── */}
      <Box>
        <Box
          sx={{
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.5,
          }}
        >
          <Typography
            variant="h5"
            component="div"
            sx={{
              fontFamily: theme.typography.h4.fontFamily,
              fontWeight: 800,
              fontSize: "1.45rem",
              letterSpacing: "0.04em",
              display: "flex",
              alignItems: "center",
              background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            KAYSETU
            <Box
              component="span"
              sx={{
                width: 6,
                height: 6,
                ml: 0.5,
                mb: 1.4,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${gold}, ${goldDark})`,
                boxShadow: `0 0 8px ${alpha(gold, 0.6)}`,
              }}
            />
          </Typography>

          <Tooltip title={searchOpen ? "Close search" : "Search menu"} placement="right">
            <IconButton
              size="small"
              aria-label={searchOpen ? "Close menu search" : "Search menu"}
              onClick={() => {
                setSearchOpen((v) => !v);
                setQuery("");
              }}
              data-testid={`${scope}-sidebar-search-toggle`}
              sx={{ color: searchOpen ? gold : alpha(slate, 0.45), "&:hover": { color: gold } }}
            >
              <SearchIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {subtitle && (
          <Box sx={{ px: 2.5, pb: 1.5 }}>
            <Chip
              size="small"
              label={subtitle}
              data-testid={`${scope}-sidebar-subtitle-chip`}
              sx={{
                height: 20,
                fontSize: "0.62rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: slate,
                bgcolor: alpha(gold, 0.18),
                border: `1px solid ${alpha(gold, 0.35)}`,
              }}
            />
          </Box>
        )}

        <Collapse in={searchOpen} timeout={220}>
          <Box sx={{ px: 2, pb: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                px: 1.25,
                py: 0.6,
                borderRadius: RADIUS.sm,
                bgcolor: alpha(gold, 0.05),
                border: `1px solid ${alpha(gold, 0.18)}`,
                transition: "all 0.2s ease",
                "&:focus-within": {
                  borderColor: alpha(gold, 0.45),
                  boxShadow: `0 0 0 3px ${alpha(gold, 0.1)}`,
                },
              }}
            >
              <SearchIcon sx={{ fontSize: 17, mr: 1, color: alpha(gold, 0.7) }} />
              <InputBase
                autoFocus
                placeholder="Search menu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                inputProps={{ "aria-label": "Search menu", "data-testid": `${scope}-sidebar-search-input` }}
                sx={{ flex: 1, fontSize: "0.82rem", fontWeight: 500 }}
              />
            </Box>
          </Box>
        </Collapse>

        <Box sx={{ px: 2.5, pb: 0.5 }}>
          <Box
            sx={{
              height: "1px",
              background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.3)} 50%, transparent)`,
            }}
          />
        </Box>
      </Box>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <List sx={{ flexGrow: 1, px: 1.25, pt: 1, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <Typography variant="caption" color="text.disabled" sx={{ px: 1.5, py: 2, display: "block" }}>
            Nothing matches “{query}”.
          </Typography>
        )}

        {filtered.map((item, i) => {
          const active = item.href === activeHref;
          const showSection = Boolean(item.section) && !query.trim();

          return (
            <Box key={item.href}>
              {showSection && (
                <Box sx={{ px: 1.5, pt: i === 0 ? 0.5 : 2, pb: 0.75 }}>
                  <Typography variant="overline" sx={{ color: alpha(slate, 0.4), fontSize: "0.62rem" }}>
                    {item.section}
                  </Typography>
                </Box>
              )}

              <ListItem disablePadding sx={{ mb: 0.3, display: "block" }}>
                <ListItemButton
                  component={Link}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  data-testid={item.testId}
                  sx={{
                    minHeight: 42,
                    px: 1.25,
                    py: 0.75,
                    borderRadius: RADIUS.md,
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                    ...(active && {
                      background: `linear-gradient(135deg, ${alpha(gold, 0.14)} 0%, ${alpha(gold, 0.06)} 100%)`,
                      boxShadow: `inset 0 0 0 1px ${alpha(gold, 0.18)}`,
                    }),
                    "&:hover": {
                      background: active
                        ? `linear-gradient(135deg, ${alpha(gold, 0.18)} 0%, ${alpha(gold, 0.09)} 100%)`
                        : alpha(slate, 0.04),
                      transform: "translateX(2px)",
                    },
                  }}
                >
                  {active && (
                    <Box
                      aria-hidden
                      sx={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        height: "58%",
                        width: 3,
                        borderRadius: "0 3px 3px 0",
                        background: `linear-gradient(180deg, ${gold}, ${goldDark})`,
                        boxShadow: `0 0 10px ${alpha(gold, 0.45)}`,
                      }}
                    />
                  )}

                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 1.5,
                      width: 32,
                      height: 32,
                      borderRadius: "9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.22s ease",
                      bgcolor: active ? alpha(gold, 0.14) : "transparent",
                      color: active ? goldDark : alpha(slate, 0.55),
                      "& .MuiSvgIcon-root": { fontSize: "1.12rem" },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>

                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: active ? 700 : 500,
                      fontSize: "0.85rem",
                      letterSpacing: "-0.01em",
                      color: active ? slate : "text.primary",
                      noWrap: true,
                    }}
                    sx={{ my: 0, minWidth: 0 }}
                  />

                  {/* Badge is a count, not a dot: operators need the magnitude. */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <Box
                      data-testid={`${item.testId}-badge`}
                      sx={{
                        ml: 0.75,
                        minWidth: 20,
                        height: 20,
                        px: 0.6,
                        flexShrink: 0,
                        borderRadius: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.66rem",
                        fontWeight: 800,
                        color: "#fff",
                        bgcolor: theme.palette.warning.main,
                      }}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
            </Box>
          );
        })}
      </List>

      {/* ── Identity ──────────────────────────────────────────────── */}
      <Box sx={{ p: 1.5 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.25}
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setMenuAnchor(e.currentTarget as HTMLElement);
          }}
          data-testid={`${scope}-profile-trigger`}
          sx={{
            p: 1.25,
            cursor: "pointer",
            borderRadius: RADIUS.md,
            bgcolor: alpha(slate, 0.035),
            border: `1px solid ${alpha(slate, 0.08)}`,
            transition: "all 0.2s",
            "&:hover": { bgcolor: alpha(gold, 0.07), borderColor: alpha(gold, 0.28) },
          }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              fontSize: "0.78rem",
              fontWeight: 800,
              background: `linear-gradient(135deg, ${slate}, ${theme.palette.primary.dark})`,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: "0.8rem" }}>
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.68rem" }}>
              {user?.admin_role ? user.admin_role.replace(/_/g, " ") : "Platform operator"}
            </Typography>
          </Box>
          <KeyboardArrowDownIcon sx={{ fontSize: 17, color: alpha(slate, 0.4) }} />
        </Stack>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{ paper: { sx: { width: 236, borderRadius: RADIUS.md, mt: -1 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {displayName}
          </Typography>
          {user?.email && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {user.email}
            </Typography>
          )}
        </Box>
        <Divider />
        <MenuItem
          component="a"
          href={PORTAL_URL}
          target="_blank"
          rel="noopener"
          onClick={() => setMenuAnchor(null)}
          data-testid={`${scope}-open-portal-link`}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <OpenInNewIcon sx={{ fontSize: 17 }} />
          </ListItemIcon>
          Open tenant portal
        </MenuItem>
        <Divider />
        {/* Sign out sits below a divider — destructive actions stay separated. */}
        <MenuItem onClick={logout} data-testid={`${scope}-logout-btn`} sx={{ color: "error.main" }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <LogoutIcon sx={{ fontSize: 17, color: "error.main" }} />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` } }}
      >
        <Toolbar sx={{ height: 72, px: { xs: 2, md: 3 }, justifyContent: "space-between" }}>
          <Stack direction="row" alignItems="center" sx={{ minWidth: 0 }}>
            <IconButton
              edge="start"
              aria-label="Open navigation"
              onClick={() => setMobileOpen((v) => !v)}
              data-testid={`${scope}-menu-toggle-btn`}
              sx={{ mr: 1.5, display: { md: "none" }, color: alpha(slate, 0.6) }}
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ minWidth: 0 }}>
              {/* Breadcrumb — orientation for a console 2 levels deep. */}
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: -0.25 }}>
                <Typography variant="caption" sx={{ fontSize: "0.68rem", fontWeight: 500, color: alpha(slate, 0.4) }}>
                  {title}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.68rem", color: alpha(slate, 0.25) }}>
                  /
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.68rem", fontWeight: 700, color: alpha(gold, 0.9) }}>
                  {activeLabel}
                </Typography>
              </Stack>
              <Typography
                variant="h6"
                noWrap
                data-testid={`${scope}-topbar-title`}
                sx={{ fontSize: "1.12rem", fontWeight: 800, color: slate, lineHeight: 1.3 }}
              >
                {activeLabel}
              </Typography>
            </Box>
          </Stack>

          <Chip
            size="small"
            label="Control plane"
            data-testid={`${scope}-topbar-scope-chip`}
            sx={{
              height: 24,
              fontSize: "0.68rem",
              fontWeight: 700,
              color: slate,
              bgcolor: alpha(gold, 0.14),
              border: `1px solid ${alpha(gold, 0.3)}`,
              display: { xs: "none", sm: "flex" },
            }}
          />
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
              borderRight: `1px solid ${alpha(slate, 0.08)}`,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        id="ops-main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, md: 3 },
          py: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar sx={{ height: 72 }} />
        {children}
      </Box>
    </Box>
  );
}

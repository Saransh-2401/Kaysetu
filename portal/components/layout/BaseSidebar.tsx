"use client";
import React, { useState, useEffect } from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  useTheme,
  Tooltip,
  alpha,
  Avatar,
  IconButton,
  Collapse,
  InputBase,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserProfile, authService } from "@/lib/auth-service";
import {
  permissionService,
  filterMenuByPermissions,
  EffectivePermissions,
} from "@/lib/permission-service";

import { LogoutIcon, ExpandMoreIcon as ExpandMore, SearchIcon, CloseIcon } from "@/components/icons";

const drawerWidth = 280;

// Persist scroll position across remounts
let savedScrollTop = 0;

export interface MenuItemType {
  text: string;
  icon: React.ReactNode;
  path?: string;
  section?: string;
  // Permission-matrix module key. When set, the item is hidden only if the
  // current user's matrix explicitly disables that module (fail-open otherwise).
  moduleKey?: string;
  children?: { text: string; path: string; icon?: React.ReactNode; moduleKey?: string }[];
}

interface BaseSidebarProps {
  mobileOpen: boolean;
  handleDrawerToggle: () => void;
  menuItems: MenuItemType[];
}

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  warehouse_manager: "Warehouse Manager",
  production_manager: "Production Manager",
  purchase_manager: "Purchase Manager",
  accounts_officer: "Accounts Officer",
  distributor: "Distributor",
  mdo: "MDO",
  executive: "Executive",
  quality_manager: "Quality Manager",
};

export default function BaseSidebar({
  mobileOpen,
  handleDrawerToggle,
  menuItems,
}: BaseSidebarProps) {
  const theme = useTheme();
  const pathname = usePathname();

  const [openSegments, setOpenSegments] = useState<{ [key: string]: boolean }>(
    () => {
      const initialState: { [key: string]: boolean } = {};
      menuItems.forEach((item) => {
        if (item.children) {
          initialState[item.text] = true;
        }
      });
      return initialState;
    }
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const navListRef = React.useRef<HTMLUListElement>(null);

  // Restore scroll position on mount
  useEffect(() => {
    const el = navListRef.current;
    if (el && savedScrollTop) {
      el.scrollTop = savedScrollTop;
    }
  }, []);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [perms, setPerms] = useState<EffectivePermissions | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error("Failed to load user profile", error);
      }
    };
    loadUser();

    // Effective permissions drive menu visibility. Fail-open: if this fails or
    // is unseeded, perms stays null / is_full and every item shows (as today).
    permissionService
      .getMine()
      .then(setPerms)
      .catch(() => setPerms(null));
  }, []);

  const handleLogout = () => {
    authService.logout();
    window.location.href = "/login";
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const handleSearchToggle = () => {
    setSearchOpen((prev) => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchQuery("");
      }
      return !prev;
    });
  };

  // Hide items the permission matrix explicitly disables (fail-open). See
  // filterMenuByPermissions for the rules (incl. dropping emptied groups).
  const permittedMenuItems = React.useMemo(
    () => filterMenuByPermissions(menuItems, perms),
    [perms, menuItems]
  );

  const filteredMenuItems = React.useMemo(() => {
    if (!searchQuery.trim()) return permittedMenuItems;
    const q = searchQuery.toLowerCase();
    return permittedMenuItems
      .map((item) => {
        const parentMatch = item.text.toLowerCase().includes(q);
        if (!item.children) {
          return parentMatch ? item : null;
        }
        const matchedChildren = item.children.filter((child) =>
          child.text.toLowerCase().includes(q)
        );
        if (parentMatch || matchedChildren.length > 0) {
          return {
            ...item,
            children:
              matchedChildren.length > 0 ? matchedChildren : item.children,
          };
        }
        return null;
      })
      .filter(Boolean) as MenuItemType[];
  }, [searchQuery, permittedMenuItems]);

  const handleClick = (text: string) => {
    setOpenSegments((prev) => ({ ...prev, [text]: !prev[text] }));
  };

  const gold = theme.palette.secondary.main;
  const goldDark = theme.palette.secondary.dark;
  const slate = theme.palette.primary.main;

  const sidebarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${alpha(slate, 0.02)} 100%)`,
      }}
    >
      {/* Header */}
      <Box>
        <Box
          sx={{
            height: 80,
            display: "flex",
            alignItems: "center",
            px: 3,
            justifyContent: "space-between",
          }}
        >
          <Typography
            variant="h5"
            component="div"
            sx={{
              fontFamily: theme.typography.h4.fontFamily,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              display: "flex",
              alignItems: "center",
              letterSpacing: "0.04em",
              fontSize: "1.6rem",
            }}
          >
            SALEXA
            <Box
              component="span"
              sx={{
                width: 7,
                height: 7,
                background: `linear-gradient(135deg, ${gold}, ${goldDark})`,
                borderRadius: "50%",
                ml: 0.5,
                mb: 1.5,
                boxShadow: `0 0 8px ${alpha(gold, 0.5)}`,
              }}
            />
          </Typography>
          <Tooltip
            title={searchOpen ? "Close search" : "Search menu"}
            placement="right"
          >
            <Box
              onClick={handleSearchToggle}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                color: searchOpen ? gold : alpha(slate, 0.45),
                transition: "all 0.2s ease",
                "&:hover": { color: gold },
              }}
            >
              {searchOpen ? (
                <CloseIcon sx={{ fontSize: 20 }} />
              ) : (
                <SearchIcon sx={{ fontSize: 20 }} />
              )}
            </Box>
          </Tooltip>
        </Box>

        <Collapse in={searchOpen} timeout={250}>
          <Box sx={{ px: 2, pb: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                bgcolor: alpha(gold, 0.04),
                borderRadius: "12px",
                px: 1.5,
                py: 0.75,
                border: `1.5px solid ${alpha(gold, 0.15)}`,
                transition: "all 0.25s ease",
                "&:focus-within": {
                  borderColor: alpha(gold, 0.4),
                  bgcolor: alpha(gold, 0.06),
                  boxShadow: `0 0 0 3px ${alpha(gold, 0.08)}`,
                },
              }}
            >
              <SearchIcon
                sx={{ color: alpha(gold, 0.6), mr: 1, fontSize: 20 }}
              />
              <InputBase
                inputRef={searchInputRef}
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  flex: 1,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  "& input::placeholder": {
                    opacity: 0.5,
                    color: "text.secondary",
                  },
                }}
              />
            </Box>
          </Box>
        </Collapse>

        <Box sx={{ px: 2.5, pb: 1 }}>
          <Box
            sx={{
              height: "1px",
              background: `linear-gradient(90deg, transparent 0%, ${alpha(gold, 0.25)} 50%, transparent 100%)`,
            }}
          />
        </Box>
      </Box>

      {/* Navigation */}
      <List
        ref={navListRef}
        onScroll={(e) => { savedScrollTop = (e.target as HTMLElement).scrollTop; }}
        sx={{
          px: 1.5,
          flexGrow: 1,
          pt: 0.5,
          overflowY: "auto",
          "&::-webkit-scrollbar": { width: "3px" },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            borderRadius: "6px",
            backgroundColor: alpha(gold, 0.2),
            "&:hover": { backgroundColor: alpha(gold, 0.35) },
          },
        }}
      >
        {filteredMenuItems.map((item, index) => {
          const isChildActive = item.children?.some(
            (child) => pathname === child.path
          );
          const isDirectActive = pathname === item.path;
          const isActive = isDirectActive || isChildActive;
          const isSearching = searchQuery.trim().length > 0;
          const isOpen = isSearching
            ? true
            : openSegments[item.text] || false;

          return (
            <React.Fragment key={item.text}>
              {item.section && !isSearching && (
                <Box sx={{ px: 1.5, pt: index === 0 ? 0.5 : 2, pb: 0.75 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: alpha(slate, 0.4),
                      textTransform: "uppercase",
                    }}
                  >
                    {item.section}
                  </Typography>
                </Box>
              )}

              <ListItem disablePadding sx={{ mb: 0.3, display: "block" }}>
                <ListItemButton
                  data-animate-group
                  component={item.children ? "div" : Link}
                  href={item.children ? undefined : item.path}
                  onClick={() =>
                    item.children ? handleClick(item.text) : null
                  }
                  sx={{
                    minHeight: 44,
                    justifyContent: "initial",
                    px: 1.5,
                    py: 0.75,
                    borderRadius: "12px",
                    position: "relative",
                    transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                    overflow: "hidden",
                    ...(isActive &&
                      !item.children && {
                        background: `linear-gradient(135deg, ${alpha(gold, 0.12)} 0%, ${alpha(gold, 0.06)} 100%)`,
                        boxShadow: `inset 0 0 0 1px ${alpha(gold, 0.15)}`,
                      }),
                    color: isActive ? slate : "text.primary",
                    "&:hover": {
                      background:
                        isActive && !item.children
                          ? `linear-gradient(135deg, ${alpha(gold, 0.16)} 0%, ${alpha(gold, 0.08)} 100%)`
                          : alpha(slate, 0.04),
                      transform: "translateX(2px)",
                    },
                  }}
                >
                  {isActive && !item.children && (
                    <Box
                      sx={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        height: "60%",
                        width: "3px",
                        background: `linear-gradient(180deg, ${gold} 0%, ${goldDark} 100%)`,
                        borderTopRightRadius: 3,
                        borderBottomRightRadius: 3,
                        boxShadow: `0 0 10px ${alpha(gold, 0.4)}`,
                      }}
                    />
                  )}

                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 1.5,
                      justifyContent: "center",
                      width: 34,
                      height: 34,
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      transition: "all 0.25s ease",
                      bgcolor:
                        isActive && !item.children
                          ? alpha(gold, 0.12)
                          : "transparent",
                      color:
                        isActive && !item.children
                          ? goldDark
                          : alpha(slate, 0.55),
                      "& .MuiSvgIcon-root": { fontSize: "1.2rem" },
                      // Sizing for migrated animated/lucide icons (plain <svg>)
                      "& svg": { width: "1.2rem", height: "1.2rem" },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>

                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "0.875rem",
                      letterSpacing: "-0.01em",
                      color:
                        isActive && !item.children ? slate : "text.primary",
                    }}
                    sx={{ my: 0 }}
                  />
                  {item.children && (
                    <Box
                      component="span"
                      sx={{
                        color: alpha(slate, 0.35),
                        display: "flex",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      <ExpandMore sx={{ fontSize: 18 }} />
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>

              {item.children && (
                <Collapse in={isOpen} timeout={300} easing="cubic-bezier(0.4, 0, 0.2, 1)" unmountOnExit>
                  <List
                    component="div"
                    disablePadding
                    sx={{
                      position: "relative",
                      ml: 2.5,
                      my: 0.5,
                      // The connector line "grows" downward as the menu expands.
                      "@keyframes growLine": {
                        from: { transform: "scaleY(0)" },
                        to: { transform: "scaleY(1)" },
                      },
                      // Each row fades + slides in, staggered (see animationDelay below).
                      "@keyframes fadeSlideIn": {
                        from: { opacity: 0, transform: "translateX(-10px)" },
                        to: { opacity: 1, transform: "translateX(0)" },
                      },
                      // Dot "pops" into place along with its row.
                      "@keyframes dotPop": {
                        from: { transform: "translateY(-50%) scale(0)" },
                        to: { transform: "translateY(-50%) scale(1)" },
                      },
                      // Active dot keeps a soft expanding-ring pulse.
                      "@keyframes dotPulse": {
                        "0%": { boxShadow: `0 0 0 0 ${alpha(gold, 0.45)}` },
                        "70%": { boxShadow: `0 0 0 6px ${alpha(gold, 0)}` },
                        "100%": { boxShadow: `0 0 0 0 ${alpha(gold, 0)}` },
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        left: "8px",
                        top: 4,
                        bottom: 4,
                        width: "1.5px",
                        background: `linear-gradient(180deg, ${alpha(gold, 0.35)} 0%, ${alpha(gold, 0.08)} 100%)`,
                        borderRadius: "2px",
                        zIndex: 0,
                        transformOrigin: "top center",
                        animation: "growLine 0.4s cubic-bezier(0.4, 0, 0.2, 1) both",
                      }}
                    />
                    {item.children.map((child, index) => {
                      const isChildSelected = pathname === child.path;
                      // Stagger each row's entrance after the line starts drawing.
                      const delay = `${0.08 + index * 0.05}s`;
                      return (
                        <ListItemButton
                          key={child.text}
                          data-animate-group
                          component={Link}
                          href={child.path}
                          sx={{
                            pl: 4,
                            py: 0.6,
                            borderRadius: "10px",
                            mb: 0.25,
                            position: "relative",
                            zIndex: 1,
                            transition: "color 0.2s ease, background-color 0.2s ease, transform 0.2s ease",
                            color: isChildSelected
                              ? goldDark
                              : "text.secondary",
                            bgcolor: isChildSelected
                              ? alpha(gold, 0.08)
                              : "transparent",
                            animation: `fadeSlideIn 0.32s cubic-bezier(0.4, 0, 0.2, 1) both`,
                            animationDelay: delay,
                            "&:hover": {
                              color: goldDark,
                              bgcolor: alpha(gold, 0.06),
                              transform: "translateX(3px)",
                            },
                            "&:hover::before": {
                              transform: "translateY(-50%) scale(1.35)",
                              bgcolor: gold,
                              borderColor: gold,
                            },
                            "&::before": {
                              content: '""',
                              position: "absolute",
                              left: isChildSelected ? "5.25px" : "4.25px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              boxSizing: "border-box",
                              width: isChildSelected ? 7 : 9,
                              height: isChildSelected ? 7 : 9,
                              borderRadius: "50%",
                              // Active: solid gold (filled). Inactive: a clean hollow
                              // ring — paper-colored center punched onto the line.
                              bgcolor: isChildSelected
                                ? gold
                                : theme.palette.background.paper,
                              border: isChildSelected
                                ? "none"
                                : `1.5px solid ${alpha(slate, 0.5)}`,
                              transition:
                                "background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
                              // Pop in with the row; the active dot then pulses forever.
                              animation: isChildSelected
                                ? `dotPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both ${delay}, dotPulse 2.2s ease-out infinite 0.5s`
                                : `dotPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both ${delay}`,
                            },
                          }}
                        >
                          <ListItemText
                            primary={child.text}
                            primaryTypographyProps={{
                              fontSize: "0.82rem",
                              fontWeight: isChildSelected ? 650 : 450,
                              letterSpacing: "-0.005em",
                            }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              )}
            </React.Fragment>
          );
        })}

        {searchQuery.trim() && filteredMenuItems.length === 0 && (
          <Box sx={{ px: 3, py: 5, textAlign: "center" }}>
            <SearchIcon
              sx={{ fontSize: 32, color: alpha(slate, 0.15), mb: 1 }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              No menu items found
            </Typography>
          </Box>
        )}
      </List>

      {/* Footer */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ px: 0.5, pb: 2 }}>
          <Box
            sx={{
              height: "1px",
              background: `linear-gradient(90deg, transparent 0%, ${alpha(gold, 0.2)} 50%, transparent 100%)`,
            }}
          />
        </Box>

        <Box
          sx={{
            p: 1.5,
            borderRadius: "14px",
            background: `linear-gradient(135deg, ${alpha(slate, 0.03)} 0%, ${alpha(gold, 0.04)} 100%)`,
            border: `1px solid ${alpha(gold, 0.1)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.25s ease",
            "&:hover": {
              background: `linear-gradient(135deg, ${alpha(slate, 0.05)} 0%, ${alpha(gold, 0.06)} 100%)`,
              borderColor: alpha(gold, 0.2),
              boxShadow: `0 4px 16px ${alpha(slate, 0.06)}`,
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              src={user?.profile_image || undefined}
              alt={user?.full_name || user?.username || ""}
              data-testid="sidebar-user-avatar-img"
              sx={{
                background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                width: 38,
                height: 38,
                fontSize: "0.8rem",
                fontWeight: 700,
                color: slate,
                boxShadow: `0 2px 8px ${alpha(gold, 0.3)}`,
              }}
            >
              {user ? getInitials(user.full_name || user.username) : "..."}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                  fontSize: "0.85rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user ? user.full_name || user.username : "Loading..."}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.7rem",
                  display: "block",
                  color: alpha(slate, 0.45),
                  fontWeight: 500,
                }}
              >
                {user ? roleLabels[user.role] || user.role : ""}
              </Typography>
            </Box>
          </Box>

          <Tooltip title="Sign Out" placement="top">
            <IconButton
              size="small"
              onClick={handleLogout}
              sx={{
                color: alpha(slate, 0.35),
                borderRadius: "10px",
                width: 32,
                height: 32,
                transition: "all 0.25s ease",
                "&:hover": {
                  color: theme.palette.error.main,
                  bgcolor: alpha(theme.palette.error.main, 0.06),
                  transform: "scale(1.05)",
                },
              }}
            >
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  const drawerPaperSx = {
    boxSizing: "border-box",
    width: drawerWidth,
    borderRight: "none",
    backgroundColor: theme.palette.background.paper,
    overflowX: "hidden",
    boxShadow: `1px 0 20px ${alpha(slate, 0.04)}`,
    "&::-webkit-scrollbar": { width: "3px" },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: alpha(gold, 0.2),
      borderRadius: "6px",
    },
  };

  return (
    <Box
      component="nav"
      sx={{
        width: { xl: drawerWidth },
        flexShrink: { xl: 0 },
      }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", xl: "none" },
          "& .MuiDrawer-paper": drawerPaperSx,
        }}
      >
        {sidebarContent}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", xl: "block" },
          "& .MuiDrawer-paper": drawerPaperSx,
        }}
        open
      >
        {sidebarContent}
      </Drawer>
    </Box>
  );
}

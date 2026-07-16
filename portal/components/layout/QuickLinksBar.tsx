"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Collapse,
  IconButton,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  Typography,
  CircularProgress,
  useTheme,
  alpha,
} from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { ExpandMoreIcon, ExpandLessIcon, AddIcon, CloseIcon, AppIcon } from "@/components/icons";
import { toast } from "sonner";
import { quickLinkService, QuickLink } from "@/lib/permission-service";
import { usePermissions } from "@/lib/usePermissions";
import { PAGE_REGISTRY } from "@/lib/page-registry";

// A meaningful leading icon per module (names resolved by the icon barrel;
// unknown/blank falls back to a generic grid icon).
const MODULE_ICON: Record<string, string> = {
  users: "Group", sales_team: "AssignmentInd", distributors: "LocalShipping",
  customers: "Store", suppliers: "Warehouse", items: "Category", products: "Inventory2",
  taxes: "Receipt", permissions: "LockPerson", travel_allowance: "Commute",
  attendance: "Badge", company_settings: "Domain", notifications: "Notifications",
  app_updates: "SystemUpdate", admin_reports: "BarChart", sales_targets: "Assessment",
  leads: "FilterAlt", visits: "LocationOn", sales_orders: "ShoppingCart",
  stock_requests: "History", order_history: "History", backordered: "Assignment",
  invoices: "ReceiptLong", distributor_invoices: "ReceiptLong", distributor_products: "Inventory2",
  purchase_orders: "ShoppingCart", material_requests: "Assignment", raw_materials: "Category",
  our_products: "Inventory2", stock_adjustments: "CompareArrows", stock_ledger: "MenuBook",
  bom: "AccountTree", production_planning: "CalendarMonth", work_orders: "Engineering",
  job_cards: "AssignmentInd", credit_notes: "NoteAdd", general_ledger: "MenuBook",
  customer_ledger: "ReceiptLong", supplier_ledger: "Description", stock_invoices: "ReceiptLong",
};
const iconForModule = (m?: string) => (m && MODULE_ICON[m]) || "GridView";

/**
 * Header Quick Links: a pull-down row anchored to the bottom-center of the
 * header. Shows the user's role-predefined links (not removable) plus their own
 * personal links (removable), and lets them add a shortcut to any page their
 * role can access. Personal-only; predefined are admin-managed per role.
 */
export default function QuickLinksBar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { canView } = usePermissions();

  // Persist expand/collapse across navigation and remounts.
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ql-open") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ql-open", open ? "1" : "0");
  }, [open]);
  const [loading, setLoading] = useState(true);
  const [predefined, setPredefined] = useState<QuickLink[]>([]);
  const [personal, setPersonal] = useState<QuickLink[]>([]);
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null);
  const [busy, setBusy] = useState(false);

  // Measure the expanded panel so we can push the page content down by exactly
  // its height (the header is fixed, so the panel would otherwise overlay it).
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState(0);

  // Let a vertical mouse wheel scroll the (horizontal) link row sideways.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      if (el.scrollWidth <= el.clientWidth) return; // nothing to scroll
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, loading, predefined.length, personal.length]);

  useEffect(() => {
    if (!open) {
      setBarHeight(0);
      return;
    }
    const el = panelRef.current;
    if (!el) return;
    const update = () => setBarHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, predefined.length, personal.length]);

  // Shift the main scroll region down by the bar height while open (smoothly),
  // and restore on close. Re-reads the responsive base padding on each open.
  useEffect(() => {
    const main = document.querySelector("main") as HTMLElement | null;
    if (!main) return;
    if (open && barHeight > 0) {
      if (!main.dataset.qlBase) {
        main.dataset.qlBase = getComputedStyle(main).paddingTop;
      }
      main.style.transition = "padding-top 220ms ease";
      main.style.paddingTop = `calc(${main.dataset.qlBase} + ${barHeight}px)`;
    } else if (!open) {
      main.style.paddingTop = "";
      delete main.dataset.qlBase;
    }
  }, [open, barHeight]);

  // Safety: if the bar unmounts while open, restore the content padding.
  useEffect(() => {
    return () => {
      const main = document.querySelector("main") as HTMLElement | null;
      if (main && main.dataset.qlBase) {
        main.style.paddingTop = "";
        delete main.dataset.qlBase;
      }
    };
  }, []);

  const load = async () => {
    try {
      const data = await quickLinkService.getMine();
      setPredefined(data.predefined || []);
      setPersonal(data.personal || []);
    } catch {
      /* quick links are non-critical — fail quietly */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const existingPaths = new Set([...predefined, ...personal].map((l) => l.path));
  // Pages the user's role can access and hasn't already pinned.
  const addable = PAGE_REGISTRY.filter((p) => canView(p.moduleKey) && !existingPaths.has(p.path));

  const go = (path: string) => {
    router.push(path);
  };

  const handleAdd = async (page: { label: string; path: string; moduleKey: string }) => {
    setAddAnchor(null);
    setBusy(true);
    try {
      await quickLinkService.addPersonal({ label: page.label, path: page.path, module_key: page.moduleKey });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add quick link.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: number) => {
    setBusy(true);
    try {
      await quickLinkService.removePersonal(id);
      setPersonal((prev) => prev.filter((l) => l.id !== id));
    } catch {
      toast.error("Could not remove quick link.");
    } finally {
      setBusy(false);
    }
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");
  const total = predefined.length + personal.length;

  // Shared compact-pill styling so every link reads as one tight row.
  const pillSx = {
    flexShrink: 0,
    borderRadius: 1.5,
    minHeight: 28,
    py: 0,
    px: 1.25,
    whiteSpace: "nowrap",
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.75rem",
    lineHeight: 1.6,
    "& .MuiButton-startIcon": { mr: 0.5, "& svg": { fontSize: 16 } },
  } as const;

  return (
    <>
      {/* Pull-tab toggle, centered on the header's bottom edge */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 72,
          transform: "translate(-50%, -50%)",
          zIndex: 3,
        }}
      >
        <Tooltip title="Quick Links">
          <IconButton
            size="small"
            onClick={() => setOpen((o) => !o)}
            data-testid="quick-links-toggle"
            aria-label="Toggle quick links"
            sx={{
              width: 24,
              height: 24,
              bgcolor: "background.paper",
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              color: open ? "primary.main" : "text.secondary",
              "&:hover": { bgcolor: "background.paper", color: "primary.main" },
            }}
          >
            {open ? <ExpandLessIcon sx={{ fontSize: 15 }} /> : <ExpandMoreIcon sx={{ fontSize: 15 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Drop-down row (overlays page content — the header is fixed) */}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box
          ref={panelRef}
          data-testid="quick-links-bar"
          sx={{
            px: { xs: 1.5, md: 3 },
            py: 1.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.96),
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            gap: 1.25,
          }}
        >
          {/* Horizontally scrollable row of link buttons */}
          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              overflowX: "auto",
              overflowY: "hidden",
              py: 0.5,
              scrollbarWidth: "thin",
              "&::-webkit-scrollbar": { height: 6 },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: alpha(theme.palette.text.primary, 0.18),
                borderRadius: 3,
              },
              "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
            }}
          >
            {loading ? (
              <CircularProgress size={16} />
            ) : total === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                No quick links yet — add one with the + button →
              </Typography>
            ) : (
              <>
                {predefined.map((l) => {
                  const active = isActive(l.path);
                  return (
                    <Button
                      key={`p-${l.id}`}
                      size="small"
                      variant={active ? "contained" : "outlined"}
                      color={active ? "primary" : "inherit"}
                      onClick={() => go(l.path)}
                      startIcon={<AppIcon name={iconForModule(l.module_key)} fontSize="small" />}
                      data-testid={`quick-link-predefined-${l.id}`}
                      sx={{
                        ...pillSx,
                        borderColor: active ? undefined : alpha(theme.palette.divider, 0.8),
                      }}
                    >
                      {l.label}
                    </Button>
                  );
                })}
                {personal.map((l) => {
                  const active = isActive(l.path);
                  return (
                    <Box
                      key={`u-${l.id}`}
                      sx={{
                        position: "relative",
                        flexShrink: 0,
                        "&:hover .ql-remove": { opacity: 1, transform: "translateY(-50%) scale(1)", pointerEvents: "auto" },
                      }}
                    >
                      <Button
                        size="small"
                        variant={active ? "contained" : "outlined"}
                        color={active ? "primary" : "inherit"}
                        onClick={() => go(l.path)}
                        startIcon={<AppIcon name={iconForModule(l.module_key)} fontSize="small" />}
                        data-testid={`quick-link-personal-${l.id}`}
                        sx={{ ...pillSx, pr: 2.75, borderColor: active ? undefined : alpha(theme.palette.divider, 0.8) }}
                      >
                        {l.label}
                      </Button>
                      <Tooltip title="Remove">
                        <IconButton
                          className="ql-remove"
                          onClick={() => handleRemove(l.id)}
                          disabled={busy}
                          aria-label={`Remove ${l.label}`}
                          data-testid={`quick-link-remove-${l.id}`}
                          sx={{
                            position: "absolute",
                            top: "50%",
                            right: 4,
                            width: 17,
                            height: 17,
                            p: 0,
                            opacity: 0,
                            transform: "translateY(-50%) scale(0.7)",
                            pointerEvents: "none",
                            transition: "opacity 140ms ease, transform 140ms ease",
                            bgcolor: active ? "rgba(255,255,255,0.85)" : "#ffe0e0",
                            color: "error.main",
                            "&:hover": {
                              bgcolor: active ? "#fff" : "#ffc9c9",
                            },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  );
                })}
              </>
            )}
          </Box>

          {/* Add — pinned at the right end (icon-only) */}
          <Tooltip title={addable.length === 0 ? "All accessible pages already added" : "Add a quick link"}>
            <span style={{ flexShrink: 0, display: "inline-flex" }}>
              <IconButton
                size="small"
                onClick={(e) => setAddAnchor(e.currentTarget)}
                disabled={busy || addable.length === 0}
                data-testid="quick-links-add-btn"
                aria-label="Add a quick link"
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1.5,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: "primary.dark" },
                  "&.Mui-disabled": { bgcolor: alpha(theme.palette.action.disabled, 0.15), color: "text.disabled" },
                }}
              >
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Menu
            anchorEl={addAnchor}
            open={!!addAnchor}
            onClose={() => setAddAnchor(null)}
            slotProps={{ paper: { sx: { maxHeight: 360, width: 264 } } }}
          >
            {addable.length === 0 ? (
              <MenuItem disabled>No more pages to add</MenuItem>
            ) : (
              addable.map((p) => (
                <MenuItem
                  key={p.path}
                  onClick={() => handleAdd(p)}
                  data-testid={`quick-link-add-${p.moduleKey}`}
                  sx={{ gap: 1 }}
                >
                  <AppIcon name={iconForModule(p.moduleKey)} fontSize="small" />
                  {p.label}
                </MenuItem>
              ))
            )}
          </Menu>
        </Box>
      </Collapse>
    </>
  );
}

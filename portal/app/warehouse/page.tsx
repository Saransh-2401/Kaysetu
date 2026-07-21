"use client";
import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Avatar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  CircularProgress,
  Button,
  Divider,
  Tabs,
  Tab,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";

// Icons
import { InventoryIcon, WarningAmberIcon, AssignmentIcon, LocalShippingIcon, ArrowForwardIcon, PendingActionsIcon, HourglassEmptyIcon, ShoppingCartIcon, RefreshIcon } from "@/components/icons";

// Services
import { warehouseService } from "@/lib/warehouse-service";
import { distributorService, StockRequest } from "@/lib/distributor-service";
import { purchaseService, PurchaseOrder } from "@/lib/purchase-service";
import { authService } from "@/lib/auth-service";

// Format an amount as whole-rupee INR (no stray decimals like ₹…245.8).
const fmtINR = (n: any) => `₹ ${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Format a quantity without noisy trailing decimals (167.000 -> 167).
const fmtQty = (n: any) => {
  const v = Number(n) || 0;
  return Number.isInteger(v)
    ? v.toLocaleString("en-IN")
    : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

// Delivery-date urgency relative to today (used to flag incoming POs).
const deliveryUrgency = (d: any): "overdue" | "today" | "upcoming" | "none" => {
  if (!d) return "none";
  const due = new Date(d);
  if (isNaN(due.getTime())) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "upcoming";
};

const KpiCard = ({ title, value, icon, color, subtitle, loading, onClick, testId }: any) => {
  const theme = useTheme();
  return (
    <Paper
      data-animate-group
      elevation={0}
      onClick={onClick}
      data-testid={testId}
      sx={{
        p: 3,
        height: "100%",
        bgcolor: "background.paper",
        boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
        border: `1px solid ${alpha(color, 0.1)}`,
        borderRadius: 3,
        position: "relative",
        transition: "transform 0.2s, box-shadow 0.2s",
        cursor: onClick ? 'pointer' : 'default',
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: onClick ? `0px 8px 30px ${alpha(color, 0.15)}` : undefined,
        },
      }}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 80 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box sx={{ minWidth: 0, flex: 1, pr: 2 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom noWrap>
                {title}
              </Typography>
              <Typography
                variant="h5"
                fontWeight={800}
                color="text.primary"
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                }}
                title={typeof value === 'string' ? value : undefined}
              >
                {value}
              </Typography>
            </Box>
            <Avatar
              variant="rounded"
              sx={{
                bgcolor: alpha(color, 0.1),
                color: color,
                width: 48,
                height: 48,
                flexShrink: 0,
              }}
            >
              {icon}
            </Avatar>
          </Stack>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }} noWrap title={typeof subtitle === 'string' ? subtitle : undefined}>
              {subtitle}
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
};

export default function WarehouseOverview() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Data States
  const [stats, setStats] = useState({
    inventoryValue: 0,
    rawMaterialsCount: 0,
    productsCount: 0,
    pendingRequests: 0,
    requestsToPack: 0,
    requestsPacked: 0,
    requestsInTransit: 0,
    backorderedItems: 0,
    shortagesInProd: 0,
    shortagesToPack: 0,
    shortagesPacked: 0,
    shortagesInTransit: 0,
    pendingPurchaseOrders: 0
  });

  const [recentRequests, setRecentRequests] = useState<StockRequest[]>([]);
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [backorderedItems, setBackorderedItems] = useState<any[]>([]);
  const [lowStockRawMaterials, setLowStockRawMaterials] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [lowStockTab, setLowStockTab] = useState(0);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      // Stock requests/shortages come from DIST and purchase orders from PURCH.
      // A warehouse (INV) tenant may not own those modules, so skip their
      // fetches instead of 403-ing; the related tiles just read zero.
      const hasDist = authService.hasModule("DIST");
      const hasPurch = authService.hasModule("PURCH");
      const [
        rawResult,
        productsResult,
        requestsResult,
        shortagesResult,
        purchaseOrdersResult
      ] = await Promise.all([
        warehouseService.getItems(),
        warehouseService.getProducts(),
        hasDist ? distributorService.getStockRequests() : Promise.resolve({ results: [] }),
        hasDist ? distributorService.getShortages() : Promise.resolve({ results: [] }),
        hasPurch ? purchaseService.getPurchaseOrders() : Promise.resolve({ results: [] })
      ]);

      const raw = rawResult?.results || [];
      const products = productsResult?.results || [];

      // Handle potential paginated responses or direct arrays
      const requests = Array.isArray(requestsResult) ? requestsResult : (requestsResult as any)?.results || [];
      const shortages = Array.isArray(shortagesResult) ? shortagesResult : (shortagesResult as any)?.results || [];
      const pos = Array.isArray(purchaseOrdersResult) ? purchaseOrdersResult : (purchaseOrdersResult as any)?.results || [];

      const aggregatedShortages = shortages.reduce((acc: any[], current: any) => {
        const existing = acc.find(item => item.product_name === current.product_name);
        if (existing) {
          existing.shortage_quantity = Number(existing.shortage_quantity) + Number(current.shortage_quantity);
        } else {
          acc.push({ ...current, shortage_quantity: Number(current.shortage_quantity) });
        }
        return acc;
      }, []);

      // Calculate Totals
      const totalValue = products.reduce((acc: number, p: any) => acc + (Number(p.selling_price || 0) * (p.quantity || 0)), 0);

      // Calculate Request and Shortage breakdowns
      const requestsToPack = requests.filter((r: any) => ['approved', 'partial_fulfilled'].includes(r.status)).length;
      const requestsPacked = requests.filter((r: any) => ['packed'].includes(r.status)).length;
      const requestsInTransit = requests.filter((r: any) => ['in_transit'].includes(r.status)).length;

      const shortagesInProd = aggregatedShortages.filter((s: any) => ['pending', 'plan_created', 'in_production'].includes(s.status)).length;
      const shortagesToPack = aggregatedShortages.filter((s: any) => ['completed'].includes(s.status)).length;
      const shortagesPacked = aggregatedShortages.filter((s: any) => ['packed'].includes(s.status)).length;
      const shortagesInTransit = aggregatedShortages.filter((s: any) => ['in_transit'].includes(s.status)).length;

      setStats({
        inventoryValue: totalValue,
        rawMaterialsCount: (rawResult as any)?.count || raw.length,
        productsCount: (productsResult as any)?.count || products.length,
        pendingRequests: requestsToPack + requestsPacked + requestsInTransit,
        requestsToPack,
        requestsPacked,
        requestsInTransit,
        backorderedItems: aggregatedShortages.length,
        shortagesInProd,
        shortagesToPack,
        shortagesPacked,
        shortagesInTransit,
        pendingPurchaseOrders: pos.filter((p: any) => (p.receipt_status || 'pending') === 'pending').length
      });

      setRecentRequests(requests.slice(0, 5));

      const sortedPendingPOs = pos
        .filter((p: any) => (p.receipt_status || 'pending') === 'pending')
        .sort((a: any, b: any) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime());

      setPendingPOs(sortedPendingPOs.slice(0, 5));
      setBackorderedItems(aggregatedShortages.slice(0, 5));

      const lowRaw = raw.filter((r: any) => Number(r.current_stock) > 0 && Number(r.current_stock) <= Number(r.reorder_level));
      const lowProd = products.filter((p: any) => Number(p.quantity) > 0 && Number(p.quantity) <= Number(p.low_stock_threshold));

      setLowStockRawMaterials(lowRaw);
      setLowStockProducts(lowProd);

    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to load warehouse dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const COLORS = [theme.palette.primary.main, theme.palette.secondary.main];

  const stockBreakdown = [
    { name: "Raw Materials", value: stats.rawMaterialsCount, href: "/warehouse/raw-materials" },
    { name: "Finished Products", value: stats.productsCount, href: "/warehouse/our-products" },
  ];
  const stockBreakdownTotal = stockBreakdown.reduce((a, s) => a + (s.value || 0), 0);

  // A threshold breach IS a critical alert — surfacing low-stock items here
  // removes the contradiction of "No critical shortages" while the Low Stock
  // panel shows a breach. Backorders rank first (error), then low stock (warning).
  const criticalAlerts = [
    ...backorderedItems.map((b: any) => ({
      key: `bo-${b.id ?? b.product_name}`,
      level: "error" as const,
      title: b.product_name,
      detail: `Backorder shortage: ${fmtQty(b.shortage_quantity)} ${b.uom || ""}`.trim(),
    })),
    ...lowStockRawMaterials.map((r: any) => ({
      key: `lr-${r.id}`,
      level: "warning" as const,
      title: r.item_name,
      detail: `Below reorder level — ${fmtQty(r.current_stock)} / ${fmtQty(r.reorder_level)} ${r.uom || ""}`.trim(),
    })),
    ...lowStockProducts.map((p: any) => ({
      key: `lp-${p.id}`,
      level: "warning" as const,
      title: p.product_name,
      detail: `Below threshold — ${fmtQty(p.quantity)} / ${fmtQty(p.low_stock_threshold)} ${p.uom || ""}`.trim(),
    })),
  ];

  return (
    <>
      <Box>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* HEADER */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
                Warehouse Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Comprehensive operations overview for Materials, Requests, and Purchases.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => fetchAllData()}
              sx={{ borderRadius: 1 }}
            >
              Refresh
            </Button>
          </Stack>

          {/* KPI CARDS */}
          <Grid container spacing={3} mb={4}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                title="TOTAL INVENTORY VALUE"
                value={fmtINR(stats.inventoryValue)}
                icon={<InventoryIcon />}
                color={theme.palette.primary.main}
                subtitle={`${stats.rawMaterialsCount} Raw Materials | ${stats.productsCount} Products`}
                loading={loading}
                onClick={() => router.push('/warehouse/our-products')}
                testId="wh-kpi-inventory-value"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                title="STOCK REQUESTS IN PROGRESS"
                value={stats.pendingRequests}
                icon={<AssignmentIcon />}
                color={theme.palette.warning.main}
                subtitle={`${stats.requestsToPack} To Pack | ${stats.requestsPacked} Packed | ${stats.requestsInTransit} In Transit`}
                loading={loading}
                onClick={() => router.push('/stock-requests?status=approved,partial_fulfilled,packed,in_transit')}
                testId="wh-kpi-stock-requests"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                title="BACKORDERS IN PROGRESS"
                value={stats.shortagesInProd + stats.shortagesToPack + stats.shortagesPacked + stats.shortagesInTransit}
                icon={<HourglassEmptyIcon />}
                color={theme.palette.error.main}
                subtitle={`${stats.shortagesInProd} In Prod | ${stats.shortagesToPack} To Pack | ${stats.shortagesPacked} Packed | ${stats.shortagesInTransit} In Transit`}
                loading={loading}
                onClick={() => router.push('/backordered?status=pending,plan_created,in_production,completed,packed,in_transit')}
                testId="wh-kpi-backorders"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                title="OPEN PURCHASE ORDERS"
                value={stats.pendingPurchaseOrders}
                icon={<ShoppingCartIcon />}
                color={theme.palette.info.main}
                subtitle={
                  pendingPOs.length > 0
                    ? `Next: ${pendingPOs[0].supplier_name} · ${new Date(pendingPOs[0].delivery_date).toLocaleDateString()}`
                    : "Incoming from suppliers"
                }
                loading={loading}
                onClick={() => router.push('/purchase-orders?status=pending')}
                testId="wh-kpi-open-pos"
              />
            </Grid>
          </Grid>

          {/* CHARTS & SUMMARY */}
          {/* CHARTS & SUMMARY & ALERTS */}
          <Grid container spacing={3} mb={4}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, height: 400, borderRadius: 3, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Stock Breakdown
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <ResponsiveContainer width="100%" height="78%">
                  <PieChart data={stockBreakdown}>
                    <Pie
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ value, percent }: any) =>
                        stockBreakdownTotal > 0 ? `${value} (${Math.round((percent || 0) * 100)}%)` : ""
                      }
                      labelLine={false}
                      onClick={(_: any, index: number) => router.push(stockBreakdown[index].href)}
                      style={{ cursor: "pointer" }}
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v: any, n: any) => [`${v} items`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <Stack direction="row" justifyContent="center" spacing={4} mt={-1}>
                  {stockBreakdown.map((seg, i) => (
                    <Stack
                      key={seg.name}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      onClick={() => router.push(seg.href)}
                      data-testid={`wh-stock-breakdown-${i === 0 ? "raw" : "products"}`}
                      sx={{ cursor: "pointer" }}
                    >
                      <Box sx={{ width: 12, height: 12, bgcolor: COLORS[i], borderRadius: "50%" }} />
                      <Typography variant="caption" fontWeight={600}>
                        {seg.name} ({seg.value})
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            {/* QUICK ACTIONS / ALERTS */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, height: 400, borderRadius: 3, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", display: 'flex', flexDirection: 'column' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="h6" fontWeight={700}>
                    Critical Alerts
                  </Typography>
                  {criticalAlerts.length > 0 && (
                    <Chip size="small" color="error" label={criticalAlerts.length} sx={{ fontWeight: 700 }} />
                  )}
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2} sx={{ flexGrow: 1, overflow: 'auto' }} data-testid="wh-critical-alerts">
                  {criticalAlerts.length > 0 ? (
                    criticalAlerts.map((item) => {
                      const c = item.level === "error" ? theme.palette.error.main : theme.palette.warning.main;
                      return (
                        <Box key={item.key} sx={{ p: 1.5, bgcolor: alpha(c, 0.05), borderRadius: 2, border: `1px solid ${alpha(c, 0.1)}` }}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <WarningAmberIcon sx={{ color: c }} fontSize="small" />
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{item.title}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.detail}</Typography>
                            </Box>
                          </Stack>
                        </Box>
                      );
                    })
                  ) : (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">No critical alerts. All stock above threshold.</Typography>
                    </Box>
                  )}
                </Stack>
                <Button fullWidth variant="outlined" data-testid="wh-view-all-backorders-btn" sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }} onClick={() => router.push('/backordered')}>
                  View All Backorders
                </Button>
              </Paper>
            </Grid>

            {/* LOW STOCK ALERTS */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, height: 400, borderRadius: 3, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Low Stock Alert
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Tabs value={lowStockTab} onChange={(_, newValue) => setLowStockTab(newValue)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Tab data-testid="wh-lowstock-tab-raw" label={`Raw Materials (${lowStockRawMaterials.length})`} sx={{ fontWeight: 600 }} />
                  <Tab data-testid="wh-lowstock-tab-products" label={`Our Products (${lowStockProducts.length})`} sx={{ fontWeight: 600 }} />
                </Tabs>

                <Stack spacing={2} sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {lowStockTab === 0 ? (
                    lowStockRawMaterials.length > 0 ? (
                      lowStockRawMaterials.map((item, idx) => (
                        <Box key={idx} sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.05), borderRadius: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}` }}>
                          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <WarningAmberIcon color="warning" fontSize="small" />
                              <Box>
                                <Typography variant="body2" fontWeight={700}>{item.item_name}</Typography>
                                <Typography variant="caption" color="text.secondary">Current Stock: {fmtQty(item.current_stock)} {item.uom}</Typography>
                              </Box>
                            </Stack>
                            <Chip size="small" label={`Threshold: ${fmtQty(item.reorder_level)}`} color="warning" variant="outlined" />
                          </Stack>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>No raw materials are low in stock.</Typography>
                    )
                  ) : (
                    lowStockProducts.length > 0 ? (
                      lowStockProducts.map((item, idx) => (
                        <Box key={idx} sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.05), borderRadius: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}` }}>
                          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <WarningAmberIcon color="warning" fontSize="small" />
                              <Box>
                                <Typography variant="body2" fontWeight={700}>{item.product_name}</Typography>
                                <Typography variant="caption" color="text.secondary">Current Stock: {fmtQty(item.quantity)} {item.uom}</Typography>
                              </Box>
                            </Stack>
                            <Chip size="small" label={`Threshold: ${fmtQty(item.low_stock_threshold)}`} color="warning" variant="outlined" />
                          </Stack>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>No products are low in stock.</Typography>
                    )
                  )}
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          {/* RECENT STOCK REQUESTS & PURCHASE ORDERS */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1" fontWeight={700}>Recent Stock Requests</Typography>
                  <Button size="small" sx={{ textTransform: 'none' }} onClick={() => window.location.href = '/stock-requests'}>View More</Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Order #</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Distributor</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><CircularProgress size={20} /></TableCell></TableRow>
                      ) : recentRequests.length > 0 ? (
                        recentRequests.map((req) => (
                          <TableRow key={req.id} hover data-testid={`wh-recent-request-${req.id}`}>
                            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>{req.request_number}</TableCell>
                            <TableCell>{req.distributor_name}</TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {(req as any).request_date ? new Date((req as any).request_date).toLocaleDateString() : "—"}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={req.status}
                                size="small"
                                color={req.status === 'pending' ? 'warning' : 'success'}
                                variant="outlined"
                                sx={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '0.65rem' }}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>No recent requests.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1" fontWeight={700}>Incoming Purchase Orders</Typography>
                  <Button size="small" sx={{ textTransform: 'none' }} onClick={() => window.location.href = '/purchase-orders'}>View More</Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>PO #</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Est. Delivery</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}><CircularProgress size={20} /></TableCell></TableRow>
                      ) : pendingPOs.length > 0 ? (
                        pendingPOs.map((po) => {
                          const urgency = deliveryUrgency(po.delivery_date);
                          const urgencyColor =
                            urgency === "overdue" ? theme.palette.error.main
                              : urgency === "today" ? theme.palette.warning.main
                                : theme.palette.text.secondary;
                          return (
                          <TableRow key={po.id} hover data-testid={`wh-incoming-po-${po.id}`}>
                            <TableCell sx={{ fontWeight: 600, py: 1.5 }}>{po.po_number}</TableCell>
                            <TableCell>{po.supplier_name}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end">
                                {(urgency === "overdue" || urgency === "today") && (
                                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: urgencyColor }} />
                                )}
                                <Typography variant="caption" fontWeight={urgency === "upcoming" ? 600 : 800} sx={{ color: urgencyColor }}>
                                  {po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : "—"}
                                  {urgency === "overdue" ? " · Overdue" : urgency === "today" ? " · Today" : ""}
                                </Typography>
                              </Stack>
                            </TableCell>
                          </TableRow>
                          );
                        })
                      ) : (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}>No pending purchase orders.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>

        </motion.div>
      </Box>
    </>
  );
}

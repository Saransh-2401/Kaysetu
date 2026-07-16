"use client";
import { toast } from "sonner";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
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
} from "@mui/material";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { useRouter } from "next/navigation";

// Icons
import { AddShoppingCartIcon, LocalShippingIcon, ReceiptLongIcon, InventoryIcon, ArrowForwardIcon, TrendingUpIcon, WarningAmberIcon } from "@/components/icons";

import { distributorService, StockRequest, DistributorInventory } from "@/lib/distributor-service";
import { authService, UserProfile } from "@/lib/auth-service";

// --- COMPONENTS ---

const StatCard = ({ title, value, icon, color, subtext }: any) => (
  <Paper
    data-animate-group
    elevation={0}
    sx={{
      p: 3,
      height: "100%",
      bgcolor: "background.paper",
      boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
      border: `1px solid ${alpha(color, 0.1)}`,
      position: "relative",
      overflow: "hidden",
      borderRadius: 1,
    }}
  >
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="flex-start"
      mb={2}
    >
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
          gutterBottom
        >
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={800} color="text.primary" sx={{ mt: 1 }}>
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
          borderRadius: 1,
        }}
      >
        {icon}
      </Avatar>
    </Stack>

    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "flex", alignItems: "center", gap: 0.5, fontWeight: 500 }}
    >
      {subtext}
    </Typography>
  </Paper>
);

export default function DistributorOverview() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [inventory, setInventory] = useState<DistributorInventory[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [userData, requestsData, inventoryData] = await Promise.all([
          authService.getCurrentUser(),
          distributorService.getStockRequests(),
          distributorService.getInventory()
        ]);

        if (userData.role !== "distributor") {
          router.push("/dashboard");
          return;
        }

        setUser(userData);
        setRequests(Array.isArray(requestsData) ? requestsData : (requestsData as any).results || []);
        setInventory(Array.isArray(inventoryData) ? inventoryData : (inventoryData as any).results || []);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        toast.error("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, [router]);

  // Derived Stats
  const stats = useMemo(() => {
    const totalRequests = requests.length;
    const pendingRequests = requests.filter(r => r.status !== 'delivered' && r.status !== 'cancelled').length;

    let outstandingDue = 0;
    requests.forEach(req => {
      if (req.payment_status !== 'paid' && req.invoices) {
        req.invoices.forEach(inv => {
          if (inv.payment_status !== 'paid') {
            outstandingDue += Number(inv.total_amount);
          }
        });
      }
    });

    const lowStockItems = inventory.filter(p => p.current_stock <= p.low_stock_threshold).length;

    return {
      totalRequests,
      pendingRequests,
      outstandingDue,
      lowStockItems
    };
  }, [requests, inventory]);

  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    interface ChartDataEntry {
      month: string;
      amount: number;
      fullDate: Date;
    }
    const last6Months: ChartDataEntry[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({
        month: months[d.getMonth()],
        amount: 0,
        fullDate: d
      });
    }

    requests.forEach(req => {
      const reqDate = new Date(req.request_date);
      const monthEntry = last6Months.find((m: ChartDataEntry) =>
        m.fullDate.getMonth() === reqDate.getMonth() &&
        m.fullDate.getFullYear() === reqDate.getFullYear()
      );
      if (monthEntry) {
        const total = req.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
        monthEntry.amount += total;
      }
    });

    return last6Months;
  }, [requests]);

  const recentOrders = useMemo(() => {
    return requests.slice(0, 5);
  }, [requests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "success";
      case "partially_delivered": return "success";
      case "in_transit": return "info";
      case "pending": return "warning";
      case "cancelled": return "error";
      default: return "default";
    }
  };

  if (loading && !user) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* 1. HEADER SECTION */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems="center"
          mb={4}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ letterSpacing: "-0.02em" }}
            >
              Partner Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Welcome back, <b>{user?.full_name || 'Acme Corp'}</b>. Here is your business snapshot.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddShoppingCartIcon />}
            size="large"
            onClick={() => router.push('/distributor-products')}
            sx={{
              borderRadius: "12px",
              px: 4,
              py: 1.2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
              textTransform: 'none',
              fontWeight: 700
            }}
          >
            Create New Request
          </Button>
        </Stack>

        {/* 2. KEY METRICS */}
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }} onClick={() => router.push('/stock-requests')} sx={{ cursor: 'pointer' }}>
            <StatCard
              title="Total Requests"
              value={stats.totalRequests}
              icon={<ReceiptLongIcon />}
              color={theme.palette.primary.main}
              subtext={<><TrendingUpIcon fontSize="inherit" color="success" /> Life-time replenishment orders</>}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }} onClick={() => router.push('/stock-requests')} sx={{ cursor: 'pointer' }}>
            <StatCard
              title="Pending Fulfillment"
              value={stats.pendingRequests}
              icon={<LocalShippingIcon />}
              color={theme.palette.warning.main}
              subtext="Orders awaiting delivery"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }} onClick={() => router.push('/distributor/payments/new')} sx={{ cursor: 'pointer' }}>
            <StatCard
              title="Outstanding Due"
              value={`₹${stats.outstandingDue.toLocaleString()}`}
              icon={<WarningAmberIcon />}
              color={theme.palette.error.main}
              subtext="Unpaid invoice total"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }} onClick={() => router.push('/distributor-products')} sx={{ cursor: 'pointer' }}>
            <StatCard
              title="Low Stock Alerts"
              value={stats.lowStockItems}
              icon={<InventoryIcon />}
              color={theme.palette.secondary.main}
              subtext="Items below threshold"
            />
          </Grid>
        </Grid>

        {/* 3. CHARTS & INSIGHTS */}
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper
              sx={{
                p: 3,
                height: 400,
                borderRadius: 1,
                boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
              }}
            >
              <Stack direction="row" justifyContent="space-between" mb={3}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Replenishment Trends
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monthly request volume (Last 6 months)
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => router.push('/stock-requests')}
                >
                  View Details
                </Button>
              </Stack>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={alpha(theme.palette.divider, 0.1)}
                  />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip
                    cursor={{ fill: alpha(theme.palette.primary.main, 0.1) }}
                    formatter={(value) => [`₹${value}`, 'Amount']}
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    fill={theme.palette.primary.main}
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              sx={{
                p: 3,
                height: 400,
                borderRadius: 1,
                boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Inventory Shortcuts
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Quick access to your stock management
              </Typography>

              <Stack spacing={2} flexGrow={1}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AddShoppingCartIcon />}
                  onClick={() => router.push('/sales-orders')}
                  sx={{ py: 1.5, borderRadius: 2, justifyContent: 'flex-start', px: 2 }}
                >
                  New Orders
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<LocalShippingIcon />}
                  onClick={() => router.push('/stock-requests')}
                  sx={{ py: 1.5, borderRadius: 2, justifyContent: 'flex-start', px: 2 }}
                >
                  Track Shipments
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<ReceiptLongIcon />}
                  onClick={() => router.push('/distributor/payments/history')}
                  sx={{ py: 1.5, borderRadius: 2, justifyContent: 'flex-start', px: 2 }}
                >
                  Payment Records
                </Button>
              </Stack>

              <Button
                variant="contained"
                fullWidth
                onClick={() => router.push('/distributor-products')}
                sx={{ mt: 2, borderRadius: 2 }}
              >
                Browse Full Catalog
              </Button>
            </Paper>
          </Grid>
        </Grid>

        {/* 4. RECENT ORDERS TABLE */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
          }}
        >
          <Box
            sx={{
              p: 3,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6" fontWeight={700}>
              Recent Stock Requests
            </Typography>
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => router.push('/stock-requests')}
            >
              View All
            </Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}
                >
                  <TableCell sx={{ fontWeight: 700, pl: 4 }}>
                    REQUEST #
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>ITEMS</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>PAYMENT</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                  <TableCell
                    sx={{ fontWeight: 700, textAlign: "right", pr: 4 }}
                  >
                    ACTION
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell
                      sx={{ pl: 4, fontWeight: 600, color: 'primary.main' }}
                    >
                      {order.request_number}
                    </TableCell>
                    <TableCell>{new Date(order.request_date).toLocaleDateString()}</TableCell>
                    <TableCell>{order.items.length}</TableCell>
                    <TableCell>
                      <Chip
                        label={order.payment_status.toUpperCase()}
                        size="small"
                        variant="outlined"
                        color={order.payment_status === 'paid' ? 'success' : 'warning'}
                        sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.status.toUpperCase()}
                        size="small"
                        color={getStatusColor(order.status) as any}
                        sx={{ borderRadius: 1, fontWeight: 700, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ pr: 4 }}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => router.push(`/stock-requests?id=${order.id}`)}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {recentOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      No stock requests found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </motion.div>
    </>
  );
}

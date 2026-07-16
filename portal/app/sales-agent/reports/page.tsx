"use client";
import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Stack, Avatar, useTheme, Grid, alpha, CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { toast } from "sonner";

import { MonetizationOnIcon, ShoppingCartIcon, DirectionsWalkIcon, SpeedIcon } from "@/components/icons";

import { analyticsService } from "@/lib/analytics-service";
import { useChartPalette } from "@/components/admin/analytics/kit";

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

interface Overview {
  sales_trend: { month: string; sales: number }[];
  activity_mix: { name: string; value: number }[];
  kpis: { total_sales: number; orders: number; visits: number; conversion: number };
}

const KpiCard = ({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) => (
  <Paper data-animate-group elevation={0} sx={{ p: 2.5, border: `1px solid ${alpha(color, 0.12)}`, height: "100%" }}>
    <Stack direction="row" alignItems="center" spacing={2}>
      <Avatar variant="rounded" sx={{ bgcolor: alpha(color, 0.1), color, width: 44, height: 44 }}>{icon}</Avatar>
      <Box>
        <Typography variant="h6" fontWeight={800}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
      </Box>
    </Stack>
  </Paper>
);

export default function SalesAgentReports() {
  const theme = useTheme();
  const cp = useChartPalette();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await analyticsService.getSalesAgentOverview();
        if (active) setData(res as Overview);
      } catch {
        if (active) toast.error("Failed to load your reports.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  if (!data) return <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Reports unavailable.</Typography>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={800}>My Performance</Typography>
        <Typography variant="body2" color="text.secondary">Month-to-date sales and activity.</Typography>
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Sales (MTD)" value={inr(data.kpis.total_sales)} icon={<MonetizationOnIcon />} color={theme.palette.success.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Orders (MTD)" value={String(data.kpis.orders)} icon={<ShoppingCartIcon />} color={theme.palette.warning.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Visits (MTD)" value={String(data.kpis.visits)} icon={<DirectionsWalkIcon />} color={theme.palette.primary.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Conversion" value={`${data.kpis.conversion}%`} icon={<SpeedIcon />} color={theme.palette.secondary.main} /></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={0} sx={{ p: 3, height: 380, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }} data-testid="agent-sales-trend">
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Sales Trend (6 months)</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={data.sales_trend}>
                <defs>
                  <linearGradient id="agentTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => inr(Number(v))} width={70} />
                <Tooltip formatter={(value) => [inr(Number(value)), "Sales"]} />
                <Area type="monotone" dataKey="sales" stroke={theme.palette.primary.main} strokeWidth={3} fillOpacity={1} fill="url(#agentTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ p: 3, height: 380, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }} data-testid="agent-activity-mix">
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Activity Mix (MTD)</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie data={data.activity_mix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {data.activity_mix.map((_, i) => <Cell key={i} fill={cp.chart[i % cp.chart.length]} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </motion.div>
  );
}

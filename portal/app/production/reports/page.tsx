"use client";
import React, { useState, useEffect } from "react";
import {
  Box, Grid, Paper, Typography, Stack, Avatar, useTheme, alpha, Chip, CircularProgress, Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { toast } from "sonner";

import { FactoryIcon, PlayCircleIcon, CheckCircleIcon, Inventory2Icon, InfoOutlinedIcon } from "@/components/icons";

import { productionService, WorkOrder } from "@/lib/production-service";
import { useChartPalette } from "@/components/admin/analytics/kit";

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const KpiCard = ({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) => (
  <Paper data-animate-group elevation={0} sx={{ p: 2.5, height: "100%", border: `1px solid ${alpha(color, 0.12)}` }}>
    <Stack direction="row" alignItems="center" spacing={2}>
      <Avatar variant="rounded" sx={{ bgcolor: alpha(color, 0.1), color, width: 44, height: 44 }}>{icon}</Avatar>
      <Box>
        <Typography variant="h6" fontWeight={800}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
      </Box>
    </Stack>
  </Paper>
);

export default function ProductionReports() {
  const theme = useTheme();
  const cp = useChartPalette();
  const STATUS_COLORS: Record<string, string> = {
    completed: cp.success, in_progress: cp.warning, planned: cp.info, on_hold: theme.palette.text.disabled, cancelled: cp.error,
  };
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await productionService.getWorkOrders({ page_size: 1000 });
        if (active) setWorkOrders(res.results || []);
      } catch {
        if (active) toast.error("Failed to load production reports.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;

  const total = workOrders.length;
  const inProgress = workOrders.filter((w) => w.status === "in_progress").length;
  const completed = workOrders.filter((w) => w.status === "completed").length;
  const unitsProduced = workOrders.reduce((s, w) => s + (Number(w.produced_quantity) || 0), 0);

  const statusCounts = workOrders.reduce<Record<string, number>>((acc, w) => {
    acc[w.status] = (acc[w.status] || 0) + 1; return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([k, v]) => ({ name: titleCase(k), key: k, value: v }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={800}>Production Reports</Typography>
        <Typography variant="body2" color="text.secondary">Work-order output and status.</Typography>
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Total Work Orders" value={String(total)} icon={<FactoryIcon />} color={theme.palette.info.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="In Progress" value={String(inProgress)} icon={<PlayCircleIcon />} color={theme.palette.warning.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Completed" value={String(completed)} icon={<CheckCircleIcon />} color={theme.palette.success.main} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Units Produced" value={unitsProduced.toLocaleString("en-IN")} icon={<Inventory2Icon />} color={theme.palette.secondary.main} /></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 3, height: 360, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }} data-testid="production-wo-status">
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Work Orders by Status</Typography>
            {statusData.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>No work orders yet.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {statusData.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key] || theme.palette.text.disabled} />)}
                  </Pie>
                  <Tooltip /><Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 3, height: 360, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, display: "flex", flexDirection: "column" }} data-testid="production-advanced-metrics">
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <InfoOutlinedIcon color="action" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Advanced Metrics</Typography>
            </Stack>
            <Alert severity="info" sx={{ mb: 2 }}>
              OEE, downtime analysis, and cost variance are <b>not yet tracked</b>. They require production
              data capture (actual run times, good/reject counts, downtime logs, and actual costs) — planned
              for a future release.
            </Alert>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {["Overall Equipment Effectiveness (OEE)", "Downtime by reason", "Standard vs actual cost variance"].map((m) => (
                <Stack key={m} direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.action.hover, 0.04), border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                  <Typography variant="body2" color="text.secondary">{m}</Typography>
                  <Chip size="small" label="Not tracked" variant="outlined" />
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </motion.div>
  );
}

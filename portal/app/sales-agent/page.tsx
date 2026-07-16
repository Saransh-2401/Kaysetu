"use client";
import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Stack, Avatar, Chip, LinearProgress, IconButton,
  useTheme, alpha, Grid, CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, Tooltip,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { toast } from "sonner";

import { DirectionsWalkIcon, MonetizationOnIcon, ShoppingCartIcon, LocationOnIcon, MapIcon, CheckCircleIcon, RadioButtonUncheckedIcon } from "@/components/icons";

import { analyticsService } from "@/lib/analytics-service";

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (cur: number, target?: number) => (target && target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0);
const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

interface Overview {
  agent_name: string;
  today: { sales: number; orders: number; visits_done: number; visits_total: number };
  targets: { revenue: number; visits: number; orders: number } | null;
  todays_route: { id: number; time: string | null; customer: string; address: string; status: string }[];
  weekly_sales: { day: string; date: string; sales: number }[];
  sales_trend: { month: string; sales: number }[];
  activity_mix: { name: string; value: number }[];
  kpis: { total_sales: number; orders: number; visits: number; conversion: number };
}

const MetricCard = ({ title, value, subtext, icon, color, progress }: {
  title: string; value: string; subtext: string; icon: React.ReactNode; color: string; progress: number;
}) => (
  <Paper data-animate-group elevation={0} sx={{ p: 2, height: "100%", border: `1px solid ${alpha(color, 0.1)}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
      <Avatar variant="rounded" sx={{ bgcolor: alpha(color, 0.1), color, width: 40, height: 40, borderRadius: 2 }}>{icon}</Avatar>
      <Typography variant="h6" fontWeight={800}>{value}</Typography>
    </Stack>
    <Box>
      <Typography variant="body2" color="text.secondary" fontWeight={600} mb={1}>{title}</Typography>
      <LinearProgress variant="determinate" value={progress} sx={{ height: 6, bgcolor: alpha(color, 0.1), "& .MuiLinearProgress-bar": { bgcolor: color } }} />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{subtext}</Typography>
    </Box>
  </Paper>
);

const VisitCard = ({ visit, isNext }: { visit: Overview["todays_route"][number]; isNext: boolean }) => {
  const theme = useTheme();
  const done = visit.status === "completed";
  return (
    <Paper elevation={0} data-testid={`agent-visit-card-${visit.id}`}
      sx={{ p: 2, mb: 2, bgcolor: isNext ? alpha(theme.palette.primary.main, 0.05) : "background.paper", border: isNext ? `1px solid ${theme.palette.primary.main}` : `1px solid ${alpha(theme.palette.divider, 0.5)}`, position: "relative", overflow: "hidden" }}>
      {isNext && <Box sx={{ position: "absolute", top: 0, right: 0, bgcolor: "primary.main", color: "white", px: 1.5, py: 0.5, borderRadius: "0 0 0 12px", fontSize: "0.7rem", fontWeight: 700 }}>NEXT STOP</Box>}
      <Stack direction="row" alignItems="center" spacing={2}>
        <Stack alignItems="center" minWidth={56}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">{fmtTime(visit.time)}</Typography>
          {done ? <CheckCircleIcon color="success" fontSize="small" sx={{ mt: 0.5 }} />
            : isNext ? <LocationOnIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
            : <RadioButtonUncheckedIcon color="disabled" fontSize="small" sx={{ mt: 0.5 }} />}
        </Stack>
        <Box flexGrow={1}>
          <Typography variant="subtitle2" fontWeight={700}>{visit.customer}</Typography>
          <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
            <MapIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            <Typography variant="caption" color="text.secondary" noWrap>{visit.address || "—"}</Typography>
          </Stack>
        </Box>
        <Chip size="small" label={visit.status} sx={{ textTransform: "capitalize", fontWeight: 600, height: 22 }} color={done ? "success" : isNext ? "primary" : "default"} />
      </Stack>
    </Paper>
  );
};

export default function SalesAgentOverview() {
  const theme = useTheme();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await analyticsService.getSalesAgentOverview();
        if (active) setData(res as Overview);
      } catch {
        if (active) toast.error("Failed to load your dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  if (!data) return <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Dashboard unavailable.</Typography>;

  const nextIdx = data.todays_route.findIndex((v) => v.status !== "completed");

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>Hello, {data.agent_name} 👋</Typography>
        <Typography variant="body2" color="text.secondary">
          {data.targets ? <>Monthly target <b>{inr(data.targets.revenue)}</b> — you&apos;re at {pct(data.kpis.total_sales, data.targets.revenue)}%.</> : <>Here&apos;s your activity for today.</>}
        </Typography>
      </Box>

      <Grid container spacing={2} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <MetricCard title="Today's Sales" value={inr(data.today.sales)} subtext={`MTD: ${inr(data.kpis.total_sales)}${data.targets ? ` / ${inr(data.targets.revenue)}` : ""}`} icon={<MonetizationOnIcon />} color={theme.palette.success.main} progress={pct(data.kpis.total_sales, data.targets?.revenue)} />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <MetricCard title="Visits Today" value={`${data.today.visits_done}/${data.today.visits_total}`} subtext={`MTD visits: ${data.kpis.visits}${data.targets ? ` / ${data.targets.visits}` : ""}`} icon={<DirectionsWalkIcon />} color={theme.palette.primary.main} progress={pct(data.kpis.visits, data.targets?.visits)} />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <MetricCard title="Orders Today" value={String(data.today.orders)} subtext={`MTD orders: ${data.kpis.orders}${data.targets ? ` / ${data.targets.orders}` : ""}`} icon={<ShoppingCartIcon />} color={theme.palette.warning.main} progress={pct(data.kpis.orders, data.targets?.orders)} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, height: "100%" }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" fontWeight={800}>Today&apos;s Route</Typography>
              <Chip label={`${data.today.visits_done}/${data.today.visits_total} done`} color="primary" size="small" sx={{ fontWeight: 700 }} />
            </Stack>
            {data.todays_route.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>No visits scheduled for today.</Typography>
            ) : data.todays_route.map((visit, i) => <VisitCard key={visit.id} visit={visit} isNext={i === nextIdx} />)}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, height: "100%", minHeight: 350 }} elevation={0}>
            <Typography variant="h6" fontWeight={800} gutterBottom>Weekly Performance</Typography>
            <Typography variant="body2" color="text.secondary" mb={4}>Your sales over the last 7 days.</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.weekly_sales}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} formatter={(value) => [inr(Number(value)), "Sales"]} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="sales" stroke={theme.palette.primary.main} strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </motion.div>
  );
}

"use client";
import React, { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Grid, Stack, Typography,
  Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, useTheme, alpha,
} from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { CloseIcon } from "@/components/icons";
import { analyticsService } from "@/lib/analytics-service";

export interface DrillEntity {
  type: "agent" | "distributor";
  id: number;
  name: string;
}

interface EntityDetail {
  id: number;
  name: string;
  type: "agent" | "distributor";
  city: string;
  period: { from: string; to: string };
  revenue: { primary: number; secondary: number; total: number };
  products: { product: string; total: number; qty: number }[];
  trend: { month: string; primary: number; secondary: number }[];
  orders?: number;
  visits?: number;
  new_clients?: number;
  attendance_days?: number;
  requests?: number;
  total_clients?: number;
}

const fmtFull = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtNum = (n: number) => (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtK = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return `${n}`;
};

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ p: 1.5, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, height: "100%" }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.4, fontSize: "0.62rem" }}>{label}</Typography>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: color || "text.primary", lineHeight: 1.3 }}>{value}</Typography>
    </Paper>
  );
};

export default function EntityDetailDialog({
  entity, fromDate, toDate, onClose,
}: {
  entity: DrillEntity | null;
  fromDate: string;
  toDate: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [data, setData] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const open = !!entity;

  useEffect(() => {
    if (!entity) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setData(null);
      try {
        const res = await analyticsService.getAdminEntityDetail({
          type: entity.type,
          id: String(entity.id),
          from_date: fromDate,
          to_date: toDate,
        });
        if (active) setData(res as EntityDetail);
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [entity, fromDate, toDate]);

  const isAgent = entity?.type === "agent";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
          <Typography variant="h6" fontWeight={800}>{entity?.name || "—"}</Typography>
          <Chip size="small" label={isAgent ? "Sales Agent" : "Distributor"}
            color={isAgent ? "primary" : "secondary"} sx={{ fontWeight: 700, height: 22 }} />
          {data?.city && <Chip size="small" variant="outlined" label={data.city} sx={{ height: 22 }} />}
        </Stack>
        {data?.period && (
          <Typography variant="caption" color="text.secondary">
            {data.period.from} → {data.period.to}
          </Typography>
        )}
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading || !data ? (
          <Stack spacing={2}>
            <Grid container spacing={1.5}>
              {[...Array(4)].map((_, i) => <Grid key={i} size={{ xs: 6, md: 3 }}><Skeleton variant="rounded" height={64} /></Grid>)}
            </Grid>
            <Skeleton variant="rounded" height={240} />
          </Stack>
        ) : (
          <>
            {/* Revenue + entity stats */}
            <Grid container spacing={1.5} mb={2}>
              <Grid size={{ xs: 6, md: 3 }}><Stat label="Total Sales" value={fmtFull(data.revenue.total)} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Stat label="Primary" value={fmtFull(data.revenue.primary)} color="#1976d2" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Stat label="Secondary" value={fmtFull(data.revenue.secondary)} color="#7b1fa2" /></Grid>
              {isAgent ? (
                <Grid size={{ xs: 6, md: 3 }}><Stat label="Attendance (days)" value={fmtNum(data.attendance_days || 0)} /></Grid>
              ) : (
                <Grid size={{ xs: 6, md: 3 }}><Stat label="Clients" value={fmtNum(data.total_clients || 0)} /></Grid>
              )}
              {isAgent ? (
                <>
                  <Grid size={{ xs: 6, md: 3 }}><Stat label="Orders" value={fmtNum(data.orders || 0)} /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><Stat label="Visits" value={fmtNum(data.visits || 0)} /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><Stat label="New Clients" value={fmtNum(data.new_clients || 0)} /></Grid>
                </>
              ) : (
                <Grid size={{ xs: 6, md: 3 }}><Stat label="Stock Requests" value={fmtNum(data.requests || 0)} /></Grid>
              )}
            </Grid>

            {/* Monthly trend */}
            <Paper elevation={0} sx={{ p: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>Monthly Trend</Typography>
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
                    <RTooltip formatter={(v) => fmtFull(Number(v ?? 0))} />
                    <Legend />
                    <Bar dataKey="primary" name="Primary" fill="#1976d2" radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar dataKey="secondary" name="Secondary" fill="#7b1fa2" radius={[4, 4, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>

            {/* Top products */}
            <Paper elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, overflow: "hidden" }}>
              <Box sx={{ p: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Top Products ({isAgent ? "secondary" : "primary"})
                </Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Sales</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {data.products.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">No product sales in this period</Typography>
                      </TableCell></TableRow>
                    ) : data.products.map((p, i) => (
                      <TableRow key={`${p.product}-${i}`} hover>
                        <TableCell><Typography variant="body2" fontWeight={600}>{p.product}</Typography></TableCell>
                        <TableCell align="right">{fmtNum(p.qty)}</TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={700}>{fmtFull(p.total)}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

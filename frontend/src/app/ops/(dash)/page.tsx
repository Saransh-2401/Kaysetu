"use client";
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

interface Stats {
  tenants: { total: number; by_status: Record<string, number> };
  signups_this_week: number;
  active_trials: number;
  trials_ending_7d: number;
  provisioning: { failed: number; running: number };
  mrr: string;
  package_distribution: { package__code: string; package__name: string; count: number }[];
}

function StatCard({ label, value, testId, accent }: { label: string; value: React.ReactNode; testId: string; accent?: boolean }) {
  return (
    <Card variant="outlined" sx={{ flex: "1 1 180px", borderTop: 3, borderTopColor: accent ? "secondary.main" : "primary.main" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" data-testid={testId}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  trial: "info", active: "success", suspended: "warning", failed: "error",
  provisioning: "default", churned: "default",
};

export default function CommandCenterPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("ops", "/sa/stats").then(setStats).catch((err) => setError(String(err.message)));
  }, []);

  if (error) return <Alert severity="error" data-testid="ops-stats-error-alert">{error}</Alert>;
  if (!stats) return null;

  return (
    <Box data-testid="ops-commandcenter-container">
      <Typography variant="h5" gutterBottom>
        Command Center
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <StatCard label="Total tenants" value={stats.tenants.total} testId="ops-stat-tenants-total" />
        <StatCard label="Signups this week" value={stats.signups_this_week} testId="ops-stat-signups-week" accent />
        <StatCard label="Active trials" value={stats.active_trials} testId="ops-stat-trials-active" />
        <StatCard label="Trials ending in 7d" value={stats.trials_ending_7d} testId="ops-stat-trials-ending" accent />
        <StatCard label="MRR (₹)" value={Number(stats.mrr).toLocaleString("en-IN")} testId="ops-stat-mrr" />
        <StatCard label="Failed provisions" value={stats.provisioning.failed} testId="ops-stat-provision-failed" accent />
      </Stack>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tenants by status
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} data-testid="ops-status-split-row">
            {Object.entries(stats.tenants.by_status).map(([status, count]) => (
              <Chip
                key={status}
                label={`${status}: ${count}`}
                color={STATUS_COLOR[status] ?? "default"}
                data-testid={`ops-status-chip-${status}`}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Package distribution
          </Typography>
          <Stack spacing={1} data-testid="ops-package-distribution-list">
            {stats.package_distribution.map((row) => (
              <Stack key={row.package__code} direction="row" justifyContent="space-between"
                data-testid={`ops-package-dist-row-${row.package__code}`}>
                <Typography>
                  {row.package__code} — {row.package__name}
                </Typography>
                <Typography fontWeight={700}>{row.count}</Typography>
              </Stack>
            ))}
            {stats.package_distribution.length === 0 && (
              <Typography color="text.secondary">No tenants yet.</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

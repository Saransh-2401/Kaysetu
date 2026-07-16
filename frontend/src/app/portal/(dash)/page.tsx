"use client";
import VerifiedIcon from "@mui/icons-material/Verified";
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { api, type PortalContext } from "@/lib/api";

const MODULE_LABELS: Record<string, string> = {
  TRACK: "Live Tracking", FIELD: "Field Sales", ORDERS: "Orders & Dispatch",
  DIST: "Distribution", INV: "Inventory", PROD: "Production", PURCH: "Procurement",
  BOOKS: "Accounts & GST", CRM: "Leads", ATT: "Attendance & Leave", TA: "Travel Allowance",
};

export default function PortalHomePage() {
  const [me, setMe] = useState<(PortalContext & { scope: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PortalContext & { scope: string }>("portal", "/me")
      .then(setMe)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert severity="error" data-testid="portal-home-error-alert">{error}</Alert>;
  if (!me) return null;

  const trialDaysLeft = me.org.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(me.org.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <Box data-testid="portal-home-container">
      <Typography variant="h5" gutterBottom data-testid="portal-home-welcome-text">
        Welcome, {me.user.full_name}
      </Typography>

      {me.org.status === "trial" && trialDaysLeft !== null && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="portal-home-trial-alert">
          Trial — {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} remaining.
        </Alert>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Organization
            </Typography>
            <Typography data-testid="portal-home-orgname-text">{me.org.name}</Typography>
            <Typography color="text.secondary" data-testid="portal-home-orgcode-text">
              Code: {me.org.org_code}
            </Typography>
            <Typography color="text.secondary">Industry: {me.org.industry}</Typography>
            <Typography color="text.secondary">
              Your role: {me.user.role ?? "—"} {me.user.is_owner ? "(owner)" : ""}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Your modules
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} data-testid="portal-home-modules-row">
              {me.org.modules.map((code) => (
                <Chip key={code} icon={<VerifiedIcon />} color="primary" variant="outlined"
                  label={MODULE_LABELS[code] ?? code} data-testid={`portal-home-module-chip-${code}`} />
              ))}
              {me.org.modules.length === 0 && (
                <Typography color="text.secondary">No modules yet.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

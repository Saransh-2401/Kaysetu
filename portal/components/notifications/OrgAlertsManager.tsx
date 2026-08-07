"use client";
/**
 * System Alerts — the org-wide switch for every notification event.
 *
 * Widest layer in the chain (catalog default -> ORG -> role -> user), so turning
 * something off here silences it for everyone unless a role or person turns it
 * back on.
 *
 * This screen used to toggle message templates instead, which are platform-owned
 * and drive nothing on the tenant side: the switches moved and changed nothing.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Switch, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
  useTheme, alpha,
} from "@mui/material";
import {
  notificationService, type NotificationChannel, type NotificationEvent,
  type OverrideMap, type RoleDefaults,
} from "@/lib/notification-service";

export default function OrgAlertsManager({
  showToast,
}: { showToast?: (msg: string, type: "success" | "error") => void }) {
  const theme = useTheme();
  const [data, setData] = useState<RoleDefaults | null>(null);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    notificationService.getOrgAlerts()
      .then((d) => {
        setData(d);
        // Start from what is already stored so an untouched row stays untouched.
        const seed: OverrideMap = {};
        d.events.forEach((e: NotificationEvent) => {
          if (e.override && Object.keys(e.override).length) seed[e.key] = { ...e.override };
        });
        setOverrides(seed);
      })
      .catch((e) => setError(e?.message || "Could not load system alerts."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const channels: NotificationChannel[] = data?.channels ?? [];

  const valueFor = (event: NotificationEvent, channel: NotificationChannel) => {
    const ov = overrides[event.key] as Record<string, boolean> | undefined;
    if (ov && channel in ov) return !!ov[channel];
    return !!(event.effective as Record<string, boolean> | undefined)?.[channel];
  };

  const toggle = (event: NotificationEvent, channel: NotificationChannel, on: boolean) => {
    setOverrides((prev) => {
      // Send the FULL resolved row, not just the edited channel: the API treats
      // an empty override as "revert to the catalog default", so a partial row
      // would quietly reset the channels the admin did not touch.
      const base: Record<string, boolean> = {};
      channels.forEach((c) => { base[c] = valueFor(event, c); });
      return { ...prev, [event.key]: { ...base, [channel]: on } };
    });
  };

  const dirty = useMemo(() => Object.keys(overrides).length > 0, [overrides]);

  const save = async () => {
    setSaving(true);
    try {
      const d = await notificationService.updateOrgAlerts(overrides);
      setData(d);
      showToast?.("System alerts saved.", "success");
    } catch (e) {
      const msg = (e as Error)?.message || "Could not save system alerts.";
      setError(msg);
      showToast?.(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  const byCategory = (data?.categories ?? []).map((cat) => ({
    cat,
    events: (data?.events ?? []).filter((e) => e.category === cat),
  })).filter((g) => g.events.length);

  return (
    <Stack spacing={2.5} maxWidth="lg" data-testid="org-alerts-manager">
      <Box>
        <Typography variant="h6" fontWeight={700}>System Alerts &amp; Notifications</Typography>
        <Typography variant="body2" color="text.secondary">
          Turn an event on or off for the whole organisation. Individual roles and people can
          still narrow this further under <b>Role Defaults</b> and their own preferences.
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      {byCategory.map(({ cat, events }) => (
        <Box key={cat}>
          <Typography variant="overline" fontWeight={800} color="text.secondary">{cat}</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 0.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell><strong>Event</strong></TableCell>
                  {channels.map((c) => (
                    <TableCell key={c} align="center">
                      <strong>{data?.channel_labels?.[c] ?? c}</strong>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.key} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight={600}>{event.label}</Typography>
                        {event.mandatory && (
                          <Chip size="small" label="always on" sx={{ height: 18, fontSize: "0.62rem" }} />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {event.description || event.key}
                      </Typography>
                    </TableCell>
                    {channels.map((c) => {
                      // in_app for a mandatory event cannot be switched off —
                      // the API forces it back on, so don't offer a dead switch.
                      const locked = !!event.mandatory && c === "in_app";
                      return (
                        <TableCell key={c} align="center">
                          <Switch
                            size="small"
                            checked={valueFor(event, c)}
                            disabled={locked}
                            onChange={(e) => toggle(event, c, e.target.checked)}
                            data-testid={`org-alert-${event.key}-${c}`}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      <Box>
        <Button variant="contained" onClick={save} disabled={!dirty || saving}
          data-testid="org-alerts-save-btn">
          {saving ? "Saving…" : "Save system alerts"}
        </Button>
      </Box>
    </Stack>
  );
}

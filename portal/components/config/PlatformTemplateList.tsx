"use client";
/**
 * Read-only view of the platform message catalog.
 *
 * KaySetu authors these templates and pays for delivery, so a tenant can see
 * exactly what its people receive but cannot edit the wording or the sending
 * account. The banner says so explicitly — an admin should never be left
 * hunting for a save button that does not exist.
 *
 * What the tenant DOES still control lives on the other tabs: System Alerts,
 * Role Defaults and Send Notification.
 */
import React, { useEffect, useState } from "react";
import {
  Alert, Box, Chip, CircularProgress, Divider, List, ListItemButton,
  Paper, Stack, Typography, useTheme, alpha,
} from "@mui/material";
import { LockIcon, EmailIcon, SmsIcon } from "@/components/icons";
import { coreService, PlatformTemplate } from "@/lib/core-service";

export default function PlatformTemplateList({ channel }: { channel: "email" | "sms" }) {
  const theme = useTheme();
  const [rows, setRows] = useState<PlatformTemplate[]>([]);
  const [selected, setSelected] = useState<PlatformTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    coreService.getPlatformTemplates(channel)
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setRows(list);
        setSelected(list[0] ?? null);
      })
      .catch(() => alive && setError("Could not load the message templates."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [channel]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={2.5} data-testid={`platform-templates-${channel}`}>
      <Alert
        severity="info"
        icon={<LockIcon fontSize="small" />}
        sx={{ borderRadius: 2 }}
        data-testid="platform-templates-readonly-notice"
      >
        These {channel === "email" ? "email" : "SMS"} templates are designed and maintained by
        KaySetu, and messages are sent on our account at no cost to you — so there is nothing
        to configure here. You can review every message your team receives below.
        To choose <b>who</b> gets notified and <b>on which channel</b>, use the{" "}
        <b>Role Defaults</b> and <b>Send Notification</b> tabs.
      </Alert>

      {error && <Alert severity="error">{error}</Alert>}

      {!error && rows.length === 0 && (
        <Alert severity="warning">No templates are available yet.</Alert>
      )}

      {rows.length > 0 && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
          {/* ── Template list ─────────────────────────────── */}
          <Paper
            variant="outlined"
            sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0, borderRadius: 2, overflow: "hidden" }}
          >
            <List disablePadding sx={{ maxHeight: 520, overflowY: "auto" }}>
              {rows.map((t) => {
                const active = selected?.id === t.id;
                return (
                  <ListItemButton
                    key={t.id}
                    selected={active}
                    onClick={() => setSelected(t)}
                    data-testid={`platform-template-item-${t.trigger_key}`}
                    sx={{
                      alignItems: "flex-start", py: 1.5,
                      borderLeft: `3px solid ${active ? theme.palette.primary.main : "transparent"}`,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>{t.name}</Typography>
                      <Typography variant="caption" color="text.secondary"
                        sx={{ display: "block" }} noWrap>
                        {t.description || t.trigger_key}
                      </Typography>
                      <Stack direction="row" spacing={0.5} mt={0.75} flexWrap="wrap" sx={{ rowGap: 0.5 }}>
                        {t.category && <Chip size="small" label={t.category} sx={{ height: 20, fontSize: "0.65rem" }} />}
                        {t.module_code && (
                          <Chip size="small" label={t.module_code} color="primary" variant="outlined"
                            sx={{ height: 20, fontSize: "0.65rem" }} />
                        )}
                      </Stack>
                    </Box>
                  </ListItemButton>
                );
              })}
            </List>
          </Paper>

          {/* ── Preview ───────────────────────────────────── */}
          {selected && (
            <Paper variant="outlined" sx={{ flex: 1, borderRadius: 2, p: 3, width: "100%" }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                {channel === "email" ? <EmailIcon fontSize="small" /> : <SmsIcon fontSize="small" />}
                <Typography variant="subtitle1" fontWeight={800}>{selected.name}</Typography>
                <Chip size="small" icon={<LockIcon sx={{ fontSize: 13 }} />} label="Read only"
                  sx={{ height: 22, fontSize: "0.68rem", fontWeight: 700 }} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Managed by {selected.managed_by} · trigger <code>{selected.trigger_key}</code>
              </Typography>

              <Divider sx={{ my: 2 }} />

              {channel === "email" ? (
                <>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>SUBJECT</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 2 }}>{selected.subject}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>PREVIEW</Typography>
                  {/* Sandboxed iframe: template HTML must not inherit portal CSS
                      (or run anything) — this shows it as a mail client would. */}
                  <Box
                    component="iframe"
                    title="Email preview"
                    sandbox=""
                    srcDoc={selected.body}
                    data-testid="platform-template-preview"
                    sx={{
                      width: "100%", height: 420, mt: 1, border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                      borderRadius: 2, bgcolor: "#f4f5f7",
                    }}
                  />
                </>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>MESSAGE</Typography>
                  <Paper variant="outlined" data-testid="platform-template-preview"
                    sx={{ p: 2, mt: 1, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                      {selected.content}
                    </Typography>
                  </Paper>
                </>
              )}

              {selected.available_variables?.length > 0 && (
                <Box mt={2.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    FILLED IN AUTOMATICALLY
                  </Typography>
                  <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                    {selected.available_variables.map((v) => (
                      <Chip key={v} size="small" label={`{${v}}`}
                        sx={{ height: 22, fontSize: "0.68rem", fontFamily: "monospace" }} />
                    ))}
                  </Stack>
                </Box>
              )}
            </Paper>
          )}
        </Stack>
      )}
    </Stack>
  );
}

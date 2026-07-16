"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";

import {
  CheckIcon,
  NotificationsActiveIcon,
  NotificationsIcon,
  SaveIcon,
} from "@/components/icons";
import NotificationMatrix from "@/components/notifications/NotificationMatrix";
import {
  notificationService,
  type FeedItem,
  type MyPreferences,
  type NotificationChannel,
  type NotificationEvent,
  type OverrideMap,
} from "@/lib/notification-service";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleString();
}

export default function NotificationsPage() {
  const theme = useTheme();
  const gold = theme.palette.secondary.main;
  const slate = theme.palette.primary.main;

  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  // Open the Preferences tab when deep-linked from the bell.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "preferences") setTab(1);
    }
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }} className="page-enter">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <NotificationsActiveIcon sx={{ color: gold }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: slate }}>
          Notifications
        </Typography>
      </Stack>
      <Typography sx={{ color: "text.secondary", mb: 2 }}>
        Your inbox and personal alert preferences.
      </Typography>

      <Paper elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}
        >
          <Tab label="Inbox" data-testid="notifications-tab-inbox" sx={{ textTransform: "none", fontWeight: 700 }} />
          <Tab label="My Preferences" data-testid="notifications-tab-preferences" sx={{ textTransform: "none", fontWeight: 700 }} />
        </Tabs>

        <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
          {tab === 0 ? <InboxPanel onToast={setToast} /> : <PreferencesPanel onToast={setToast} />}
        </Box>
      </Paper>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={toast.sev} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// --------------------------------------------------------------------------- //
// Inbox
// --------------------------------------------------------------------------- //
function InboxPanel({ onToast }: { onToast: (t: { open: boolean; msg: string; sev: "success" | "error" }) => void }) {
  const theme = useTheme();
  const gold = theme.palette.secondary.main;
  const slate = theme.palette.primary.main;

  const [items, setItems] = useState<FeedItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Cursor pagination: pass the id of the last loaded row as ?before_id so a
  // notification arriving mid-session can't shift the window (offset would skip
  // or duplicate a row). Append de-duped by id for extra safety.
  const load = useCallback(async (beforeId?: number) => {
    if (beforeId == null) setLoading(true);
    else setLoadingMore(true);
    try {
      const params: Record<string, string> = { limit: "20" };
      if (beforeId != null) params.before_id = String(beforeId);
      const res = await notificationService.getFeed(params);
      setUnread(res.unread || 0);
      setTotal(res.count || 0);
      setItems((prev) => {
        if (beforeId == null) return res.results;
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.results.filter((i) => !seen.has(i.id))];
      });
    } catch {
      onToast({ open: true, msg: "Failed to load notifications.", sev: "error" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (item: FeedItem) => {
    if (item.is_read) return;
    try {
      await notificationService.markRead(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore */
    }
  };

  const markAll = async () => {
    try {
      await notificationService.markAllRead();
      setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
      setUnread(0);
      onToast({ open: true, msg: "All notifications marked as read.", sev: "success" });
    } catch {
      onToast({ open: true, msg: "Could not mark all as read.", sev: "error" });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box data-testid="notifications-inbox-panel">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
          {unread > 0 ? `${unread} unread` : "No unread"} · {total} total
        </Typography>
        <Button
          data-testid="notifications-inbox-markall-btn"
          size="small"
          startIcon={<CheckIcon fontSize="small" />}
          onClick={markAll}
          disabled={unread === 0}
          sx={{ textTransform: "none", color: gold }}
        >
          Mark all read
        </Button>
      </Stack>

      {items.length === 0 ? (
        <Box data-testid="notifications-inbox-empty" sx={{ textAlign: "center", py: 8 }}>
          <NotificationsIcon sx={{ fontSize: 48, color: alpha(slate, 0.2) }} />
          <Typography sx={{ mt: 1, color: "text.secondary" }}>No notifications yet</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {items.map((item) => (
            <Paper
              key={item.id}
              data-testid={`notifications-inbox-item-${item.id}`}
              elevation={0}
              onClick={() => markRead(item)}
              sx={{
                p: 1.5,
                cursor: item.is_read ? "default" : "pointer",
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                backgroundColor: item.is_read ? "transparent" : alpha(gold, 0.05),
                display: "flex",
                gap: 1.25,
              }}
            >
              <Box
                sx={{
                  mt: 0.75,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  backgroundColor: item.is_read ? alpha(slate, 0.15) : gold,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                  <Typography sx={{ fontWeight: item.is_read ? 500 : 700, color: slate }}>
                    {item.subject}
                  </Typography>
                  <Typography sx={{ color: alpha(slate, 0.45), fontSize: "0.7rem", flexShrink: 0 }}>
                    {timeAgo(item.created_at)}
                  </Typography>
                </Stack>
                <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                  {item.message}
                </Typography>
                {item.event_key && (
                  <Chip
                    label={item.event_key.replace(/_/g, " ")}
                    size="small"
                    sx={{ mt: 0.5, height: 18, fontSize: "0.65rem", bgcolor: alpha(slate, 0.06) }}
                  />
                )}
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {items.length < total && (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Button
            data-testid="notifications-inbox-loadmore-btn"
            onClick={() => load(items[items.length - 1]?.id)}
            disabled={loadingMore}
            sx={{ textTransform: "none" }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </Box>
      )}
    </Box>
  );
}

// --------------------------------------------------------------------------- //
// Preferences
// --------------------------------------------------------------------------- //
function PreferencesPanel({ onToast }: { onToast: (t: { open: boolean; msg: string; sev: "success" | "error" }) => void }) {
  const theme = useTheme();
  const gold = theme.palette.secondary.main;
  const slate = theme.palette.primary.main;

  const [prefs, setPrefs] = useState<MyPreferences | null>(null);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [muted, setMuted] = useState(false);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applyResponse = useCallback((data: MyPreferences) => {
    setPrefs(data);
    const init: OverrideMap = {};
    data.events.forEach((e) => {
      if (e.override && Object.keys(e.override).length) init[e.key] = { ...e.override };
    });
    setOverrides(init);
    setMuted(data.muted);
    setQuietStart(data.quiet_hours_start || "");
    setQuietEnd(data.quiet_hours_end || "");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        applyResponse(await notificationService.getMyPreferences());
      } catch {
        onToast({ open: true, msg: "Failed to load preferences.", sev: "error" });
      } finally {
        setLoading(false);
      }
    })();
  }, [applyResponse, onToast]);

  const getValue = useCallback(
    (ev: NotificationEvent, ch: NotificationChannel): boolean => {
      const ov = overrides[ev.key];
      if (ov && ch in ov) return Boolean(ov[ch]);
      return Boolean(ev.effective?.[ch] ?? ev.defaults[ch]);
    },
    [overrides],
  );

  const onToggle = useCallback(
    (ev: NotificationEvent, ch: NotificationChannel, value: boolean) => {
      setOverrides((prev) => ({ ...prev, [ev.key]: { ...(prev[ev.key] || {}), [ch]: value } }));
    },
    [],
  );

  const save = async () => {
    setSaving(true);
    try {
      const data = await notificationService.updateMyPreferences({
        overrides,
        muted,
        quiet_hours_start: quietStart || null,
        quiet_hours_end: quietEnd || null,
      });
      applyResponse(data);
      onToast({ open: true, msg: "Preferences saved.", sev: "success" });
    } catch {
      onToast({ open: true, msg: "Could not save preferences.", sev: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box data-testid="notifications-preferences-panel">
      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        Choose exactly which alerts you receive and on which channels. These are
        your personal settings — your administrator sets the defaults for your role.
      </Alert>

      <Paper
        elevation={0}
        sx={{ p: 2, mb: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
          <FormControlLabel
            control={
              <Switch
                checked={muted}
                onChange={(e) => setMuted(e.target.checked)}
                data-testid="notifications-mute-switch"
              />
            }
            label={
              <Box>
                <Typography sx={{ fontWeight: 700, color: slate }}>Mute all notifications</Typography>
                <Typography sx={{ color: "text.secondary", fontSize: "0.78rem" }}>
                  Silences everything except required alerts.
                </Typography>
              </Box>
            }
          />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>Quiet hours</Typography>
            <TextField
              type="time"
              size="small"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              data-testid="notifications-quiet-start-input"
              sx={{ width: 130 }}
            />
            <TextField
              type="time"
              size="small"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              data-testid="notifications-quiet-end-input"
              sx={{ width: 130 }}
            />
          </Stack>
        </Stack>
        <Typography sx={{ color: alpha(slate, 0.5), fontSize: "0.72rem", mt: 1 }}>
          During quiet hours, push & SMS are held back; in-app & email still arrive. Required alerts always come through.
        </Typography>
      </Paper>

      <NotificationMatrix
        events={prefs.events}
        channels={prefs.channels}
        channelLabels={prefs.channel_labels}
        categories={prefs.categories}
        getValue={getValue}
        onToggle={onToggle}
        showRelevant
        testIdPrefix="myprefs"
      />

      <Divider sx={{ my: 2 }} />
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={save}
          disabled={saving}
          data-testid="notifications-save-prefs-btn"
          sx={{ textTransform: "none", fontWeight: 700, bgcolor: gold, "&:hover": { bgcolor: theme.palette.secondary.dark } }}
        >
          {saving ? "Saving…" : "Save Preferences"}
        </Button>
      </Stack>
    </Box>
  );
}

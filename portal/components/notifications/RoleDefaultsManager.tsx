"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";

import { SaveIcon } from "@/components/icons";
import NotificationMatrix from "@/components/notifications/NotificationMatrix";
import {
  notificationService,
  type NotificationChannel,
  type NotificationEvent,
  type OverrideMap,
  type RoleDefaults,
  type RoleOption,
} from "@/lib/notification-service";

export default function RoleDefaultsManager() {
  const theme = useTheme();
  const gold = theme.palette.secondary.main;
  const slate = theme.palette.primary.main;

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [role, setRole] = useState("");
  const [data, setData] = useState<RoleDefaults | null>(null);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const initOverrides = (d: RoleDefaults) => {
    const init: OverrideMap = {};
    d.events.forEach((e) => {
      if (e.override && Object.keys(e.override).length) init[e.key] = { ...e.override };
    });
    setOverrides(init);
  };

  const loadRole = useCallback(async (r: string) => {
    setLoading(true);
    try {
      const d = await notificationService.getRoleDefaults(r);
      setData(d);
      initOverrides(d);
    } catch {
      setToast({ open: true, msg: "Failed to load role defaults.", sev: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  // First load: fetch the role list, then load the first role.
  useEffect(() => {
    (async () => {
      try {
        const meta = await notificationService.getRoleDefaults();
        const list = meta.roles || [];
        setRoles(list);
        const first = list.find((r) => r.value === "sales_manager")?.value || list[0]?.value || "";
        if (first) {
          setRole(first);
          await loadRole(first);
        } else {
          setLoading(false);
        }
      } catch {
        setToast({ open: true, msg: "Failed to load roles.", sev: "error" });
        setLoading(false);
      }
    })();
  }, [loadRole]);

  const handleRoleChange = (r: string) => {
    setRole(r);
    loadRole(r);
  };

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
    if (!role) return;
    setSaving(true);
    try {
      const d = await notificationService.updateRoleDefaults(role, overrides);
      setData(d);
      initOverrides(d);
      setToast({ open: true, msg: "Role defaults saved.", sev: "success" });
    } catch {
      setToast({ open: true, msg: "Could not save role defaults.", sev: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box maxWidth="lg" data-testid="role-defaults-panel">
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Role Notification Defaults
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Set the system-wide default channels each role receives for every alert
        type. Individual users can still personalise their own preferences on top
        of these defaults.
      </Typography>

      <FormControl size="small" sx={{ minWidth: 260, mb: 2 }}>
        <InputLabel id="role-defaults-role-label">Role</InputLabel>
        <Select
          labelId="role-defaults-role-label"
          label="Role"
          value={role}
          onChange={(e) => handleRoleChange(e.target.value)}
          data-testid="role-defaults-role-select"
        >
          {roles.map((r) => (
            <MenuItem key={r.value} value={r.value} data-testid={`role-defaults-role-${r.value}`}>
              {r.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            Changes here apply to every user with the <b>{roles.find((r) => r.value === role)?.label || role}</b> role
            who has not personally overridden a given alert.
          </Alert>
          <NotificationMatrix
            events={data.events}
            channels={data.channels}
            channelLabels={data.channel_labels}
            categories={data.categories}
            getValue={getValue}
            onToggle={onToggle}
            testIdPrefix="roledef"
          />
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={save}
              disabled={saving}
              data-testid="role-defaults-save-btn"
              sx={{ textTransform: "none", fontWeight: 700, bgcolor: gold, "&:hover": { bgcolor: theme.palette.secondary.dark } }}
            >
              {saving ? "Saving…" : "Save Role Defaults"}
            </Button>
          </Stack>
        </>
      )}

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

"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";

import { SendIcon } from "@/components/icons";
import {
  notificationService,
  type BroadcastRecipientOption,
  type BroadcastRecord,
  type NotificationChannel,
  type RoleOption,
} from "@/lib/notification-service";

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: "in_app", label: "In-App" },
  { key: "push", label: "Push" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
];

export default function BroadcastComposer() {
  const theme = useTheme();
  const gold = theme.palette.secondary.main;
  const slate = theme.palette.primary.main;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "roles" | "users">("all");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [users, setUsers] = useState<BroadcastRecipientOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<BroadcastRecipientOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [channels, setChannels] = useState<Record<NotificationChannel, boolean>>({
    in_app: true,
    push: true,
    email: false,
    sms: false,
  });
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<BroadcastRecord[]>([]);
  const [toast, setToast] = useState<{ open: boolean; msg: string; sev: "success" | "error" | "warning" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  useEffect(() => {
    (async () => {
      try {
        const meta = await notificationService.getRoleDefaults();
        setRoles(meta.roles || []);
      } catch {
        /* ignore */
      }
      try {
        setHistory(await notificationService.getBroadcasts());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Lazy-load the recipient list the first time "Specific users" is selected.
  // Uses the admin-only notifications endpoint (not the RBAC-scoped
  // /auth/users/, which would return only self for an mdo).
  useEffect(() => {
    if (audienceType === "users" && users.length === 0 && !usersLoading) {
      setUsersLoading(true);
      notificationService
        .getBroadcastRecipients()
        .then((res) => setUsers(Array.isArray(res) ? res : []))
        .catch(() => setToast({ open: true, msg: "Failed to load users.", sev: "error" }))
        .finally(() => setUsersLoading(false));
    }
  }, [audienceType, users.length, usersLoading]);

  const selectedChannels = useMemo(
    () => CHANNELS.filter((c) => channels[c.key]).map((c) => c.key),
    [channels],
  );

  const canSend =
    title.trim() &&
    body.trim() &&
    selectedChannels.length > 0 &&
    (audienceType === "all" ||
      (audienceType === "roles" && selectedRoles.length > 0) ||
      (audienceType === "users" && selectedUsers.length > 0));

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await notificationService.sendBroadcast({
        title: title.trim(),
        body: body.trim(),
        audience_type: audienceType,
        roles: audienceType === "roles" ? selectedRoles : undefined,
        user_ids: audienceType === "users" ? selectedUsers.map((u) => u.id) : undefined,
        channels: selectedChannels,
      });
      const base = `Notification sent to ${res.recipient_count} employee${res.recipient_count === 1 ? "" : "s"}.`;
      const warnings = res.warnings || [];
      setToast({
        open: true,
        msg: warnings.length ? `${base} ${warnings.join(" ")}` : base,
        sev: warnings.length ? "warning" : "success",
      });
      setTitle("");
      setBody("");
      setSelectedRoles([]);
      setSelectedUsers([]);
      try {
        setHistory(await notificationService.getBroadcasts());
      } catch {
        /* ignore */
      }
    } catch {
      setToast({ open: true, msg: "Failed to send notification.", sev: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box maxWidth="lg" data-testid="broadcast-panel">
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Send Notification
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Push a manual notification to your employees — to everyone, to selected
        roles, or to specific people.
      </Typography>

      <Paper
        elevation={0}
        sx={{ p: 2.5, mb: 3, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}
      >
        <Stack spacing={2.5}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ maxLength: 120, "data-testid": "broadcast-title-input" }}
          />
          <TextField
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            rows={4}
            inputProps={{ "data-testid": "broadcast-body-input" }}
          />

          <FormControl>
            <FormLabel sx={{ fontWeight: 600, color: slate, mb: 0.5 }}>Audience</FormLabel>
            <RadioGroup
              row
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value as "all" | "roles" | "users")}
            >
              <FormControlLabel value="all" control={<Radio data-testid="broadcast-audience-all" />} label="All employees" />
              <FormControlLabel value="roles" control={<Radio data-testid="broadcast-audience-roles" />} label="By role" />
              <FormControlLabel value="users" control={<Radio data-testid="broadcast-audience-users" />} label="Specific users" />
            </RadioGroup>
          </FormControl>

          {audienceType === "roles" && (
            <FormControl size="small" fullWidth>
              <InputLabel id="broadcast-roles-label">Roles</InputLabel>
              <Select
                labelId="broadcast-roles-label"
                multiple
                value={selectedRoles}
                onChange={(e) => setSelectedRoles(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
                input={<OutlinedInput label="Roles" />}
                data-testid="broadcast-roles-select"
                renderValue={(sel) => (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {(sel as string[]).map((v) => (
                      <Chip key={v} size="small" label={roles.find((r) => r.value === v)?.label || v} />
                    ))}
                  </Stack>
                )}
              >
                {roles.map((r) => (
                  <MenuItem key={r.value} value={r.value} data-testid={`broadcast-role-${r.value}`}>
                    <Checkbox checked={selectedRoles.indexOf(r.value) > -1} />
                    <ListItemText primary={r.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {audienceType === "users" && (
            <Autocomplete
              multiple
              size="small"
              options={users}
              loading={usersLoading}
              value={selectedUsers}
              onChange={(_, v) => setSelectedUsers(v)}
              getOptionLabel={(u) => `${u.full_name || u.username} (${u.role})`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select users"
                  data-testid="broadcast-users-autocomplete"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {usersLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}

          <FormControl>
            <FormLabel sx={{ fontWeight: 600, color: slate, mb: 0.5 }}>Channels</FormLabel>
            <FormGroup row>
              {CHANNELS.map((c) => (
                <FormControlLabel
                  key={c.key}
                  control={
                    <Checkbox
                      checked={channels[c.key]}
                      onChange={(e) => setChannels((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                      data-testid={`broadcast-channel-${c.key}`}
                    />
                  }
                  label={c.label}
                />
              ))}
            </FormGroup>
            <Typography sx={{ color: alpha(slate, 0.5), fontSize: "0.72rem" }}>
              In-app is always recorded so recipients can see it in their inbox. SMS delivers only where a DLT template exists.
            </Typography>
          </FormControl>

          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              onClick={send}
              disabled={!canSend || sending}
              data-testid="broadcast-send-btn"
              sx={{ textTransform: "none", fontWeight: 700, bgcolor: gold, "&:hover": { bgcolor: theme.palette.secondary.dark } }}
            >
              {sending ? "Sending…" : "Send Notification"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Recent broadcasts
      </Typography>
      {history.length === 0 ? (
        <Typography color="text.secondary" variant="body2" data-testid="broadcast-history-empty">
          No notifications have been sent yet.
        </Typography>
      ) : (
        <Stack spacing={1} data-testid="broadcast-history">
          {history.map((b) => (
            <Paper
              key={b.id}
              elevation={0}
              sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}
              data-testid={`broadcast-history-item-${b.id}`}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={700} color={slate}>{b.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(b.created_at).toLocaleString()}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ my: 0.5 }}>
                {b.body}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                <Chip size="small" label={`${b.recipient_count} recipients`} sx={{ bgcolor: alpha(gold, 0.12), color: gold }} />
                <Chip size="small" label={b.audience_type} variant="outlined" />
                {b.channels.map((c) => (
                  <Chip key={c} size="small" label={c} variant="outlined" />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
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

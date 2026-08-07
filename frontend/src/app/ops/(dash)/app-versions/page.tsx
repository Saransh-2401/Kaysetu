"use client";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Link as MuiLink,
  Snackbar,
  Stack,
  Switch,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import {
  CodeText,
  EmptyRow,
  HeadRow,
  PageHeader,
  StatusChip,
  TableShell,
  TableSkeleton,
  type Column,
} from "@/components/ui/kit";
import { api } from "@/lib/api";

interface AppVersion {
  id: number;
  version: string;
  version_code: number;
  apk_url: string;
  release_notes: string;
  force_update: boolean;
  is_active: boolean;
  uploaded_by_name?: string;
  created_at?: string;
}

const BLANK: AppVersion = {
  id: 0,
  version: "",
  version_code: 0,
  apk_url: "",
  release_notes: "",
  force_update: false,
  is_active: true,
};

const COLS: Column[] = [
  { key: "Version", width: 130 },
  { key: "Code", align: "right", width: 80 },
  { key: "APK" },
  { key: "Rollout", align: "center", width: 120 },
  { key: "Status", align: "center", width: 100 },
  { key: "Published by", width: 150 },
  { key: "", align: "right", width: 90 },
];

export default function AppVersionsPage() {
  const theme = useTheme();
  const [rows, setRows] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AppVersion | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AppVersion | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<AppVersion[]>("ops", "/sa/app-versions/")
      .then((data) => {
        setRows(
          Array.isArray(data) ? data : ((data as { results?: AppVersion[] }).results ?? [])
        );
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The app serves the highest active version code, so flag which row that is.
  const servedCode = rows
    .filter((r) => r.is_active)
    .reduce((max, r) => Math.max(max, r.version_code), -Infinity);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const body = {
      version: editing.version,
      version_code: editing.version_code,
      apk_url: editing.apk_url,
      release_notes: editing.release_notes,
      force_update: editing.force_update,
      is_active: editing.is_active,
    };
    try {
      if (editing.id) {
        await api("ops", `/sa/app-versions/${editing.id}/`, { method: "PATCH", body });
      } else {
        await api("ops", "/sa/app-versions/", { method: "POST", body });
      }
      setToast(`${editing.version} saved — the app's update check sees it immediately`);
      setEditing(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await api("ops", `/sa/app-versions/${confirmDelete.id}/`, { method: "DELETE" });
      setToast(`Release ${confirmDelete.version} deleted`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <Box data-testid="ops-app-versions-container">
      <PageHeader
        title="Mobile App Releases"
        subtitle="Published platform-wide — the agent app serves the highest active version code"
        icon={<SystemUpdateIcon />}
        actions={
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 17 }} />}
            onClick={() => setEditing({ ...BLANK })}
            data-testid="ops-app-version-new-btn"
          >
            New release
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableShell testId="ops-app-versions-table" minWidth={980}>
        <HeadRow cols={COLS} />

        {loading ? (
          <TableSkeleton cols={COLS.length} />
        ) : rows.length === 0 ? (
          <EmptyRow
            cols={COLS.length}
            icon={<SystemUpdateIcon />}
            message="No releases yet"
            hint="Publish the first APK to turn on in-app update checks for the agent app."
            action={
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 17 }} />}
                onClick={() => setEditing({ ...BLANK })}
              >
                Publish first release
              </Button>
            }
          />
        ) : (
          <TableBody>
            {rows.map((row) => {
              const served = row.is_active && row.version_code === servedCode;
              return (
                <TableRow
                  key={row.id}
                  hover
                  data-testid={`ops-app-version-row-${row.version_code}`}
                  sx={served ? { boxShadow: `inset 3px 0 0 ${theme.palette.success.main}` } : undefined}
                >
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography variant="body2" fontWeight={700}>
                        {row.version}
                      </Typography>
                      {served && (
                        <Tooltip title="This is the release the app currently downloads">
                          <Box component="span">
                            <StatusChip label="serving" tone="success" />
                          </Box>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <CodeText>{row.version_code}</CodeText>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    {row.apk_url ? (
                      <MuiLink
                        href={row.apk_url}
                        target="_blank"
                        rel="noreferrer"
                        variant="caption"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.apk_url}
                        <OpenInNewIcon sx={{ fontSize: 12, flexShrink: 0 }} />
                      </MuiLink>
                    ) : (
                      <Typography variant="caption" color="error.main">
                        No URL — the app cannot download this build
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {row.force_update ? (
                      <StatusChip label="Forced" tone="warning" />
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        Optional
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <StatusChip
                      label={row.is_active ? "Active" : "Hidden"}
                      tone={row.is_active ? "success" : "neutral"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {row.uploaded_by_name || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title={`Edit ${row.version}`}>
                        <IconButton
                          size="small"
                          onClick={() => setEditing(row)}
                          aria-label={`Edit ${row.version}`}
                          data-testid={`ops-app-version-edit-btn-${row.version_code}`}
                          sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}
                        >
                          <EditIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={`Delete ${row.version}`}>
                        <IconButton
                          size="small"
                          onClick={() => setConfirmDelete(row)}
                          aria-label={`Delete ${row.version}`}
                          data-testid={`ops-app-version-delete-btn-${row.version_code}`}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
                            color: "error.main",
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        )}
      </TableShell>

      {/* ── Editor ──────────────────────────────────────────────── */}
      <Dialog
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        fullWidth
        maxWidth="sm"
        data-testid="ops-app-version-dialog"
      >
        {editing && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              {editing.id ? `Edit ${editing.version}` : "New release"}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 400 }}>
                The agent app checks <CodeText>/public/app-version/latest</CodeText> on launch.
              </Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ bgcolor: "background.default" }}>
              <Stack spacing={2.25} sx={{ pt: 0.5 }}>
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                  <TextField
                    label="Version"
                    size="small"
                    placeholder="1.4.0"
                    value={editing.version}
                    onChange={(e) => setEditing({ ...editing, version: e.target.value })}
                    slotProps={{ htmlInput: { "data-testid": "ops-app-version-version-input" } }}
                  />
                  <TextField
                    label="Version code"
                    size="small"
                    type="number"
                    value={editing.version_code}
                    helperText="Higher wins — this is what the app compares."
                    onChange={(e) => setEditing({ ...editing, version_code: Number(e.target.value) })}
                    slotProps={{ htmlInput: { "data-testid": "ops-app-version-code-input", min: 0 } }}
                  />
                </Box>

                <TextField
                  label="APK download URL"
                  size="small"
                  fullWidth
                  placeholder="https://…/kaysetu-1.4.0.apk"
                  value={editing.apk_url}
                  onChange={(e) => setEditing({ ...editing, apk_url: e.target.value })}
                  slotProps={{ htmlInput: { "data-testid": "ops-app-version-apk-input", inputMode: "url" } }}
                />

                <TextField
                  label="Release notes"
                  size="small"
                  fullWidth
                  multiline
                  minRows={3}
                  value={editing.release_notes}
                  helperText="Shown to agents in the update prompt."
                  onChange={(e) => setEditing({ ...editing, release_notes: e.target.value })}
                  slotProps={{ htmlInput: { "data-testid": "ops-app-version-notes-input" } }}
                />

                <FormControlLabel
                  sx={{ alignItems: "flex-start", m: 0, "& .MuiFormControlLabel-label": { pt: 0.5 } }}
                  control={
                    <Switch
                      checked={editing.force_update}
                      onChange={(e) => setEditing({ ...editing, force_update: e.target.checked })}
                      data-testid="ops-app-version-force-switch"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        Force update
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Blocks the app until the agent installs this build. Use sparingly.
                      </Typography>
                    </Box>
                  }
                />

                <FormControlLabel
                  sx={{ alignItems: "flex-start", m: 0, "& .MuiFormControlLabel-label": { pt: 0.5 } }}
                  control={
                    <Switch
                      checked={editing.is_active}
                      onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                      data-testid="ops-app-version-active-switch"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        Active
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Eligible to be served as the latest release.
                      </Typography>
                    </Box>
                  }
                />

                {editing.force_update && editing.is_active && (
                  <Alert severity="warning" icon={<WarningAmberIcon fontSize="inherit" />}>
                    Every agent will be locked out of the app until they install this build.
                  </Alert>
                )}
              </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button
                onClick={() => setEditing(null)}
                disabled={saving}
                data-testid="ops-app-version-cancel-btn"
                sx={{ color: "text.secondary" }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={save}
                disabled={saving || !editing.version.trim()}
                data-testid="ops-app-version-save-btn"
              >
                {saving ? "Saving…" : "Save release"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Themed confirm — replaces window.confirm, which ignored the design system. */}
      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this release?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.85rem" }}>
            Release <strong>{confirmDelete?.version}</strong> (code {confirmDelete?.version_code}) will be
            removed. Agents already on this build keep it, but it will no longer be offered.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} sx={{ color: "text.secondary" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={remove}
            data-testid="ops-app-version-confirm-delete-btn"
          >
            Delete release
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
    </Box>
  );
}

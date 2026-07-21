"use client";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Snackbar, Stack, Switch, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

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
  id: 0, version: "", version_code: 0, apk_url: "",
  release_notes: "", force_update: false, is_active: true,
};

export default function AppVersionsPage() {
  const [rows, setRows] = useState<AppVersion[]>([]);
  const [editing, setEditing] = useState<AppVersion | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<AppVersion[]>("ops", "/sa/app-versions/")
      .then((data) => setRows(Array.isArray(data) ? data : (data as { results?: AppVersion[] }).results ?? []))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
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
    }
  };

  const remove = async (row: AppVersion) => {
    if (!window.confirm(`Delete release ${row.version}?`)) return;
    try {
      await api("ops", `/sa/app-versions/${row.id}/`, { method: "DELETE" });
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <Box data-testid="ops-app-versions-container">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h5">Mobile App Releases</Typography>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => setEditing({ ...BLANK })} data-testid="ops-app-version-new-btn">
          New release
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Published once for the whole platform. The agent app checks
        <code> /public/app-version/latest </code> on launch; the highest active
        <b> version code </b> wins.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Table size="small" data-testid="ops-app-versions-table">
        <TableHead>
          <TableRow>
            <TableCell>Version</TableCell>
            <TableCell align="right">Code</TableCell>
            <TableCell>APK</TableCell>
            <TableCell>Force</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>By</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover data-testid={`ops-app-version-row-${row.version_code}`}>
              <TableCell>{row.version}</TableCell>
              <TableCell align="right">{row.version_code}</TableCell>
              <TableCell sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                {row.apk_url
                  ? <a href={row.apk_url} target="_blank" rel="noreferrer">{row.apk_url}</a>
                  : <Typography variant="caption" color="text.secondary">—</Typography>}
              </TableCell>
              <TableCell>
                {row.force_update && <Chip size="small" color="warning" label="forced" />}
              </TableCell>
              <TableCell>
                <Chip size="small" label={row.is_active ? "active" : "hidden"}
                  color={row.is_active ? "success" : "default"} />
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">{row.uploaded_by_name || "—"}</Typography>
              </TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => setEditing(row)}
                  data-testid={`ops-app-version-edit-btn-${row.version_code}`}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => remove(row)}
                  data-testid={`ops-app-version-delete-btn-${row.version_code}`}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No releases yet. Publish the first APK to enable in-app updates.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm"
        data-testid="ops-app-version-dialog">
        {editing && (
          <>
            <DialogTitle>{editing.id ? `Edit ${editing.version}` : "New release"}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={2}>
                  <TextField label="Version (e.g. 1.4.0)" value={editing.version} fullWidth
                    onChange={(e) => setEditing({ ...editing, version: e.target.value })}
                    inputProps={{ "data-testid": "ops-app-version-version-input" }} />
                  <TextField label="Version code" type="number" value={editing.version_code} fullWidth
                    onChange={(e) => setEditing({ ...editing, version_code: Number(e.target.value) })}
                    helperText="Higher = newer"
                    inputProps={{ "data-testid": "ops-app-version-code-input" }} />
                </Stack>
                <TextField label="APK download URL" value={editing.apk_url}
                  onChange={(e) => setEditing({ ...editing, apk_url: e.target.value })}
                  inputProps={{ "data-testid": "ops-app-version-apk-input" }} />
                <TextField label="Release notes" value={editing.release_notes} multiline minRows={3}
                  onChange={(e) => setEditing({ ...editing, release_notes: e.target.value })}
                  inputProps={{ "data-testid": "ops-app-version-notes-input" }} />
                <FormControlLabel
                  control={<Switch checked={editing.force_update}
                    onChange={(e) => setEditing({ ...editing, force_update: e.target.checked })}
                    data-testid="ops-app-version-force-switch" />}
                  label="Force update (block the app until updated)" />
                <FormControlLabel
                  control={<Switch checked={editing.is_active}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                    data-testid="ops-app-version-active-switch" />}
                  label="Active (eligible to be served as latest)" />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditing(null)} data-testid="ops-app-version-cancel-btn">Cancel</Button>
              <Button variant="contained" onClick={save} data-testid="ops-app-version-save-btn">Save</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

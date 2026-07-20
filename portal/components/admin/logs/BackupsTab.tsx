"use client";
import React, { useMemo, useState } from "react";
import {
  TextField, MenuItem, Chip, Tooltip, IconButton, Button, Stack, CircularProgress,
  TableBody, TableCell, TableHead, TableRow, Typography, alpha, useTheme,
} from "@mui/material";
import { RefreshIcon, BackupIcon, DownloadIcon } from "@/components/icons";
import { apiClient, API_BASE_URL, tokenManager } from "@/lib/api-client";
import { toast } from "sonner";
import { useLogData, useDebounced, LogCard, FilterBar, UserCell, formatDateTime, formatBytes } from "./logShared";

interface BackupRow {
  id: number;
  job_type: string;
  status: string;
  file_size: number;
  triggered_by_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  pending: "default", running: "warning", completed: "success", failed: "error",
};

export default function BackupsTab() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [jobType, setJobType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [running, setRunning] = useState(false);
  const debouncedSearch = useDebounced(search);

  const filters = useMemo(() => {
    const f: Record<string, string> = { ordering: "-created_at" };
    if (debouncedSearch) f.search = debouncedSearch;
    if (jobType) f.job_type = jobType;
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [debouncedSearch, jobType, statusFilter]);

  const { rows, count, loading, page, setPage, rowsPerPage, setRowsPerPage, refetch } =
    useLogData<BackupRow>("/admin/backups/", filters);

  const runBackup = async () => {
    try {
      setRunning(true);
      await apiClient.post("/admin/backups/trigger/");
      toast.success("Backup started — it will appear below shortly.");
      setTimeout(refetch, 2500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start backup");
    } finally {
      setRunning(false);
    }
  };

  // Download needs the JWT header, so an <a href> won't work — fetch as a blob.
  const downloadBackup = async (row: BackupRow) => {
    try {
      const resp = await fetch(`${API_BASE_URL}/admin/backups/${row.id}/download/`, {
        headers: { Authorization: `Bearer ${tokenManager.getAccessToken() || ""}` },
      });
      if (!resp.ok) throw new Error("Backup file not available");
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kaysetu_backup_${row.id}.dump`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  };

  return (
    <>
      <FilterBar testId="backups-filter-bar">
        <TextField size="small" placeholder="Search trigger user, error…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ "data-testid": "backups-search-input" }} sx={{ minWidth: 220, flex: 1 }} />
        <TextField select size="small" label="Type" value={jobType} onChange={(e) => setJobType(e.target.value)}
          inputProps={{ "data-testid": "backups-type-filter" }} sx={{ minWidth: 150 }}>
          <MenuItem value="">All types</MenuItem>
          <MenuItem value="manual">Manual</MenuItem>
          <MenuItem value="scheduled">Scheduled</MenuItem>
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          inputProps={{ "data-testid": "backups-status-filter" }} sx={{ minWidth: 150 }}>
          <MenuItem value="">All statuses</MenuItem>
          {["pending", "running", "completed", "failed"].map((s) => (
            <MenuItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</MenuItem>
          ))}
        </TextField>
        <Tooltip title="Refresh"><span>
          <IconButton onClick={refetch} disabled={loading} data-testid="backups-refresh-btn"
            sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.4)}`, borderRadius: 2 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
        <Button variant="contained" onClick={runBackup} disabled={running} data-testid="backups-run-now-btn"
          startIcon={running ? <CircularProgress size={16} color="inherit" /> : <BackupIcon />}
          sx={{ textTransform: "none", borderRadius: 2, fontWeight: 600, ml: { md: "auto" } }}>
          {running ? "Starting…" : "Run Backup Now"}
        </Button>
      </FilterBar>

      <LogCard loading={loading} isEmpty={rows.length === 0} emptyText="No backups yet"
        testId="backups-table" EmptyIcon={BackupIcon} count={count} page={page} rowsPerPage={rowsPerPage}
        onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Triggered By</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Completed</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-testid={`backups-row-${row.id}`}
              sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                ...(row.status === "failed" ? { bgcolor: alpha(theme.palette.error.main, 0.03) } : {}) }}>
              <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(row.created_at)}</Typography></TableCell>
              <TableCell><Chip size="small" variant="outlined" color={row.job_type === "manual" ? "info" : "default"}
                label={row.job_type} sx={{ textTransform: "capitalize" }} /></TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {row.status === "running" ? <CircularProgress size={12} /> : null}
                  <Chip size="small" color={STATUS_COLOR[row.status] || "default"} label={row.status} sx={{ textTransform: "capitalize" }} />
                </Stack>
                {row.error_message ? (
                  <Tooltip title={row.error_message}>
                    <Typography variant="caption" color="error.main"
                      sx={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.error_message}
                    </Typography>
                  </Tooltip>
                ) : null}
              </TableCell>
              <TableCell><Typography variant="body2" color="text.secondary">{formatBytes(row.file_size)}</Typography></TableCell>
              <TableCell>{row.triggered_by_name ? <UserCell name={row.triggered_by_name} /> :
                <Typography variant="caption" color="text.disabled">System</Typography>}</TableCell>
              <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(row.completed_at)}</Typography></TableCell>
              <TableCell align="right">
                <Tooltip title={row.status === "completed" ? "Download dump" : "Not available"}>
                  <span>
                    <IconButton size="small" disabled={row.status !== "completed"}
                      onClick={() => downloadBackup(row)} data-testid={`backups-download-btn-${row.id}`}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </LogCard>
    </>
  );
}

"use client";
import React, { useMemo, useState } from "react";
import {
  TextField, MenuItem, Chip, Tooltip, IconButton, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  TableBody, TableCell, TableHead, TableRow, Typography, alpha, useTheme,
} from "@mui/material";
import { RefreshIcon, DeleteIcon, RestartAltIcon, CheckCircleIcon } from "@/components/icons";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useLogData, useDebounced, LogCard, FilterBar, UserCell, formatDateTime } from "./logShared";

interface DeletedDocRow {
  id: number;
  document_type: string;
  document_id: number;
  restore_name: string;
  deleted_by_name: string | null;
  deleted_at: string;
  restored_at: string | null;
  restored_by_name: string | null;
}

export default function DeletedDocumentsTab() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [restoredFilter, setRestoredFilter] = useState(""); // "", "true", "false"
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounced(search);

  const [target, setTarget] = useState<DeletedDocRow | null>(null);
  const [restoring, setRestoring] = useState(false);

  const filters = useMemo(() => {
    const f: Record<string, string> = { ordering: "-deleted_at" };
    if (debouncedSearch) f.search = debouncedSearch;
    if (restoredFilter) f.is_restored = restoredFilter;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [debouncedSearch, restoredFilter, dateFrom, dateTo]);

  const { rows, count, loading, page, setPage, rowsPerPage, setRowsPerPage, refetch } =
    useLogData<DeletedDocRow>("/admin/deleted-documents/", filters);

  const doRestore = async () => {
    if (!target) return;
    try {
      setRestoring(true);
      await apiClient.post(`/admin/deleted-documents/${target.id}/restore/`);
      toast.success(`Restored ${target.document_type} #${target.document_id}`);
      setTarget(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <FilterBar testId="deleted-docs-filter-bar">
        <TextField size="small" placeholder="Search type or name…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ "data-testid": "deleted-docs-search-input" }} sx={{ minWidth: 240, flex: 1 }} />
        <TextField select size="small" label="State" value={restoredFilter} onChange={(e) => setRestoredFilter(e.target.value)}
          inputProps={{ "data-testid": "deleted-docs-state-filter" }} sx={{ minWidth: 170 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="false">Not restored</MenuItem>
          <MenuItem value="true">Restored</MenuItem>
        </TextField>
        <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "deleted-docs-date-from-input" }} sx={{ minWidth: 150 }} />
        <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "deleted-docs-date-to-input" }} sx={{ minWidth: 150 }} />
        <Tooltip title="Refresh"><span>
          <IconButton onClick={refetch} disabled={loading} data-testid="deleted-docs-refresh-btn"
            sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.4)}`, borderRadius: 2 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
      </FilterBar>

      <LogCard loading={loading} isEmpty={rows.length === 0} emptyText="Recycle bin is empty"
        testId="deleted-docs-table" EmptyIcon={DeleteIcon} count={count} page={page} rowsPerPage={rowsPerPage}
        onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Deleted</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Record</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Deleted By</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>State</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-testid={`deleted-docs-row-${row.id}`}
              sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
              <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(row.deleted_at)}</Typography></TableCell>
              <TableCell><Chip size="small" variant="outlined" label={row.document_type} /></TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight={600}>{row.restore_name || `#${row.document_id}`}</Typography>
                <Typography variant="caption" color="text.disabled">#{row.document_id}</Typography>
              </TableCell>
              <TableCell><UserCell name={row.deleted_by_name} /></TableCell>
              <TableCell>
                {row.restored_at ? (
                  <Tooltip title={`Restored ${formatDateTime(row.restored_at)}${row.restored_by_name ? " by " + row.restored_by_name : ""}`}>
                    <Chip size="small" color="success" icon={<CheckCircleIcon sx={{ fontSize: 15 }} />} label="Restored" />
                  </Tooltip>
                ) : (
                  <Chip size="small" color="warning" variant="outlined" label="In recycle bin" />
                )}
              </TableCell>
              <TableCell align="right">
                <Tooltip title={row.restored_at ? "Already restored" : "Restore"}>
                  <span>
                    <IconButton size="small" color="success" disabled={!!row.restored_at}
                      onClick={() => setTarget(row)} data-testid={`deleted-docs-restore-btn-${row.id}`}>
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </LogCard>

      <Dialog open={!!target} onClose={() => !restoring && setTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle><Typography component="span" variant="h6" fontWeight={700}>Restore record?</Typography></DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will restore <strong>{target?.restore_name || target?.document_type}</strong>{" "}
            ({target?.document_type} #{target?.document_id}) back into the system.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setTarget(null)} disabled={restoring} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" color="success" onClick={doRestore} disabled={restoring}
            data-testid="deleted-docs-restore-confirm-btn"
            startIcon={restoring ? <CircularProgress size={18} color="inherit" /> : <RestartAltIcon />}
            sx={{ textTransform: "none", borderRadius: 2 }}>
            {restoring ? "Restoring…" : "Restore"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

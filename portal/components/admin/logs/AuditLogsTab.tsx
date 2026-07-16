"use client";
import React, { useMemo, useState } from "react";
import {
  TextField, MenuItem, Chip, Tooltip, IconButton,
  TableBody, TableCell, TableHead, TableRow, Typography, alpha, useTheme,
} from "@mui/material";
import { RefreshIcon, SecurityIcon } from "@/components/icons";
import { useLogData, useDebounced, LogCard, FilterBar, UserCell, formatDateTime } from "./logShared";

interface AuditLogRow {
  id: number;
  user_name: string | null;
  action: string;
  module: string;
  document_type: string;
  document_id: number;
  status: string;
  error_message: string;
  timestamp: string;
}

const ACTION_COLOR: Record<string, "info" | "warning" | "error" | "success" | "default"> = {
  create: "info", update: "warning", delete: "error", approve: "success", reject: "error",
  login: "default", logout: "default",
};

export default function AuditLogsTab() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounced(search);

  const filters = useMemo(() => {
    const f: Record<string, string> = { ordering: "-timestamp" };
    if (debouncedSearch) f.search = debouncedSearch;
    if (actionFilter) f.action = actionFilter;
    if (statusFilter) f.status = statusFilter;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [debouncedSearch, actionFilter, statusFilter, dateFrom, dateTo]);

  const { rows, count, loading, page, setPage, rowsPerPage, setRowsPerPage, refetch } =
    useLogData<AuditLogRow>("/admin/audit-logs/", filters);

  return (
    <>
      <FilterBar testId="audit-logs-filter-bar">
        <TextField size="small" placeholder="Search module, type, user…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ "data-testid": "audit-logs-search-input" }} sx={{ minWidth: 220, flex: 1 }} />
        <TextField select size="small" label="Action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          inputProps={{ "data-testid": "audit-logs-action-filter" }} sx={{ minWidth: 150 }}>
          <MenuItem value="">All actions</MenuItem>
          {["create", "update", "delete", "approve", "reject", "login", "logout"].map((a) => (
            <MenuItem key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          inputProps={{ "data-testid": "audit-logs-status-filter" }} sx={{ minWidth: 140 }}>
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="success">Success</MenuItem>
          <MenuItem value="failed">Failed</MenuItem>
        </TextField>
        <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "audit-logs-date-from-input" }} sx={{ minWidth: 150 }} />
        <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "audit-logs-date-to-input" }} sx={{ minWidth: 150 }} />
        <Tooltip title="Refresh"><span>
          <IconButton onClick={refetch} disabled={loading} data-testid="audit-logs-refresh-btn"
            sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.4)}`, borderRadius: 2 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
      </FilterBar>

      <LogCard loading={loading} isEmpty={rows.length === 0} emptyText="No audit activity recorded yet"
        testId="audit-logs-table" EmptyIcon={SecurityIcon} count={count} page={page} rowsPerPage={rowsPerPage}
        onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Record</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-testid={`audit-logs-row-${row.id}`}
              sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
              <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(row.timestamp)}</Typography></TableCell>
              <TableCell><UserCell name={row.user_name} /></TableCell>
              <TableCell>
                <Chip size="small" color={ACTION_COLOR[row.action] || "default"}
                  label={row.action} sx={{ fontWeight: 600, textTransform: "capitalize" }} />
              </TableCell>
              <TableCell><Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize" }}>{row.module}</Typography></TableCell>
              <TableCell>
                <Typography variant="body2">{row.document_type}</Typography>
                <Typography variant="caption" color="text.disabled">#{row.document_id}</Typography>
              </TableCell>
              <TableCell>
                <Chip size="small" color={row.status === "success" ? "success" : "error"} label={row.status} variant="outlined" />
                {row.error_message ? (
                  <Tooltip title={row.error_message}>
                    <Typography variant="caption" color="error.main" sx={{ display: "block", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.error_message}
                    </Typography>
                  </Tooltip>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </LogCard>
    </>
  );
}

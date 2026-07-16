"use client";
import React, { useMemo, useState } from "react";
import {
  TextField, MenuItem, Chip, Tooltip, IconButton, Stack,
  TableBody, TableCell, TableHead, TableRow, Typography, alpha, useTheme,
} from "@mui/material";
import { RefreshIcon, LockPersonIcon, CheckCircleIcon, CancelIcon, PublicIcon } from "@/components/icons";
import { useLogData, useDebounced, LogCard, FilterBar, UserCell, formatDateTime } from "./logShared";

interface AccessLogRow {
  id: number;
  user_name: string | null;
  access_type: string;
  module: string;
  document_type: string;
  document_name: string;
  ip_address: string | null;
  success: boolean;
  timestamp: string;
}

const ACCESS_COLOR: Record<string, "default" | "info" | "warning"> = {
  view: "default", download: "info", export: "info", print: "default", api_access: "warning",
};

export default function AccessLogsTab() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [accessType, setAccessType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounced(search);

  const filters = useMemo(() => {
    const f: Record<string, string> = { ordering: "-timestamp" };
    if (debouncedSearch) f.search = debouncedSearch;
    if (accessType) f.access_type = accessType;
    if (statusFilter) f.success = statusFilter === "success" ? "true" : "false";
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [debouncedSearch, accessType, statusFilter, dateFrom, dateTo]);

  const { rows, count, loading, page, setPage, rowsPerPage, setRowsPerPage, refetch } =
    useLogData<AccessLogRow>("/admin/access-logs/", filters);

  return (
    <>
      <FilterBar testId="access-logs-filter-bar">
        <TextField size="small" placeholder="Search user, document, IP…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ "data-testid": "access-logs-search-input" }} sx={{ minWidth: 220, flex: 1 }} />
        <TextField select size="small" label="Type" value={accessType} onChange={(e) => setAccessType(e.target.value)}
          inputProps={{ "data-testid": "access-logs-type-filter" }} sx={{ minWidth: 150 }}>
          <MenuItem value="">All types</MenuItem>
          {["view", "download", "export", "print", "api_access"].map((t) => (
            <MenuItem key={t} value={t}>{t.replace("_", " ")}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          inputProps={{ "data-testid": "access-logs-status-filter" }} sx={{ minWidth: 140 }}>
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="success">Success</MenuItem>
          <MenuItem value="failed">Failed</MenuItem>
        </TextField>
        <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "access-logs-date-from-input" }} sx={{ minWidth: 150 }} />
        <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "access-logs-date-to-input" }} sx={{ minWidth: 150 }} />
        <Tooltip title="Refresh"><span>
          <IconButton onClick={refetch} disabled={loading} data-testid="access-logs-refresh-btn"
            sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.4)}`, borderRadius: 2 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
      </FilterBar>

      <LogCard loading={loading} isEmpty={rows.length === 0} emptyText="No document access recorded yet"
        testId="access-logs-table" EmptyIcon={LockPersonIcon} count={count} page={page} rowsPerPage={rowsPerPage}
        onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Document</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>IP Address</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-testid={`access-logs-row-${row.id}`}
              sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
              <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(row.timestamp)}</Typography></TableCell>
              <TableCell><UserCell name={row.user_name} /></TableCell>
              <TableCell>
                <Chip size="small" color={ACCESS_COLOR[row.access_type] || "default"}
                  label={row.access_type.replace("_", " ")} sx={{ fontWeight: 600, textTransform: "capitalize" }} />
              </TableCell>
              <TableCell><Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize" }}>{row.module}</Typography></TableCell>
              <TableCell>
                <Typography variant="body2">{row.document_name || "—"}</Typography>
                <Typography variant="caption" color="text.disabled">{row.document_type}</Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <PublicIcon sx={{ fontSize: 15, color: "text.disabled" }} />
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{row.ip_address || "—"}</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                {row.success
                  ? <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
                  : <CancelIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </LogCard>
    </>
  );
}

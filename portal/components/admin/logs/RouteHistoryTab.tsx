"use client";
import React, { useMemo, useState } from "react";
import {
  TextField, Chip, Tooltip, IconButton, Stack,
  TableBody, TableCell, TableHead, TableRow, Typography, alpha, useTheme,
} from "@mui/material";
import { RefreshIcon, RouteIcon, LocationOnIcon } from "@/components/icons";
import { useLogData, useDebounced, LogCard, FilterBar, UserCell, formatDate } from "./logShared";

interface RouteHistoryRow {
  id: number;
  agent_name: string | null;
  date: string;
  route_points: number;
  distance_km: string | number;
  visit_count: number;
  status: string;
}

export default function RouteHistoryTab() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounced(search);

  const filters = useMemo(() => {
    const f: Record<string, string> = { ordering: "-date" };
    if (debouncedSearch) f.search = debouncedSearch;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [debouncedSearch, dateFrom, dateTo]);

  const { rows, count, loading, page, setPage, rowsPerPage, setRowsPerPage, refetch } =
    useLogData<RouteHistoryRow>("/admin/route-history/", filters);

  return (
    <>
      <FilterBar testId="route-history-filter-bar">
        <TextField size="small" placeholder="Search agent…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ "data-testid": "route-history-search-input" }} sx={{ minWidth: 240, flex: 1 }} />
        <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "route-history-date-from-input" }} sx={{ minWidth: 150 }} />
        <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "route-history-date-to-input" }} sx={{ minWidth: 150 }} />
        <Tooltip title="Refresh"><span>
          <IconButton onClick={refetch} disabled={loading} data-testid="route-history-refresh-btn"
            sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.4)}`, borderRadius: 2 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
      </FilterBar>

      <LogCard loading={loading} isEmpty={rows.length === 0} emptyText="No route history yet"
        testId="route-history-table" EmptyIcon={RouteIcon} count={count} page={page} rowsPerPage={rowsPerPage}
        onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Agent</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Distance</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Visits</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>GPS Points</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-testid={`route-history-row-${row.id}`}
              sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
              <TableCell><Typography variant="body2" fontWeight={600}>{formatDate(row.date)}</Typography></TableCell>
              <TableCell><UserCell name={row.agent_name} /></TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <LocationOnIcon sx={{ fontSize: 15, color: "text.disabled" }} />
                  <Typography variant="body2">{Number(row.distance_km || 0).toFixed(2)} km</Typography>
                </Stack>
              </TableCell>
              <TableCell><Chip size="small" variant="outlined" label={`${row.visit_count} visit${row.visit_count === 1 ? "" : "s"}`} /></TableCell>
              <TableCell><Typography variant="body2" color="text.secondary">{row.route_points} pts</Typography></TableCell>
              <TableCell><Chip size="small" color={row.status === "completed" ? "success" : "default"} label={row.status} sx={{ textTransform: "capitalize" }} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </LogCard>
    </>
  );
}

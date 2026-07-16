"use client";
import React, { useMemo, useState } from "react";
import {
  Stack, TextField, MenuItem, Chip, Tooltip, IconButton,
  TableBody, TableCell, TableHead, TableRow, Typography, alpha, useTheme,
} from "@mui/material";
import {
  RefreshIcon, CheckCircleIcon, CancelIcon, LocationOnIcon, PublicIcon, HistoryIcon,
} from "@/components/icons";
import {
  useLogData, useDebounced, LogCard, FilterBar, UserCell, ROLE_LABELS, formatDateTime,
} from "./logShared";

type LoginEvent = "login" | "logout" | "failed_login";

interface LoginActivityRow {
  id: number;
  user_name: string | null;
  user_role: string | null;
  username_attempted: string;
  event: LoginEvent;
  success: boolean;
  method: string;
  platform: string;
  ip_address: string | null;
  location: string;
  location_resolved: boolean;
  detail: string;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = { login: "Login", logout: "Logout", failed_login: "Failed Login" };
const METHOD_LABELS: Record<string, string> = { password: "Password", otp: "OTP", pin: "PIN", unknown: "—" };
const PLATFORM_LABELS: Record<string, string> = { web: "Web", mobile: "Mobile App", unknown: "—" };
const DETAIL_LABELS: Record<string, string> = {
  invalid_credentials: "Invalid credentials",
  invalid_otp: "Invalid / expired OTP",
  invalid_pin: "Invalid PIN",
  account_blocked: "Account archived / deactivated",
  pending_approval: "Pending admin approval",
  user_not_found: "No matching account",
  missing_field: "Missing required field",
};

export default function LoginActivityTab() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [event, setEvent] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [method, setMethod] = useState("");
  const [platform, setPlatform] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounced(search);

  const filters = useMemo(() => {
    const f: Record<string, string> = { ordering: "-created_at" };
    if (debouncedSearch) f.search = debouncedSearch;
    if (event) f.event = event;
    if (statusFilter) f.success = statusFilter === "success" ? "true" : "false";
    if (method) f.method = method;
    if (platform) f.platform = platform;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [debouncedSearch, event, statusFilter, method, platform, dateFrom, dateTo]);

  const { rows, count, loading, page, setPage, rowsPerPage, setRowsPerPage, refetch } =
    useLogData<LoginActivityRow>("/admin/login-activity/", filters);

  return (
    <>
      <FilterBar testId="login-activity-filter-bar">
        <TextField size="small" placeholder="Search user, IP, city…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ "data-testid": "login-activity-search-input" }} sx={{ minWidth: 220, flex: 1 }} />
        <TextField select size="small" label="Event" value={event} onChange={(e) => setEvent(e.target.value)}
          inputProps={{ "data-testid": "login-activity-event-filter" }} sx={{ minWidth: 150 }}>
          <MenuItem value="">All events</MenuItem>
          <MenuItem value="login">Login</MenuItem>
          <MenuItem value="logout">Logout</MenuItem>
          <MenuItem value="failed_login">Failed Login</MenuItem>
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          inputProps={{ "data-testid": "login-activity-status-filter" }} sx={{ minWidth: 140 }}>
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="success">Success</MenuItem>
          <MenuItem value="failed">Failed</MenuItem>
        </TextField>
        <TextField select size="small" label="Method" value={method} onChange={(e) => setMethod(e.target.value)}
          inputProps={{ "data-testid": "login-activity-method-filter" }} sx={{ minWidth: 130 }}>
          <MenuItem value="">All methods</MenuItem>
          <MenuItem value="password">Password</MenuItem>
          <MenuItem value="otp">OTP</MenuItem>
          <MenuItem value="pin">PIN</MenuItem>
        </TextField>
        <TextField select size="small" label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)}
          inputProps={{ "data-testid": "login-activity-platform-filter" }} sx={{ minWidth: 140 }}>
          <MenuItem value="">All platforms</MenuItem>
          <MenuItem value="web">Web</MenuItem>
          <MenuItem value="mobile">Mobile App</MenuItem>
        </TextField>
        <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "login-activity-date-from-input" }} sx={{ minWidth: 150 }} />
        <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "login-activity-date-to-input" }} sx={{ minWidth: 150 }} />
        <Tooltip title="Refresh"><span>
          <IconButton onClick={refetch} disabled={loading} data-testid="login-activity-refresh-btn"
            sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.4)}`, borderRadius: 2 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
      </FilterBar>

      <LogCard loading={loading} isEmpty={rows.length === 0} emptyText="No login activity recorded yet"
        testId="login-activity-table" EmptyIcon={HistoryIcon} count={count} page={page} rowsPerPage={rowsPerPage}
        onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Platform</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>IP Address</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-testid={`login-activity-row-${row.id}`}
              sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                ...(!row.success ? { bgcolor: alpha(theme.palette.error.main, 0.03) } : {}) }}>
              <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(row.created_at)}</Typography></TableCell>
              <TableCell>
                <UserCell name={row.user_name || row.username_attempted}
                  subtitle={row.user_role ? (ROLE_LABELS[row.user_role] || row.user_role) : null} />
              </TableCell>
              <TableCell>
                <Chip size="small" color={row.event === "failed_login" || !row.success ? "error" : row.event === "logout" ? "info" : "success"}
                  icon={row.success ? <CheckCircleIcon sx={{ fontSize: 15 }} /> : <CancelIcon sx={{ fontSize: 15 }} />}
                  label={EVENT_LABELS[row.event]} variant={row.success ? "filled" : "outlined"} sx={{ fontWeight: 600 }} />
              </TableCell>
              <TableCell><Typography variant="body2" color="text.secondary">{METHOD_LABELS[row.method] || row.method}</Typography></TableCell>
              <TableCell><Typography variant="body2" color="text.secondary">{PLATFORM_LABELS[row.platform] || row.platform}</Typography></TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <PublicIcon sx={{ fontSize: 15, color: "text.disabled" }} />
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{row.ip_address || "—"}</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                {row.location ? (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <LocationOnIcon sx={{ fontSize: 15, color: "text.disabled" }} />
                    <Typography variant="body2" color="text.secondary">{row.location}</Typography>
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    {row.ip_address && !row.location_resolved ? "Resolving…" : "—"}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {row.detail ? (
                  <Typography variant="caption" color="error.main">{DETAIL_LABELS[row.detail] || row.detail}</Typography>
                ) : (<Typography variant="caption" color="text.disabled">—</Typography>)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </LogCard>
    </>
  );
}

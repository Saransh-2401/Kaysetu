"use client";
import React, { useMemo, useState } from "react";
import {
  TextField, MenuItem, Chip, Tooltip, IconButton, Stack,
  TableBody, TableCell, TableHead, TableRow, Typography, alpha, useTheme,
} from "@mui/material";
import {
  RefreshIcon, NotificationsIcon, NotificationsActiveIcon, EmailIcon, SmsIcon,
  WhatsAppIcon, MoveToInboxIcon, CheckCircleIcon, WarningIcon,
} from "@/components/icons";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useLogData, useDebounced, LogCard, FilterBar, UserCell, formatDateTime } from "./logShared";

interface NotificationRow {
  id: number;
  recipient_name: string | null;
  notification_type: string;
  status: string;
  subject: string;
  is_urgent: boolean;
  sent_at: string | null;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  email: EmailIcon, sms: SmsIcon, push: NotificationsActiveIcon,
  in_app: MoveToInboxIcon, whatsapp: WhatsAppIcon,
};
const STATUS_COLOR: Record<string, "default" | "info" | "success" | "error"> = {
  pending: "default", sent: "info", delivered: "success", failed: "error", read: "default",
};

export default function NotificationsTab() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [urgentFilter, setUrgentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounced(search);

  const filters = useMemo(() => {
    const f: Record<string, string> = { ordering: "-created_at" };
    if (debouncedSearch) f.search = debouncedSearch;
    if (typeFilter) f.notification_type = typeFilter;
    if (statusFilter) f.status = statusFilter;
    if (urgentFilter) f.is_urgent = urgentFilter;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [debouncedSearch, typeFilter, statusFilter, urgentFilter, dateFrom, dateTo]);

  const { rows, count, loading, page, setPage, rowsPerPage, setRowsPerPage, refetch } =
    useLogData<NotificationRow>("/admin/notifications/", filters);

  const markRead = async (id: number) => {
    try {
      await apiClient.post(`/admin/notifications/${id}/mark_read/`);
      toast.success("Marked as read");
      refetch();
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  return (
    <>
      <FilterBar testId="notifications-filter-bar">
        <TextField size="small" placeholder="Search subject, message, recipient…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ "data-testid": "notifications-search-input" }} sx={{ minWidth: 220, flex: 1 }} />
        <TextField select size="small" label="Channel" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          inputProps={{ "data-testid": "notifications-type-filter" }} sx={{ minWidth: 140 }}>
          <MenuItem value="">All channels</MenuItem>
          {["email", "sms", "push", "in_app", "whatsapp"].map((t) => (
            <MenuItem key={t} value={t}>{t.replace("_", "-")}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          inputProps={{ "data-testid": "notifications-status-filter" }} sx={{ minWidth: 140 }}>
          <MenuItem value="">All statuses</MenuItem>
          {["pending", "sent", "delivered", "failed", "read"].map((s) => (
            <MenuItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Urgency" value={urgentFilter} onChange={(e) => setUrgentFilter(e.target.value)}
          inputProps={{ "data-testid": "notifications-urgent-filter" }} sx={{ minWidth: 130 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="true">Urgent</MenuItem>
          <MenuItem value="false">Normal</MenuItem>
        </TextField>
        <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "notifications-date-from-input" }} sx={{ minWidth: 150 }} />
        <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "notifications-date-to-input" }} sx={{ minWidth: 150 }} />
        <Tooltip title="Refresh"><span>
          <IconButton onClick={refetch} disabled={loading} data-testid="notifications-refresh-btn"
            sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.4)}`, borderRadius: 2 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
      </FilterBar>

      <LogCard loading={loading} isEmpty={rows.length === 0} emptyText="No notifications recorded yet"
        testId="notifications-table" EmptyIcon={NotificationsIcon} count={count} page={page} rowsPerPage={rowsPerPage}
        onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Recipient</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Channel</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const TypeIcon = TYPE_ICON[row.notification_type] || NotificationsIcon;
            return (
              <TableRow key={row.id} data-testid={`notifications-row-${row.id}`}
                sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
                <TableCell><Typography variant="body2" color="text.secondary">{formatDateTime(row.created_at)}</Typography></TableCell>
                <TableCell><UserCell name={row.recipient_name} /></TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" icon={<TypeIcon sx={{ fontSize: 15 }} />}
                    label={row.notification_type.replace("_", "-")} sx={{ textTransform: "capitalize" }} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    {row.is_urgent ? <WarningIcon sx={{ fontSize: 15, color: theme.palette.warning.main }} /> : null}
                    <Typography variant="body2" sx={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.subject || "—"}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip size="small" color={STATUS_COLOR[row.status] || "default"} label={row.status}
                    variant={row.status === "read" ? "outlined" : "filled"} sx={{ textTransform: "capitalize" }} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={row.status === "read" ? "Already read" : "Mark as read"}>
                    <span>
                      <IconButton size="small" disabled={row.status === "read"} onClick={() => markRead(row.id)}
                        data-testid={`notifications-mark-read-btn-${row.id}`}>
                        <CheckCircleIcon fontSize="small" color={row.status === "read" ? "disabled" : "success"} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </LogCard>
    </>
  );
}

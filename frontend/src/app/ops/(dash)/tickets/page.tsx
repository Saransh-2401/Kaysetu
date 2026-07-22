"use client";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, Snackbar, Stack, Switch,
  Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip,
  Typography, alpha,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

interface TicketMessage {
  id: number;
  author_kind: "tenant" | "superadmin";
  author_name: string;
  is_internal: boolean;
  body: string;
  created_at: string;
}

interface Ticket {
  id: number;
  ticket_no: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: string;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  last_reply_by: string;
  message_count: number | null;
  tenant: { org_code: string; name: string; status: string };
  assigned_to: { id: number; full_name: string; email: string } | null;
  messages?: TicketMessage[];
}

interface AdminRow {
  id: number;
  full_name: string;
  email: string;
}

const STATUSES = ["open", "in_progress", "waiting_on_customer", "resolved", "closed"] as const;

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_customer: "Waiting on Customer",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLOR: Record<string, "info" | "warning" | "secondary" | "success" | "default"> = {
  open: "info",
  in_progress: "warning",
  waiting_on_customer: "secondary",
  resolved: "success",
  closed: "default",
};

const PRIORITY_COLOR: Record<string, "default" | "info" | "warning" | "error"> = {
  low: "default",
  medium: "info",
  high: "warning",
  urgent: "error",
};

const dateIN = (value: string) =>
  new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function OpsTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("status", tab);
      if (search.trim()) params.set("q", search.trim());
      const query = params.toString();
      const [list, counts] = await Promise.all([
        api<Ticket[]>("ops", `/sa/support/tickets${query ? `?${query}` : ""}`),
        api<Record<string, number>>("ops", "/sa/support/summary"),
      ]);
      setTickets(list);
      setSummary(counts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<AdminRow[]>("ops", "/sa/support/admins").then(setAdmins).catch(() => setAdmins([]));
  }, []);

  const openDetail = async (ticket: Ticket) => {
    try {
      setActive(await api<Ticket>("ops", `/sa/support/tickets/${ticket.id}`));
      setReply("");
      setInternal(false);
      setWaiting(false);
    } catch {
      setToast("Could not open the ticket.");
    }
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      const updated = await api<Ticket>("ops", `/sa/support/tickets/${active.id}/reply`, {
        method: "POST",
        body: { body: reply.trim(), is_internal: internal, waiting_on_customer: waiting },
      });
      setActive(updated);
      setReply("");
      setToast(internal ? "Internal note added." : "Reply sent to the tenant.");
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  const updateTicket = async (patch: Record<string, unknown>, message: string) => {
    if (!active) return;
    setBusy(true);
    try {
      const updated = await api<Ticket>("ops", `/sa/support/tickets/${active.id}/update`, {
        method: "POST",
        body: patch,
      });
      setActive(updated);
      setToast(message);
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box data-testid="ops-tickets-container">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <SupportAgentIcon color="primary" />
        <Typography variant="h5" fontWeight={800}>
          Support Tickets
        </Typography>
        {summary && (
          <Chip
            size="small"
            color={summary.needs_attention ? "warning" : "success"}
            label={`${summary.needs_attention ?? 0} need attention`}
            data-testid="ops-tickets-attention-chip"
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder="Search subject / org / email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          inputProps={{ "data-testid": "ops-tickets-search-input" }}
          sx={{ width: 260 }}
        />
        <Tooltip title="Refresh">
          <IconButton onClick={load} data-testid="ops-tickets-refresh-btn">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="ops-tickets-error-alert">
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          sx={{ px: 1 }}
          data-testid="ops-tickets-status-tabs"
        >
          <Tab value="all" label={`All${summary ? ` (${Object.values(STATUSES).reduce((n, s) => n + (summary[s] ?? 0), 0)})` : ""}`} />
          {STATUSES.map((status) => (
            <Tab
              key={status}
              value={status}
              label={`${STATUS_LABEL[status]}${summary ? ` (${summary[status] ?? 0})` : ""}`}
              data-testid={`ops-tickets-tab-${status}`}
            />
          ))}
        </Tabs>

        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress data-testid="ops-tickets-loading-spinner" />
          </Box>
        ) : (
          <Table size="small" data-testid="ops-tickets-table">
            <TableHead>
              <TableRow>
                <TableCell>Ticket</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  hover
                  onClick={() => openDetail(ticket)}
                  sx={{ cursor: "pointer" }}
                  data-testid={`ops-ticket-row-${ticket.id}`}
                >
                  <TableCell sx={{ fontFamily: "monospace" }}>{ticket.ticket_no}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {ticket.tenant.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {ticket.tenant.org_code} · {ticket.created_by_email}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant="body2" noWrap>
                      {ticket.subject}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={ticket.priority}
                      color={PRIORITY_COLOR[ticket.priority]} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={STATUS_LABEL[ticket.status] ?? ticket.status}
                      color={STATUS_COLOR[ticket.status] ?? "default"} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={ticket.assigned_to ? "text.primary" : "text.disabled"}>
                      {ticket.assigned_to?.full_name ?? "Unassigned"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{dateIN(ticket.updated_at)}</Typography>
                    {ticket.last_reply_by === "tenant" && ticket.status !== "closed" && (
                      <Chip size="small" label="tenant replied" color="warning" variant="outlined" sx={{ ml: 0.5 }} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }} data-testid="ops-tickets-empty-text">
                      No tickets here — the queue is clear.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Detail / work dialog */}
      <Dialog open={active !== null} onClose={() => setActive(null)} maxWidth="md" fullWidth>
        {active && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography component="span" fontFamily="monospace" color="text.secondary">
                  {active.ticket_no}
                </Typography>
                <Typography component="span" fontWeight={800}>
                  {active.subject}
                </Typography>
                <Chip size="small" label={active.tenant.org_code} variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {active.tenant.name} · raised by {active.created_by_name || active.created_by_email} ·{" "}
                {dateIN(active.created_at)}
              </Typography>
              <IconButton onClick={() => setActive(null)} sx={{ position: "absolute", right: 8, top: 8 }}
                data-testid="ops-ticket-close-dialog-btn">
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent dividers>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  select size="small" label="Status" value={active.status} sx={{ minWidth: 200 }}
                  onChange={(e) => updateTicket({ status: e.target.value }, `Status → ${STATUS_LABEL[e.target.value]}`)}
                  data-testid="ops-ticket-status-select"
                >
                  {STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>{STATUS_LABEL[status]}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select size="small" label="Priority" value={active.priority} sx={{ minWidth: 140 }}
                  onChange={(e) => updateTicket({ priority: e.target.value }, `Priority → ${e.target.value}`)}
                  data-testid="ops-ticket-priority-select"
                >
                  {(["low", "medium", "high", "urgent"] as const).map((priority) => (
                    <MenuItem key={priority} value={priority} sx={{ textTransform: "capitalize" }}>
                      {priority}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select size="small" label="Assignee" value={active.assigned_to?.id ?? 0} sx={{ minWidth: 220 }}
                  onChange={(e) =>
                    updateTicket(
                      { assigned_to_id: Number(e.target.value) || null },
                      Number(e.target.value) ? "Ticket assigned." : "Ticket unassigned."
                    )
                  }
                  data-testid="ops-ticket-assignee-select"
                >
                  <MenuItem value={0}>Unassigned</MenuItem>
                  {admins.map((admin) => (
                    <MenuItem key={admin.id} value={admin.id}>{admin.full_name || admin.email}</MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack spacing={1.25} data-testid="ops-ticket-thread">
                {(active.messages ?? []).map((message) => {
                  const fromTenant = message.author_kind === "tenant";
                  return (
                    <Box
                      key={message.id}
                      sx={{
                        alignSelf: fromTenant ? "flex-start" : "flex-end",
                        maxWidth: "84%",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: (t) =>
                          message.is_internal
                            ? alpha(t.palette.warning.main, 0.12)
                            : fromTenant
                              ? alpha(t.palette.primary.main, 0.06)
                              : alpha(t.palette.secondary.main, 0.10),
                        border: (t) =>
                          `1px dashed ${message.is_internal ? t.palette.warning.main : "transparent"}`,
                      }}
                      data-testid={`ops-ticket-message-${message.id}`}
                    >
                      <Typography variant="caption" fontWeight={700}>
                        {fromTenant ? `${message.author_name || "Tenant"} (tenant)` : message.author_name}
                        {message.is_internal && " · INTERNAL NOTE"}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {dateIN(message.created_at)}
                        </Typography>
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.25 }}>
                        {message.body}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>
              <TextField
                placeholder={internal ? "Internal note (tenant never sees this)…" : "Reply to the tenant…"}
                size="small" fullWidth multiline maxRows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                inputProps={{ "data-testid": "ops-ticket-reply-input" }}
                sx={{ flexGrow: 1, minWidth: 260 }}
              />
              <FormControlLabel
                control={<Switch size="small" checked={internal} onChange={(e) => setInternal(e.target.checked)}
                  data-testid="ops-ticket-internal-switch" />}
                label={<Typography variant="caption">Internal</Typography>}
              />
              <FormControlLabel
                control={<Switch size="small" checked={waiting} disabled={internal}
                  onChange={(e) => setWaiting(e.target.checked)} data-testid="ops-ticket-waiting-switch" />}
                label={<Typography variant="caption">Needs customer</Typography>}
              />
              <Button variant="contained" endIcon={<SendIcon />} disabled={busy || !reply.trim()}
                onClick={sendReply} data-testid="ops-ticket-send-btn">
                {internal ? "Add note" : "Send"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={3500} onClose={() => setToast(null)} message={toast}
        data-testid="ops-tickets-toast" />
    </Box>
  );
}

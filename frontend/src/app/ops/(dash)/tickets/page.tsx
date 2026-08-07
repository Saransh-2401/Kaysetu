"use client";
import CloseIcon from "@mui/icons-material/Close";
import InboxIcon from "@mui/icons-material/MarkEmailRead";
import LockIcon from "@mui/icons-material/LockOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import SendIcon from "@mui/icons-material/Send";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  Tab,
  TableBody,
  TableCell,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CodeText,
  EmptyRow,
  EmptyState,
  HeadRow,
  PageHeader,
  SearchField,
  StatusChip,
  TableShell,
  TableSkeleton,
  TableToolbar,
  fmtAgo,
  fmtDateTime,
  type Column,
  type Tone,
} from "@/components/ui/kit";
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

const STATUS_TONE: Record<string, Tone> = {
  open: "info",
  in_progress: "warning",
  waiting_on_customer: "gold",
  resolved: "success",
  closed: "neutral",
};

const PRIORITY_TONE: Record<string, Tone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

const COLS: Column[] = [
  { key: "Ticket", width: 120 },
  { key: "Tenant", width: 200 },
  { key: "Subject" },
  { key: "Priority", align: "center", width: 100 },
  { key: "Status", align: "center", width: 150 },
  { key: "Assignee", width: 150 },
  { key: "Updated", align: "right", width: 140 },
];

export default function OpsTicketsPage() {
  const theme = useTheme();
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
  const threadEndRef = useRef<HTMLDivElement | null>(null);

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

  // Land on the newest message whenever the thread changes, like any chat UI.
  useEffect(() => {
    if (active?.messages?.length) {
      threadEndRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [active?.messages?.length, active?.id]);

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

  const filtersActive = Boolean(search.trim()) || tab !== "all";
  const allCount = summary ? STATUSES.reduce((n, s) => n + (summary[s] ?? 0), 0) : 0;

  return (
    <Box data-testid="ops-tickets-container">
      <PageHeader
        title="Support Tickets"
        subtitle="Every tenant conversation, and who owns it"
        icon={<SupportAgentIcon />}
        actions={
          <>
            {summary && (
              <StatusChip
                label={`${summary.needs_attention ?? 0} need attention`}
                tone={summary.needs_attention ? "warning" : "success"}
                testId="ops-tickets-attention-chip"
              />
            )}
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  onClick={load}
                  disabled={loading}
                  aria-label="Refresh tickets"
                  data-testid="ops-tickets-refresh-btn"
                  sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}
                >
                  <RefreshIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="ops-tickets-error-alert" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableShell
        testId="ops-tickets-table"
        minWidth={1080}
        toolbar={
          <Box sx={{ width: "100%" }}>
            <Box sx={{ px: 0.5, borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}` }}>
              <Tabs
                value={tab}
                onChange={(_, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                data-testid="ops-tickets-status-tabs"
              >
                <Tab value="all" label={`All${summary ? ` (${allCount})` : ""}`} />
                {STATUSES.map((status) => (
                  <Tab
                    key={status}
                    value={status}
                    label={`${STATUS_LABEL[status]}${summary ? ` (${summary[status] ?? 0})` : ""}`}
                    data-testid={`ops-tickets-tab-${status}`}
                  />
                ))}
              </Tabs>
            </Box>
            <TableToolbar>
              <SearchField
                value={search}
                onChange={setSearch}
                onSubmit={load}
                placeholder="Search subject, org or email"
                width={290}
                testId="ops-tickets-search-input"
              />
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {loading ? "Loading…" : `${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"}`}
              </Typography>
            </TableToolbar>
          </Box>
        }
      >
        <HeadRow cols={COLS} />

        {loading ? (
          <TableSkeleton cols={COLS.length} />
        ) : tickets.length === 0 ? (
          <EmptyRow
            cols={COLS.length}
            icon={filtersActive ? <SearchOffIcon /> : <InboxIcon />}
            message={filtersActive ? "No tickets in this view" : "The queue is clear"}
            hint={
              filtersActive
                ? "Try another search term or switch back to All."
                : "Nothing is waiting on the support team right now."
            }
            testId="ops-tickets-empty-text"
            action={
              filtersActive ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSearch("");
                    setTab("all");
                  }}
                >
                  Reset view
                </Button>
              ) : undefined
            }
          />
        ) : (
          <TableBody>
            {tickets.map((ticket) => {
              const awaitingUs = ticket.last_reply_by === "tenant" && ticket.status !== "closed";
              return (
                <TableRow
                  key={ticket.id}
                  hover
                  onClick={() => openDetail(ticket)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && openDetail(ticket)}
                  data-testid={`ops-ticket-row-${ticket.id}`}
                  sx={{
                    cursor: "pointer",
                    // Rows we owe a reply on get a warm left rail — plus the
                    // "tenant replied" chip below, so it never reads by colour alone.
                    ...(awaitingUs && {
                      boxShadow: `inset 3px 0 0 ${theme.palette.warning.main}`,
                    }),
                  }}
                >
                  <TableCell>
                    <CodeText>{ticket.ticket_no}</CodeText>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {ticket.tenant.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {ticket.tenant.org_code}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 340 }}>
                    <Typography variant="body2" noWrap>
                      {ticket.subject}
                    </Typography>
                    {/* "tenant replied" rides the existing meta line rather than
                        adding one, so flagged rows stay the same height as the rest. */}
                    <Typography variant="caption" color="text.disabled">
                      {ticket.message_count !== null &&
                        `${ticket.message_count} ${ticket.message_count === 1 ? "message" : "messages"}`}
                      {awaitingUs && (
                        <Box component="span" sx={{ color: "warning.dark", fontWeight: 700 }}>
                          {ticket.message_count !== null ? " · " : ""}tenant replied
                        </Box>
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <StatusChip
                      label={ticket.priority}
                      tone={PRIORITY_TONE[ticket.priority] ?? "neutral"}
                      variant="outline"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <StatusChip
                      label={STATUS_LABEL[ticket.status] ?? ticket.status}
                      tone={STATUS_TONE[ticket.status] ?? "neutral"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      noWrap
                      color={ticket.assigned_to ? "text.primary" : "text.disabled"}
                    >
                      {ticket.assigned_to?.full_name ?? "Unassigned"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="text.secondary">
                      {fmtAgo(ticket.updated_at)}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        )}
      </TableShell>

      {/* ── Ticket workspace ────────────────────────────────────── */}
      <Dialog open={active !== null} onClose={() => setActive(null)} maxWidth="md" fullWidth>
        {active && (
          <>
            <Box
              sx={{
                px: 3,
                pt: 2.5,
                pb: 2,
                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                    <Typography variant="h6" sx={{ fontSize: "1.05rem" }}>
                      {active.subject}
                    </Typography>
                    <StatusChip
                      label={active.priority}
                      tone={PRIORITY_TONE[active.priority] ?? "neutral"}
                      variant="outline"
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap">
                    <CodeText>{active.ticket_no}</CodeText>
                    <Typography variant="caption" color="text.secondary">
                      {active.tenant.name} ({active.tenant.org_code}) · raised by{" "}
                      {active.created_by_name || active.created_by_email} · {fmtDateTime(active.created_at)}
                    </Typography>
                  </Stack>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setActive(null)}
                  aria-label="Close ticket"
                  data-testid="ops-ticket-close-dialog-btn"
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Stack>
            </Box>

            {/* Triage controls stay pinned above the thread. */}
            <Box
              sx={{
                px: 3,
                py: 1.75,
                bgcolor: alpha(theme.palette.primary.main, 0.025),
                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
              }}
            >
              <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ rowGap: 1.5 }}>
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={active.status}
                  sx={{ minWidth: 195 }}
                  onChange={(e) =>
                    updateTicket({ status: e.target.value }, `Status → ${STATUS_LABEL[e.target.value]}`)
                  }
                  data-testid="ops-ticket-status-select"
                >
                  {STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Priority"
                  value={active.priority}
                  sx={{ minWidth: 135 }}
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
                  select
                  size="small"
                  label="Assignee"
                  value={active.assigned_to?.id ?? 0}
                  sx={{ minWidth: 205 }}
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
                    <MenuItem key={admin.id} value={admin.id}>
                      {admin.full_name || admin.email}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Box>

            <DialogContent sx={{ bgcolor: "background.default", p: 2.5 }}>
              <Stack spacing={1.5} data-testid="ops-ticket-thread">
                {(active.messages ?? []).length === 0 && (
                  <EmptyState message="No messages on this ticket yet" />
                )}

                {(active.messages ?? []).map((message) => {
                  const fromTenant = message.author_kind === "tenant";
                  const bubbleColor = message.is_internal
                    ? theme.palette.warning.main
                    : fromTenant
                      ? theme.palette.primary.main
                      : theme.palette.secondary.main;

                  return (
                    <Stack
                      key={message.id}
                      data-testid={`ops-ticket-message-${message.id}`}
                      spacing={0.5}
                      sx={{ alignItems: fromTenant ? "flex-start" : "flex-end" }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        sx={{ px: 0.5, flexDirection: fromTenant ? "row" : "row-reverse" }}
                      >
                        <Avatar
                          sx={{
                            width: 20,
                            height: 20,
                            fontSize: "0.58rem",
                            fontWeight: 700,
                            bgcolor: alpha(bubbleColor, 0.18),
                            color: bubbleColor,
                          }}
                        >
                          {(message.author_name || (fromTenant ? "T" : "K")).charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="caption" fontWeight={700} sx={{ mx: 0.75 }}>
                          {fromTenant
                            ? `${message.author_name || "Tenant"} · tenant`
                            : message.author_name || "KaySetu"}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {fmtDateTime(message.created_at)}
                        </Typography>
                      </Stack>

                      <Box
                        sx={{
                          maxWidth: "86%",
                          px: 1.75,
                          py: 1.25,
                          borderRadius: "12px",
                          // Tail corner points at the author's side.
                          borderTopLeftRadius: fromTenant ? 3 : "12px",
                          borderTopRightRadius: fromTenant ? "12px" : 3,
                          bgcolor: alpha(bubbleColor, message.is_internal ? 0.1 : 0.06),
                          border: message.is_internal
                            ? `1px dashed ${alpha(theme.palette.warning.main, 0.55)}`
                            : `1px solid ${alpha(bubbleColor, 0.16)}`,
                        }}
                      >
                        {message.is_internal && (
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
                            <LockIcon sx={{ fontSize: 12, color: "warning.dark" }} />
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: "0.6rem",
                                fontWeight: 800,
                                letterSpacing: "0.08em",
                                color: "warning.dark",
                              }}
                            >
                              INTERNAL NOTE · TENANT CANNOT SEE THIS
                            </Typography>
                          </Stack>
                        )}
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {message.body}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })}
                <div ref={threadEndRef} />
              </Stack>
            </DialogContent>

            {/* Composer */}
            <Box
              sx={{
                px: 3,
                py: 2,
                borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                bgcolor: internal ? alpha(theme.palette.warning.main, 0.05) : "background.paper",
                transition: "background-color 0.2s",
              }}
            >
              <TextField
                placeholder={
                  internal ? "Internal note — the tenant never sees this…" : "Reply to the tenant…"
                }
                size="small"
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                slotProps={{ htmlInput: { "data-testid": "ops-ticket-reply-input" } }}
                sx={{ mb: 1.25 }}
              />
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ rowGap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                      data-testid="ops-ticket-internal-switch"
                    />
                  }
                  label={<Typography variant="caption">Internal note</Typography>}
                />
                <Tooltip
                  title={internal ? "Not applicable to internal notes" : "Marks the ticket as waiting on the customer"}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={waiting}
                        disabled={internal}
                        onChange={(e) => setWaiting(e.target.checked)}
                        data-testid="ops-ticket-waiting-switch"
                      />
                    }
                    label={<Typography variant="caption">Needs customer</Typography>}
                  />
                </Tooltip>

                <Box sx={{ flexGrow: 1 }} />

                {internal && (
                  <Chip
                    size="small"
                    icon={<LockIcon sx={{ fontSize: 12 }} />}
                    label="Private"
                    sx={{
                      height: 22,
                      fontSize: "0.66rem",
                      bgcolor: alpha(theme.palette.warning.main, 0.14),
                      color: "warning.dark",
                    }}
                  />
                )}
                <Button
                  variant="contained"
                  endIcon={<SendIcon sx={{ fontSize: 15 }} />}
                  disabled={busy || !reply.trim()}
                  onClick={sendReply}
                  data-testid="ops-ticket-send-btn"
                >
                  {internal ? "Add note" : "Send reply"}
                </Button>
              </Stack>
            </Box>
          </>
        )}
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        data-testid="ops-tickets-toast"
      />
    </Box>
  );
}

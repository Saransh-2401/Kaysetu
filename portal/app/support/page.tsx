"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";

import {
  AddIcon,
  CloseIcon,
  RefreshIcon,
  SendIcon,
  SupportAgentIcon,
} from "@/components/icons";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  supportService,
  type SupportTicket,
  type TicketStatus,
} from "@/lib/support-service";

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_customer: "Waiting on You",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLOR: Record<TicketStatus, "info" | "warning" | "secondary" | "success" | "default"> = {
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
  new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const EMPTY_FORM = { subject: "", description: "", category: "technical", priority: "medium" };

export default function SupportPage() {
  const theme = useTheme();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | TicketStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState<{ subject?: string; description?: string }>({});
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await supportService.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (tab === "all" ? tickets : tickets.filter((t) => t.status === tab)),
    [tickets, tab]
  );

  const openDetail = async (ticket: SupportTicket) => {
    try {
      setActive(await supportService.get(ticket.id));
      setReply("");
    } catch {
      setToast("Could not open the ticket.");
    }
  };

  const submitCreate = async () => {
    const errors: typeof formErrors = {};
    if (!form.subject.trim()) errors.subject = "Give the ticket a short subject.";
    if (form.description.trim().length < 10)
      errors.description = "Describe the issue in at least a sentence.";
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const created = await supportService.create({
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
      });
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      setToast(`Ticket ${created.ticket_no} created — our team will get back to you.`);
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not create the ticket.");
    } finally {
      setSaving(false);
    }
  };

  const submitReply = async () => {
    if (!active || !reply.trim()) return;
    setReplying(true);
    try {
      const updated = await supportService.reply(active.id, reply.trim());
      setActive(updated);
      setReply("");
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not send the reply.");
    } finally {
      setReplying(false);
    }
  };

  const closeTicket = async () => {
    if (!active) return;
    try {
      const updated = await supportService.close(active.id);
      setActive(updated);
      setToast(`${updated.ticket_no} closed.`);
      await load();
    } catch {
      setToast("Could not close the ticket.");
    }
  };

  return (
    <Box data-testid="support-page-container">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <SupportAgentIcon color="primary" />
        <Typography variant="h4" fontWeight={800}>
          Support
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh">
          <IconButton onClick={load} data-testid="support-refresh-btn">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          data-testid="support-new-ticket-btn"
        >
          New Ticket
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>
        Facing an issue? Raise a ticket and the KaySetu team will sort it out.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="support-error-alert">
          {error}
        </Alert>
      )}

      <Paper sx={{ borderRadius: 1 }} data-testid="support-tickets-card">
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          sx={{ px: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}
          data-testid="support-status-tabs"
        >
          <Tab label={`All (${tickets.length})`} value="all" data-testid="support-tab-all" />
          {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((status) => {
            const count = tickets.filter((t) => t.status === status).length;
            return (
              <Tab
                key={status}
                value={status}
                label={`${STATUS_LABEL[status]} (${count})`}
                data-testid={`support-tab-${status}`}
              />
            );
          })}
        </Tabs>

        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress data-testid="support-loading-spinner" />
          </Box>
        ) : visible.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }} data-testid="support-empty-state">
            <SupportAgentIcon sx={{ fontSize: 44, color: "text.disabled" }} />
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {tab === "all" ? "No tickets yet — raise one if you hit a problem." : "Nothing in this state."}
            </Typography>
          </Box>
        ) : (
          <Stack divider={<Box sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} />}>
            {visible.map((ticket) => (
              <Box
                key={ticket.id}
                onClick={() => openDetail(ticket)}
                sx={{
                  px: 2.5,
                  py: 1.75,
                  cursor: "pointer",
                  transition: "background 120ms",
                  "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                }}
                data-testid={`support-ticket-row-${ticket.id}`}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 82, fontFamily: "monospace" }}>
                    {ticket.ticket_no}
                  </Typography>
                  <Typography fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
                    {ticket.subject}
                  </Typography>
                  <Chip
                    size="small"
                    label={ticket.priority}
                    color={PRIORITY_COLOR[ticket.priority]}
                    variant="outlined"
                    sx={{ textTransform: "capitalize" }}
                  />
                  <Chip size="small" label={STATUS_LABEL[ticket.status]} color={STATUS_COLOR[ticket.status]} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category} · updated{" "}
                  {dateIN(ticket.updated_at)}
                  {ticket.last_reply_by === "superadmin" && " · support replied"}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Raise a support ticket</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }} data-testid="support-create-form">
            <TextField
              label="Subject"
              required
              value={form.subject}
              error={Boolean(formErrors.subject)}
              helperText={formErrors.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              inputProps={{ maxLength: 200, "data-testid": "support-subject-input" }}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Category"
                fullWidth
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                data-testid="support-category-select"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <MenuItem key={c.value} value={c.value} data-testid={`support-category-option-${c.value}`}>
                    {c.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Priority"
                fullWidth
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                data-testid="support-priority-select"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <MenuItem key={p.value} value={p.value} data-testid={`support-priority-option-${p.value}`}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label="Describe the issue"
              required
              multiline
              minRows={4}
              value={form.description}
              error={Boolean(formErrors.description)}
              helperText={formErrors.description ?? "Steps, screenshots links, what you expected — the more detail the faster the fix."}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              inputProps={{ "data-testid": "support-description-input" }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={saving} data-testid="support-create-cancel-btn">
            Cancel
          </Button>
          <Button variant="contained" onClick={submitCreate} disabled={saving} data-testid="support-create-submit-btn">
            {saving ? <CircularProgress size={22} color="inherit" /> : "Create ticket"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail dialog */}
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
                <Chip size="small" label={STATUS_LABEL[active.status]} color={STATUS_COLOR[active.status]}
                  data-testid="support-detail-status-chip" />
                <Chip size="small" variant="outlined" label={active.priority} color={PRIORITY_COLOR[active.priority]}
                  sx={{ textTransform: "capitalize" }} />
              </Stack>
              <IconButton
                onClick={() => setActive(null)}
                sx={{ position: "absolute", right: 8, top: 8 }}
                data-testid="support-detail-close-btn"
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
              <Stack spacing={1.5} data-testid="support-detail-thread">
                {(active.messages ?? []).map((message) => {
                  const mine = message.author_kind === "tenant";
                  return (
                    <Box
                      key={message.id}
                      sx={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        maxWidth: "82%",
                        p: 1.5,
                        borderRadius: 2.5,
                        bgcolor: mine
                          ? alpha(theme.palette.primary.main, 0.09)
                          : theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.primary.main, mine ? 0.18 : 0.08)}`,
                      }}
                      data-testid={`support-message-${message.id}`}
                    >
                      <Typography variant="caption" fontWeight={700} color={mine ? "primary.main" : "secondary.main"}>
                        {mine ? message.author_name || "You" : "KaySetu Support"}
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
            <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
              {active.status !== "closed" && (
                <>
                  <TextField
                    placeholder="Write a reply…"
                    size="small"
                    fullWidth
                    multiline
                    maxRows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    inputProps={{ "data-testid": "support-reply-input" }}
                    sx={{ flexGrow: 1, minWidth: 260 }}
                  />
                  <Button
                    variant="contained"
                    endIcon={<SendIcon />}
                    disabled={replying || !reply.trim()}
                    onClick={submitReply}
                    data-testid="support-reply-send-btn"
                  >
                    Send
                  </Button>
                  <Button color="inherit" onClick={closeTicket} data-testid="support-close-ticket-btn">
                    Close ticket
                  </Button>
                </>
              )}
              {active.status === "closed" && (
                <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
                  This ticket is closed — replying will reopen it with our team.
                </Typography>
              )}
              {active.status === "closed" && (
                <>
                  <TextField
                    placeholder="Reopen with a reply…"
                    size="small"
                    multiline
                    maxRows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    inputProps={{ "data-testid": "support-reopen-input" }}
                    sx={{ flexGrow: 1, minWidth: 220 }}
                  />
                  <Button
                    variant="outlined"
                    disabled={replying || !reply.trim()}
                    onClick={submitReply}
                    data-testid="support-reopen-send-btn"
                  >
                    Reopen
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4500}
        onClose={() => setToast(null)}
        message={toast}
        data-testid="support-toast"
      />
    </Box>
  );
}

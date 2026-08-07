"use client";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import InboxIcon from "@mui/icons-material/MoveToInbox";
import LinkIcon from "@mui/icons-material/Link";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import NotesIcon from "@mui/icons-material/StickyNote2";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PhoneIcon from "@mui/icons-material/Phone";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import SendIcon from "@mui/icons-material/Send";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Link as MuiLink,
  MenuItem,
  Snackbar,
  Stack,
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
import { useCallback, useEffect, useState } from "react";

import {
  CodeText,
  EmptyRow,
  HeadRow,
  PageHeader,
  SearchField,
  StatusChip,
  Surface,
  TableShell,
  TableSkeleton,
  TableToolbar,
  fmtAgo,
  fmtDateTime,
  type Column,
  type Tone,
} from "@/components/ui/kit";
import { api } from "@/lib/api";

interface LeadNote {
  id: number;
  author_name: string;
  body: string;
  created_at: string;
}

interface Lead {
  id: number;
  reference: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  attachment_url: string;
  source: string;
  status: string;
  utm_source: string;
  utm_campaign: string;
  page_url: string;
  referrer: string;
  ip_address: string | null;
  created_at: string;
  contacted_at: string | null;
  note_count: number | null;
  assigned_to: { id: number; full_name: string; email: string } | null;
  converted_tenant: { id: number; org_code: string; name: string } | null;
  notes?: LeadNote[];
}

interface AdminRow {
  id: number;
  full_name: string;
  email: string;
}

const STATUSES = ["new", "contacted", "qualified", "converted", "lost", "spam"] as const;

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
  spam: "Spam",
};

const STATUS_TONE: Record<string, Tone> = {
  new: "info",
  contacted: "warning",
  qualified: "gold",
  converted: "success",
  lost: "neutral",
  spam: "danger",
};

const SOURCE_LABEL: Record<string, string> = {
  contact_form: "Contact form",
  footer_demo: "Footer demo",
  instant_demo: "Instant demo",
  pricing: "Pricing",
  other: "Other",
};

const COLS: Column[] = [
  { key: "Ref", width: 120 },
  { key: "Contact" },
  { key: "Company" },
  { key: "Source", align: "center", width: 130 },
  { key: "Status", align: "center", width: 120 },
  { key: "Owner", width: 150 },
  { key: "Received", align: "right", width: 130 },
];

export default function OpsLeadsPage() {
  const theme = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Lead | null>(null);
  const [note, setNote] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("status", tab);
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString();
      const [list, counts] = await Promise.all([
        api<Lead[]>("ops", `/sa/leads${qs ? `?${qs}` : ""}`),
        api<Record<string, number>>("ops", "/sa/leads/summary"),
      ]);
      setLeads(list);
      setSummary(counts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load leads.");
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

  const open = async (lead: Lead) => {
    try {
      const full = await api<Lead>("ops", `/sa/leads/${lead.id}`);
      setActive(full);
      setNote("");
      setOrgCode(full.converted_tenant?.org_code ?? "");
    } catch {
      setToast("Could not open the lead.");
    }
  };

  const patch = async (body: Record<string, unknown>, msg: string) => {
    if (!active) return;
    setBusy(true);
    try {
      setActive(await api<Lead>("ops", `/sa/leads/${active.id}/update`, { method: "POST", body }));
      setToast(msg);
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!active || !note.trim()) return;
    setBusy(true);
    try {
      setActive(
        await api<Lead>("ops", `/sa/leads/${active.id}/note`, {
          method: "POST",
          body: { body: note.trim() },
        })
      );
      setNote("");
      setToast("Note added.");
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not add the note.");
    } finally {
      setBusy(false);
    }
  };

  const filtersActive = Boolean(search.trim()) || tab !== "all";

  return (
    <Box data-testid="ops-leads-container">
      <PageHeader
        title="Leads"
        subtitle="Demo requests and contact enquiries from kaysetu.in"
        icon={<TrendingUpIcon />}
        actions={
          <>
            {summary && (
              <StatusChip
                label={`${summary.needs_attention ?? 0} need follow-up`}
                tone={summary.needs_attention ? "warning" : "success"}
                testId="ops-leads-attention-chip"
              />
            )}
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  onClick={load}
                  disabled={loading}
                  aria-label="Refresh leads"
                  data-testid="ops-leads-refresh-btn"
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
        <Alert severity="error" sx={{ mb: 2 }} data-testid="ops-leads-error-alert" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableShell
        testId="ops-leads-table"
        minWidth={1000}
        toolbar={
          <Box sx={{ width: "100%" }}>
            <Box sx={{ px: 0.5, borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}` }}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                data-testid="ops-leads-tabs"
              >
                <Tab value="all" label={`All${summary ? ` (${summary.total ?? 0})` : ""}`} />
                {STATUSES.map((s) => (
                  <Tab
                    key={s}
                    value={s}
                    label={`${STATUS_LABEL[s]}${summary ? ` (${summary[s] ?? 0})` : ""}`}
                    data-testid={`ops-leads-tab-${s}`}
                  />
                ))}
              </Tabs>
            </Box>
            <TableToolbar>
              <SearchField
                value={search}
                onChange={setSearch}
                onSubmit={load}
                placeholder="Search name, email or company"
                width={300}
                testId="ops-leads-search-input"
              />
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {loading ? "Loading…" : `${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}
              </Typography>
            </TableToolbar>
          </Box>
        }
      >
        <HeadRow cols={COLS} />

        {loading ? (
          <TableSkeleton cols={COLS.length} />
        ) : leads.length === 0 ? (
          <EmptyRow
            cols={COLS.length}
            icon={filtersActive ? <SearchOffIcon /> : <InboxIcon />}
            message={filtersActive ? "No leads match this view" : "No leads yet"}
            hint={
              filtersActive
                ? "Try another search term or switch back to All."
                : "Enquiries submitted on kaysetu.in land here automatically."
            }
            testId="ops-leads-empty-text"
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
            {leads.map((lead) => (
              <TableRow
                key={lead.id}
                hover
                onClick={() => open(lead)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && open(lead)}
                data-testid={`ops-lead-row-${lead.id}`}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>
                  <CodeText>{lead.reference}</CodeText>
                </TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.25}>
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "7px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        bgcolor: alpha(theme.palette.info.main, 0.12),
                        color: "info.main",
                      }}
                    >
                      {(lead.name || "?").charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {lead.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                        {lead.email}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap color={lead.company ? "text.primary" : "text.disabled"}>
                    {lead.company || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip size="small" variant="outlined" label={SOURCE_LABEL[lead.source] ?? lead.source} />
                </TableCell>
                <TableCell align="center">
                  <StatusChip
                    label={STATUS_LABEL[lead.status] ?? lead.status}
                    tone={STATUS_TONE[lead.status] ?? "neutral"}
                  />
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    noWrap
                    color={lead.assigned_to ? "text.primary" : "text.disabled"}
                  >
                    {lead.assigned_to?.full_name ?? "Unassigned"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="caption" color="text.secondary">
                    {fmtAgo(lead.created_at)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </TableShell>

      {/* ── Lead detail ─────────────────────────────────────────── */}
      <Dialog
        open={active !== null}
        onClose={() => setActive(null)}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
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
                      {active.name}
                    </Typography>
                    <StatusChip
                      label={STATUS_LABEL[active.status] ?? active.status}
                      tone={STATUS_TONE[active.status] ?? "neutral"}
                    />
                    <Chip size="small" variant="outlined" label={SOURCE_LABEL[active.source] ?? active.source} />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap">
                    <CodeText>{active.reference}</CodeText>
                    <Typography variant="caption" color="text.secondary">
                      received {fmtDateTime(active.created_at)}
                      {active.ip_address ? ` · ${active.ip_address}` : ""}
                    </Typography>
                  </Stack>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setActive(null)}
                  aria-label="Close lead"
                  data-testid="ops-lead-close-btn"
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Stack>
            </Box>

            <DialogContent sx={{ bgcolor: "background.default", p: 2.5 }}>
              <Stack spacing={2}>
                {/* Contact + campaign */}
                <Surface>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <MailOutlineIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                        <MuiLink href={`mailto:${active.email}`} variant="body2">
                          {active.email}
                        </MuiLink>
                      </Stack>
                      {active.phone && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PhoneIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                          <MuiLink href={`tel:${active.phone}`} variant="body2">
                            {active.phone}
                          </MuiLink>
                        </Stack>
                      )}
                      {active.company && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <BusinessIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                          <Typography variant="body2">{active.company}</Typography>
                        </Stack>
                      )}
                    </Stack>

                    <Stack spacing={0.75}>
                      {(active.utm_source || active.utm_campaign) && (
                        <Typography variant="caption" color="text.secondary">
                          Campaign: {active.utm_source || "—"} / {active.utm_campaign || "—"}
                        </Typography>
                      )}
                      {active.page_url && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          Page: {active.page_url}
                        </Typography>
                      )}
                      {active.attachment_url && (
                        <MuiLink
                          href={active.attachment_url}
                          target="_blank"
                          rel="noopener"
                          variant="caption"
                          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                        >
                          Attachment <OpenInNewIcon sx={{ fontSize: 13 }} />
                        </MuiLink>
                      )}
                    </Stack>
                  </Box>

                  {active.message && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 1.5,
                        borderRadius: "10px",
                        bgcolor: alpha(theme.palette.primary.main, 0.035),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {active.message}
                      </Typography>
                    </Box>
                  )}
                </Surface>

                {/* Triage */}
                <Surface>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    flexWrap="wrap"
                    sx={{ rowGap: 1.5 }}
                  >
                    <TextField
                      select
                      size="small"
                      label="Status"
                      value={active.status}
                      sx={{ minWidth: 165 }}
                      onChange={(e) =>
                        patch({ status: e.target.value }, `Status → ${STATUS_LABEL[e.target.value]}`)
                      }
                      data-testid="ops-lead-status-select"
                    >
                      {STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Owner"
                      value={active.assigned_to?.id ?? 0}
                      sx={{ minWidth: 195 }}
                      onChange={(e) =>
                        patch(
                          { assigned_to_id: Number(e.target.value) || null },
                          Number(e.target.value) ? "Lead assigned." : "Lead unassigned."
                        )
                      }
                      data-testid="ops-lead-owner-select"
                    >
                      <MenuItem value={0}>Unassigned</MenuItem>
                      {admins.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.full_name || a.email}
                        </MenuItem>
                      ))}
                    </TextField>

                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <TextField
                        size="small"
                        label="Converted org code"
                        placeholder="KST-XXXXXX"
                        value={orgCode}
                        onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                        slotProps={{ htmlInput: { "data-testid": "ops-lead-orgcode-input" } }}
                        sx={{ width: 185 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={busy}
                        startIcon={<LinkIcon sx={{ fontSize: 15 }} />}
                        onClick={() => patch({ converted_org_code: orgCode }, "Lead linked to tenant.")}
                        data-testid="ops-lead-convert-btn"
                        sx={{ mt: 0.25, height: 37 }}
                      >
                        Link
                      </Button>
                    </Stack>
                  </Stack>
                </Surface>

                {/* Notes */}
                <Surface>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <NotesIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                    <Typography variant="subtitle2" fontWeight={700}>
                      Internal notes
                    </Typography>
                    <Chip
                      size="small"
                      label={(active.notes ?? []).length}
                      sx={{ height: 19, fontSize: "0.66rem" }}
                    />
                  </Stack>

                  <Stack spacing={1} data-testid="ops-lead-notes">
                    {(active.notes ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No notes yet — add the first below.
                      </Typography>
                    ) : (
                      (active.notes ?? []).map((n) => (
                        <Box
                          key={n.id}
                          data-testid={`ops-lead-note-${n.id}`}
                          sx={{
                            p: 1.25,
                            borderRadius: "10px",
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                            bgcolor: alpha(theme.palette.primary.main, 0.02),
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Avatar
                              sx={{
                                width: 20,
                                height: 20,
                                fontSize: "0.6rem",
                                fontWeight: 700,
                                bgcolor: alpha(theme.palette.secondary.main, 0.2),
                                color: "secondary.dark",
                              }}
                            >
                              {(n.author_name || "?").charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="caption" fontWeight={700}>
                              {n.author_name}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {fmtDateTime(n.created_at)}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                            {n.body}
                          </Typography>
                        </Box>
                      ))
                    )}
                  </Stack>

                  <Divider sx={{ my: 1.75 }} />

                  <Stack direction="row" spacing={1} alignItems="flex-end">
                    <TextField
                      placeholder="Add an internal note…"
                      size="small"
                      fullWidth
                      multiline
                      maxRows={4}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      slotProps={{ htmlInput: { "data-testid": "ops-lead-note-input" } }}
                    />
                    <Button
                      variant="contained"
                      disabled={busy || !note.trim()}
                      onClick={addNote}
                      endIcon={<SendIcon sx={{ fontSize: 15 }} />}
                      data-testid="ops-lead-note-btn"
                      sx={{ flexShrink: 0 }}
                    >
                      Add
                    </Button>
                  </Stack>
                </Surface>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        data-testid="ops-leads-toast"
      />
    </Box>
  );
}

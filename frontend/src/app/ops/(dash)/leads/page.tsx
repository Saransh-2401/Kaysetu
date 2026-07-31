"use client";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PhoneIcon from "@mui/icons-material/Phone";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, Link as MuiLink, MenuItem, Paper, Snackbar, Stack,
  Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip,
  Typography, alpha,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

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

interface AdminRow { id: number; full_name: string; email: string }

const STATUSES = ["new", "contacted", "qualified", "converted", "lost", "spam"] as const;

const STATUS_LABEL: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  converted: "Converted", lost: "Lost", spam: "Spam",
};

const STATUS_COLOR: Record<string, "info" | "warning" | "secondary" | "success" | "default" | "error"> = {
  new: "info", contacted: "warning", qualified: "secondary",
  converted: "success", lost: "default", spam: "error",
};

const SOURCE_LABEL: Record<string, string> = {
  contact_form: "Contact form", footer_demo: "Footer demo",
  instant_demo: "Instant demo", pricing: "Pricing", other: "Other",
};

const dateIN = (v: string | null) =>
  v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function OpsLeadsPage() {
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

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api<AdminRow[]>("ops", "/sa/support/admins").then(setAdmins).catch(() => setAdmins([]));
  }, []);

  const open = async (lead: Lead) => {
    try {
      const full = await api<Lead>("ops", `/sa/leads/${lead.id}`);
      setActive(full);
      setNote("");
      setOrgCode(full.converted_tenant?.org_code ?? "");
    } catch { setToast("Could not open the lead."); }
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
    } finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!active || !note.trim()) return;
    setBusy(true);
    try {
      setActive(await api<Lead>("ops", `/sa/leads/${active.id}/note`, {
        method: "POST", body: { body: note.trim() },
      }));
      setNote("");
      setToast("Note added.");
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not add the note.");
    } finally { setBusy(false); }
  };

  return (
    <Box data-testid="ops-leads-container">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <TrendingUpIcon color="primary" />
        <Typography variant="h5" fontWeight={800}>Leads</Typography>
        {summary && (
          <Chip size="small" color={summary.needs_attention ? "warning" : "success"}
            label={`${summary.needs_attention ?? 0} need follow-up`}
            data-testid="ops-leads-attention-chip" />
        )}
        <Box sx={{ flexGrow: 1 }} />
        <TextField size="small" placeholder="Search name / email / company"
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          inputProps={{ "data-testid": "ops-leads-search-input" }} sx={{ width: 280 }} />
        <Tooltip title="Refresh">
          <IconButton onClick={load} data-testid="ops-leads-refresh-btn"><RefreshIcon /></IconButton>
        </Tooltip>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Demo requests and contact enquiries from kaysetu.in.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="ops-leads-error-alert">{error}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ px: 1 }}
          data-testid="ops-leads-tabs">
          <Tab value="all" label={`All${summary ? ` (${summary.total ?? 0})` : ""}`} />
          {STATUSES.map((s) => (
            <Tab key={s} value={s} label={`${STATUS_LABEL[s]}${summary ? ` (${summary[s] ?? 0})` : ""}`}
              data-testid={`ops-leads-tab-${s}`} />
          ))}
        </Tabs>

        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress data-testid="ops-leads-loading-spinner" />
          </Box>
        ) : (
          <Table size="small" data-testid="ops-leads-table">
            <TableHead>
              <TableRow>
                <TableCell>Ref</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Received</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} hover onClick={() => open(lead)} sx={{ cursor: "pointer" }}
                  data-testid={`ops-lead-row-${lead.id}`}>
                  <TableCell sx={{ fontFamily: "monospace" }}>{lead.reference}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{lead.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{lead.email}</Typography>
                  </TableCell>
                  <TableCell>{lead.company || "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={SOURCE_LABEL[lead.source] ?? lead.source} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={STATUS_LABEL[lead.status] ?? lead.status}
                      color={STATUS_COLOR[lead.status] ?? "default"} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={lead.assigned_to ? "text.primary" : "text.disabled"}>
                      {lead.assigned_to?.full_name ?? "Unassigned"}
                    </Typography>
                  </TableCell>
                  <TableCell><Typography variant="caption">{dateIN(lead.created_at)}</Typography></TableCell>
                </TableRow>
              ))}
              {leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}
                      data-testid="ops-leads-empty-text">
                      No leads here yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Detail */}
      <Dialog open={active !== null} onClose={() => setActive(null)} maxWidth="md" fullWidth>
        {active && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography component="span" fontFamily="monospace" color="text.secondary">
                  {active.reference}
                </Typography>
                <Typography component="span" fontWeight={800}>{active.name}</Typography>
                <Chip size="small" label={STATUS_LABEL[active.status]} color={STATUS_COLOR[active.status]} />
                <Chip size="small" variant="outlined" label={SOURCE_LABEL[active.source] ?? active.source} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Received {dateIN(active.created_at)}
                {active.ip_address ? ` · ${active.ip_address}` : ""}
              </Typography>
              <IconButton onClick={() => setActive(null)} sx={{ position: "absolute", right: 8, top: 8 }}
                data-testid="ops-lead-close-btn"><CloseIcon /></IconButton>
            </DialogTitle>

            <DialogContent dividers>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ mb: 2 }}>
                <Stack spacing={0.75} sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MailOutlineIcon fontSize="small" color="action" />
                    <MuiLink href={`mailto:${active.email}`}>{active.email}</MuiLink>
                  </Stack>
                  {active.phone && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PhoneIcon fontSize="small" color="action" />
                      <MuiLink href={`tel:${active.phone}`}>{active.phone}</MuiLink>
                    </Stack>
                  )}
                  {active.company && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <BusinessIcon fontSize="small" color="action" />
                      <Typography variant="body2">{active.company}</Typography>
                    </Stack>
                  )}
                </Stack>
                <Stack spacing={0.5} sx={{ flex: 1 }}>
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
                    <MuiLink href={active.attachment_url} target="_blank" rel="noopener"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      Attachment <OpenInNewIcon sx={{ fontSize: 14 }} />
                    </MuiLink>
                  )}
                </Stack>
              </Stack>

              {active.message && (
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.03) }}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{active.message}</Typography>
                </Paper>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                <TextField select size="small" label="Status" value={active.status} sx={{ minWidth: 170 }}
                  onChange={(e) => patch({ status: e.target.value }, `Status → ${STATUS_LABEL[e.target.value]}`)}
                  data-testid="ops-lead-status-select">
                  {STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Owner" value={active.assigned_to?.id ?? 0} sx={{ minWidth: 200 }}
                  onChange={(e) => patch(
                    { assigned_to_id: Number(e.target.value) || null },
                    Number(e.target.value) ? "Lead assigned." : "Lead unassigned."
                  )}
                  data-testid="ops-lead-owner-select">
                  <MenuItem value={0}>Unassigned</MenuItem>
                  {admins.map((a) => <MenuItem key={a.id} value={a.id}>{a.full_name || a.email}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField size="small" label="Converted org code" placeholder="KST-XXXXXX"
                    value={orgCode} onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                    inputProps={{ "data-testid": "ops-lead-orgcode-input" }} sx={{ width: 190 }} />
                  <Button size="small" variant="outlined" disabled={busy}
                    onClick={() => patch({ converted_org_code: orgCode }, "Lead linked to tenant.")}
                    data-testid="ops-lead-convert-btn">Link</Button>
                </Stack>
              </Stack>

              <Divider sx={{ mb: 1.5 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Internal notes</Typography>
              <Stack spacing={1} data-testid="ops-lead-notes">
                {(active.notes ?? []).map((n) => (
                  <Paper key={n.id} variant="outlined" sx={{ p: 1.25 }} data-testid={`ops-lead-note-${n.id}`}>
                    <Typography variant="caption" fontWeight={700}>
                      {n.author_name}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {dateIN(n.created_at)}
                      </Typography>
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{n.body}</Typography>
                  </Paper>
                ))}
                {(active.notes ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">No notes yet.</Typography>
                )}
              </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
              <TextField placeholder="Add an internal note…" size="small" fullWidth multiline maxRows={3}
                value={note} onChange={(e) => setNote(e.target.value)}
                inputProps={{ "data-testid": "ops-lead-note-input" }} />
              <Button variant="contained" disabled={busy || !note.trim()} onClick={addNote}
                data-testid="ops-lead-note-btn">Add note</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={3500} onClose={() => setToast(null)}
        message={toast} data-testid="ops-leads-toast" />
    </Box>
  );
}

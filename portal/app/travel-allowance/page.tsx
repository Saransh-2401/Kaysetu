"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Stack, Snackbar, Alert, TablePagination, Tabs, Tab,
  IconButton, MenuItem, CircularProgress, Divider, Tooltip, InputAdornment,
  FormControlLabel, Checkbox,
} from "@mui/material";
import { VisibilityIcon, FlagIcon, CloseIcon, AddIcon, DeleteIcon, DownloadIcon, PrintIcon, UploadFileIcon } from "@/components/icons";
import XLSXStyle from "xlsx-js-style";

import { authService } from "@/lib/auth-service";
import {
  travelAllowanceService as svc,
  AllowanceRequest,
  PolicyConfig,
  TAAnalytics,
  allowanceStatusColor,
} from "@/lib/travel-allowance-service";

type Severity = "success" | "error" | "warning" | "info";

const money = (v?: string | number | null) =>
  v === null || v === undefined || v === "" ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fdate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fdatetime = (v?: string | null) => (v ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

const STATUS_FILTERS = [
  "all", "submitted", "manager_approved", "finance_approved", "paid",
  "manager_rejected", "finance_rejected",
];

export default function TravelAllowancePage() {
  const [role, setRole] = useState<string>("");
  const [tab, setTab] = useState(0);
  const [requests, setRequests] = useState<AllowanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: Severity }>({ open: false, message: "", severity: "success" });

  // Detail + action dialogs
  const [detail, setDetail] = useState<AllowanceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<null | "manager_reject" | "finance_approve" | "finance_reject" | "payment">(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [pay, setPay] = useState({ amount: "", payment_mode: "upi", transaction_id: "", reference: "", proof_url: "" });
  const [docType, setDocType] = useState("other");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const isAdmin = role === "admin" || role === "mdo";
  const isManager = role === "sales_manager";
  const isFinance = role === "accounts_officer";

  const notify = (message: string, severity: Severity = "success") => setSnack({ open: true, message, severity });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await svc.listRequests();
      setRequests(data);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to load requests", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const u = await authService.getCurrentUser();
        setRole(u.role || "");
      } catch {
        /* ignore */
      }
      fetchRequests();
    })();
  }, [fetchRequests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.request_status !== statusFilter) return false;
      if (flaggedOnly && !r.is_flagged) return false;
      if (!q) return true;
      return (
        r.request_no.toLowerCase().includes(q) ||
        (r.agent_name || "").toLowerCase().includes(q)
      );
    });
  }, [requests, search, statusFilter, flaggedOnly]);

  const metrics = useMemo(() => {
    let claimed = 0, approved = 0, paid = 0, pending = 0;
    for (const r of requests) {
      claimed += Number(r.claimed_amount || 0);
      if (r.approved_amount) approved += Number(r.approved_amount);
      if (r.request_status === "paid") paid += Number(r.payment?.amount || r.approved_amount || r.claimed_amount || 0);
      if (["submitted", "manager_review", "manager_approved", "finance_review", "finance_approved", "processing_payment"].includes(r.request_status))
        pending += Number(r.approved_amount || r.claimed_amount || 0);
    }
    return { claimed, approved, paid, pending };
  }, [requests]);

  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // ── Action gating ──────────────────────────────────────────────────────────
  const canManagerAct = (r: AllowanceRequest) => (isAdmin || isManager) && ["submitted", "manager_review"].includes(r.request_status);
  const canFinanceAct = (r: AllowanceRequest) => (isAdmin || isFinance) && ["manager_approved", "finance_review"].includes(r.request_status);
  const canPay = (r: AllowanceRequest) => (isAdmin || isFinance) && r.request_status === "finance_approved";

  const refreshDetail = async (id: number) => {
    const fresh = await svc.getRequest(id);
    setDetail(fresh);
    setRequests((prev) => prev.map((r) => (r.id === id ? fresh : r)));
  };

  const closeAction = () => {
    setAction(null);
    setReason("");
    setComment("");
    setApprovedAmount("");
    setPay({ amount: "", payment_mode: "upi", transaction_id: "", reference: "", proof_url: "" });
  };

  const runManagerApprove = async (r: AllowanceRequest) => {
    setBusy(true);
    try {
      await svc.managerApprove(r.id);
      await refreshDetail(r.id);
      notify(`${r.request_no} approved and sent to finance.`);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const submitAction = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      if (action === "manager_reject") {
        if (!reason.trim()) { notify("A rejection reason is required.", "warning"); setBusy(false); return; }
        await svc.managerReject(detail.id, reason.trim());
        notify(`${detail.request_no} rejected.`, "warning");
      } else if (action === "finance_approve") {
        await svc.financeApprove(detail.id, approvedAmount.trim() || undefined, comment.trim());
        notify(`${detail.request_no} verified by finance.`);
      } else if (action === "finance_reject") {
        if (!reason.trim()) { notify("A rejection reason is required.", "warning"); setBusy(false); return; }
        await svc.financeReject(detail.id, reason.trim());
        notify(`${detail.request_no} rejected by finance.`, "warning");
      } else if (action === "payment") {
        await svc.recordPayment(detail.id, {
          amount: pay.amount.trim() || undefined,
          payment_mode: pay.payment_mode,
          transaction_id: pay.transaction_id.trim(),
          reference: pay.reference.trim(),
          proof_url: pay.proof_url.trim(),
        });
        notify(`Payment recorded for ${detail.request_no}.`);
      }
      await refreshDetail(detail.id);
      closeAction();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadDoc = async (file: File) => {
    if (!detail) return;
    setUploadingDoc(true);
    try {
      await svc.uploadDocument(detail.id, file, docType);
      await refreshDetail(detail.id);
      notify("Document uploaded.");
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploadingDoc(false);
    }
  };

  const exportToExcel = () => {
    const rows = filtered.map((r) => ({
      "Request #": r.request_no,
      Agent: r.agent_name || "",
      Type: r.request_type_display || r.request_type,
      "Period Start": r.period_start,
      "Period End": r.period_end,
      "Distance (km)": Number(r.total_distance_km),
      Claimed: Number(r.claimed_amount),
      Approved: r.approved_amount ? Number(r.approved_amount) : "",
      Status: r.request_status_display || r.request_status,
      Flagged: r.is_flagged ? "Yes" : "No",
    }));
    const ws = XLSXStyle.utils.json_to_sheet(rows);
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "Travel Allowance");
    XLSXStyle.writeFile(wb, `travel-allowance-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const printReceipt = (r: AllowanceRequest) => {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const tripRows = (r.trips || [])
      .map(
        (rt) =>
          `<tr><td>${fdate(rt.trip.date)}</td><td>${rt.trip.customer_name || "—"}</td><td style="text-align:right">${Number(rt.trip.distance_km).toFixed(1)} km</td></tr>`
      )
      .join("");
    w.document.write(
      `<html><head><title>${r.request_no}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border-bottom:1px solid #ddd;padding:6px;font-size:13px;text-align:left}.meta div{margin:2px 0;font-size:13px}</style></head><body>` +
        `<h1>Travel Allowance — ${r.request_no}</h1><div class="meta">` +
        `<div><b>Agent:</b> ${r.agent_name || ""}</div>` +
        `<div><b>Period:</b> ${fdate(r.period_start)} – ${fdate(r.period_end)}</div>` +
        `<div><b>Status:</b> ${r.request_status_display || r.request_status}</div>` +
        `<div><b>Distance:</b> ${Number(r.total_distance_km).toFixed(1)} km</div>` +
        `<div><b>Claimed:</b> ${money(r.claimed_amount)}</div>` +
        `<div><b>Approved:</b> ${money(r.approved_amount)}</div>` +
        (r.payment
          ? `<div><b>Paid:</b> ${money(r.payment.amount)} via ${r.payment.payment_mode || "manual"} ${r.payment.transaction_id ? "· Txn " + r.payment.transaction_id : ""}</div>`
          : "") +
        `</div><table><thead><tr><th>Date</th><th>Client</th><th style="text-align:right">Distance</th></tr></thead><tbody>${tripRows}</tbody></table>` +
        `<p style="margin-top:24px;font-size:11px;color:#888">Generated ${new Date().toLocaleString("en-IN")}</p>` +
        `</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }} data-testid="travel-allowance-page">
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Travel Allowance</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Review, verify and reimburse field-travel claims.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} data-testid="travel-allowance-tabs">
        <Tab label="Requests" data-testid="ta-tab-requests" />
        <Tab label="Analytics" data-testid="ta-tab-analytics" />
        {isAdmin && <Tab label="Policies" data-testid="ta-tab-policies" />}
      </Tabs>

      {tab === 0 && (
        <>
          {/* Summary metrics */}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }} data-testid="ta-summary">
            {[
              { label: "Total Claimed", value: metrics.claimed, key: "claimed" },
              { label: "Total Approved", value: metrics.approved, key: "approved" },
              { label: "Total Paid", value: metrics.paid, key: "paid" },
              { label: "Pending", value: metrics.pending, key: "pending" },
            ].map((m) => (
              <Paper key={m.key} sx={{ p: 2, flex: "1 1 180px", borderRadius: 2 }} data-testid={`ta-metric-${m.key}`}>
                <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{money(m.value)}</Typography>
              </Paper>
            ))}
          </Box>

          {/* Filters */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              size="small" placeholder="Search by request # or agent" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: 1 }} data-testid="ta-search-input"
            />
            <TextField
              select size="small" label="Status" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              sx={{ minWidth: 200 }} data-testid="ta-status-filter"
            >
              {STATUS_FILTERS.map((s) => (
                <MenuItem key={s} value={s} data-testid={`ta-status-option-${s}`}>
                  {s === "all" ? "All Statuses" : s.replace(/_/g, " ")}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={<Checkbox checked={flaggedOnly} onChange={(e) => { setFlaggedOnly(e.target.checked); setPage(0); }} data-testid="ta-flagged-filter" />}
              label="Flagged only"
            />
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportToExcel} disabled={!filtered.length} data-testid="ta-export-btn">
              Export
            </Button>
          </Stack>

          <TableContainer component={Paper} sx={{ borderRadius: 2 }} data-testid="ta-requests-table">
            <Table>
              <TableHead sx={{ bgcolor: "#F8F9FA" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Request #</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Agent</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Period</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Distance</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Claimed</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
                ) : paged.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }} data-testid="ta-empty">No requests found.</TableCell></TableRow>
                ) : (
                  paged.map((r) => (
                    <TableRow key={r.id} hover data-testid={`ta-row-${r.id}`}>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {r.is_flagged && (
                          <Tooltip title={r.flag_reason || "Flagged"}>
                            <FlagIcon color="error" sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} data-testid={`ta-flag-${r.id}`} />
                          </Tooltip>
                        )}
                        {r.request_no}
                      </TableCell>
                      <TableCell>{r.agent_name}</TableCell>
                      <TableCell>{fdate(r.period_start)} – {fdate(r.period_end)}</TableCell>
                      <TableCell align="right">{Number(r.total_distance_km).toFixed(1)} km</TableCell>
                      <TableCell align="right">{money(r.claimed_amount)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small" label={r.request_status_display || r.request_status}
                          color={allowanceStatusColor(r.request_status)}
                          sx={{ fontWeight: 700, fontSize: "0.68rem" }}
                          data-testid={`ta-status-${r.id}`}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => setDetail(r)} data-testid={`ta-view-${r.id}`}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div" count={filtered.length} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]}
              data-testid="ta-pagination"
            />
          </TableContainer>
        </>
      )}

      {tab === 1 && <AnalyticsTab />}

      {tab === 2 && isAdmin && <PoliciesTab notify={notify} />}

      {/* Detail dialog */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth data-testid="ta-detail-dialog">
        {detail && (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography component="span" sx={{ fontWeight: 800 }}>{detail.request_no}</Typography>{" "}
                <Chip size="small" label={detail.request_status_display || detail.request_status} color={allowanceStatusColor(detail.request_status)} sx={{ ml: 1, fontWeight: 700 }} />
              </Box>
              <IconButton onClick={() => setDetail(null)} data-testid="ta-detail-close"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {detail.is_flagged && (
                <Alert severity="warning" sx={{ mb: 2 }} data-testid="ta-detail-flag">{detail.flag_reason || "This request was flagged."}</Alert>
              )}

              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                {[
                  ["Agent", detail.agent_name],
                  ["Type", detail.request_type_display || detail.request_type],
                  ["Period", `${fdate(detail.period_start)} – ${fdate(detail.period_end)}`],
                  ["Distance", `${Number(detail.total_distance_km).toFixed(1)} km`],
                  ["Transport", detail.transport_mode || "—"],
                  ["System amount", money(detail.system_amount)],
                  ["Claimed", money(detail.claimed_amount)],
                  ["Approved", money(detail.approved_amount)],
                ].map(([k, v]) => (
                  <Box key={k as string} sx={{ minWidth: 150 }}>
                    <Typography variant="caption" color="text.secondary">{k}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{v as string}</Typography>
                  </Box>
                ))}
              </Box>
              {detail.notes && <Typography variant="body2" sx={{ mb: 2 }}><b>Notes:</b> {detail.notes}</Typography>}

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Trips ({detail.trips?.length || 0})</Typography>
              <Table size="small" data-testid="ta-detail-trips">
                <TableHead><TableRow>
                  <TableCell>Date</TableCell><TableCell>Client / Lead</TableCell>
                  <TableCell align="right">Distance</TableCell><TableCell>Mode</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {(detail.trips || []).map((rt) => (
                    <TableRow key={rt.id}>
                      <TableCell>{fdate(rt.trip.date)}</TableCell>
                      <TableCell>{rt.trip.customer_name || "—"}</TableCell>
                      <TableCell align="right">{Number(rt.trip.distance_km).toFixed(1)} km</TableCell>
                      <TableCell>{rt.trip.transport_mode}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 2, mb: 1 }}>Documents</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" useFlexGap>
                {(detail.documents || []).map((d) => (
                  <Button key={d.id} size="small" variant="outlined" href={d.file_url} target="_blank" data-testid={`ta-doc-${d.id}`}>
                    {d.doc_type_display || d.doc_type}
                  </Button>
                ))}
                {!detail.documents?.length && (
                  <Typography variant="caption" color="text.secondary">No documents attached.</Typography>
                )}
                {isAdmin && (detail.documents?.length || 0) < 20 && (
                  <>
                    <TextField select size="small" value={docType} onChange={(e) => setDocType(e.target.value)} sx={{ minWidth: 130 }} data-testid="ta-doc-type-select">
                      {["ticket", "invoice", "special", "other"].map((t) => (
                        <MenuItem key={t} value={t} data-testid={`ta-doc-type-${t}`}>{t}</MenuItem>
                      ))}
                    </TextField>
                    <Button variant="outlined" size="small" component="label" disabled={uploadingDoc} startIcon={<UploadFileIcon />} data-testid="ta-doc-upload-btn">
                      {uploadingDoc ? "Uploading…" : "Add"}
                      <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadDoc(f); e.currentTarget.value = ""; }} />
                    </Button>
                  </>
                )}
              </Stack>

              {detail.payment && (
                <Alert severity="success" sx={{ mt: 2 }} data-testid="ta-detail-payment">
                  Paid {money(detail.payment.amount)} via {detail.payment.payment_mode || "manual"}
                  {detail.payment.transaction_id ? ` · Txn ${detail.payment.transaction_id}` : ""}
                  {detail.payment.processed_at ? ` · ${fdatetime(detail.payment.processed_at)}` : ""}
                </Alert>
              )}

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Activity</Typography>
              <Stack spacing={0.75} data-testid="ta-detail-timeline">
                {(detail.status_history || []).map((h, i) => (
                  <Box key={i} sx={{ display: "flex", gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>{fdatetime(h.timestamp)}</Typography>
                    <Typography variant="body2"><b>{h.status}</b> by {h.user}{h.notes ? ` — ${h.notes}` : ""}</Typography>
                  </Box>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 3, py: 2 }}>
              <Button startIcon={<PrintIcon />} onClick={() => printReceipt(detail)} sx={{ mr: "auto" }} data-testid="ta-print-receipt">
                Print receipt
              </Button>
              {canManagerAct(detail) && (
                <>
                  <Button color="error" variant="outlined" disabled={busy} onClick={() => { setAction("manager_reject"); }} data-testid="ta-act-manager-reject">Reject</Button>
                  <Button color="success" variant="contained" disabled={busy} onClick={() => runManagerApprove(detail)} data-testid="ta-act-manager-approve">Approve</Button>
                </>
              )}
              {canFinanceAct(detail) && (
                <>
                  <Button color="error" variant="outlined" disabled={busy} onClick={() => setAction("finance_reject")} data-testid="ta-act-finance-reject">Reject</Button>
                  <Button color="success" variant="contained" disabled={busy} onClick={() => { setApprovedAmount(detail.claimed_amount); setAction("finance_approve"); }} data-testid="ta-act-finance-approve">Verify & Approve</Button>
                </>
              )}
              {canPay(detail) && (
                <Button color="primary" variant="contained" disabled={busy} onClick={() => { setPay((p) => ({ ...p, amount: detail.payable_amount || detail.approved_amount || "" })); setAction("payment"); }} data-testid="ta-act-record-payment">Record Payment</Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Reject dialogs (manager / finance) */}
      <Dialog open={action === "manager_reject" || action === "finance_reject"} onClose={closeAction} maxWidth="xs" fullWidth data-testid="ta-reject-dialog">
        <DialogTitle sx={{ fontWeight: 800, color: "error.main" }}>Reject Request</DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary">A reason is required and recorded in the activity log.</Typography>
          <TextField autoFocus fullWidth multiline rows={3} label="Rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} inputProps={{ maxLength: 500 }} data-testid="ta-reject-reason-input" />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAction} color="inherit" data-testid="ta-reject-cancel">Cancel</Button>
          <Button onClick={submitAction} variant="contained" color="error" disabled={busy} data-testid="ta-reject-confirm">Reject</Button>
        </DialogActions>
      </Dialog>

      {/* Finance approve dialog */}
      <Dialog open={action === "finance_approve"} onClose={closeAction} maxWidth="xs" fullWidth data-testid="ta-finance-approve-dialog">
        <DialogTitle sx={{ fontWeight: 800 }}>Verify & Approve</DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary">Adjust the amount for a partial approval, or leave as claimed.</Typography>
          <TextField fullWidth type="number" label="Approved amount" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} sx={{ mt: 1.5 }} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} data-testid="ta-finance-amount-input" />
          <TextField fullWidth multiline rows={2} label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} sx={{ mt: 1.5 }} data-testid="ta-finance-comment-input" />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAction} color="inherit" data-testid="ta-finance-cancel">Cancel</Button>
          <Button onClick={submitAction} variant="contained" color="success" disabled={busy} data-testid="ta-finance-confirm">Approve</Button>
        </DialogActions>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={action === "payment"} onClose={closeAction} maxWidth="xs" fullWidth data-testid="ta-payment-dialog">
        <DialogTitle sx={{ fontWeight: 800 }}>Record Payment</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField fullWidth type="number" label="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} data-testid="ta-pay-amount-input" />
            <TextField select fullWidth label="Mode" value={pay.payment_mode} onChange={(e) => setPay({ ...pay, payment_mode: e.target.value })} data-testid="ta-pay-mode-select">
              {["upi", "bank", "cash", "other"].map((m) => <MenuItem key={m} value={m} data-testid={`ta-pay-mode-${m}`}>{m.toUpperCase()}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="Transaction ID" value={pay.transaction_id} onChange={(e) => setPay({ ...pay, transaction_id: e.target.value })} data-testid="ta-pay-txn-input" />
            <TextField fullWidth label="Reference / note" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} data-testid="ta-pay-ref-input" />
            <TextField fullWidth label="Proof URL (screenshot)" value={pay.proof_url} onChange={(e) => setPay({ ...pay, proof_url: e.target.value })} data-testid="ta-pay-proof-input" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAction} color="inherit" data-testid="ta-pay-cancel">Cancel</Button>
          <Button onClick={submitAction} variant="contained" disabled={busy} data-testid="ta-pay-confirm">Mark Paid</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} data-testid="ta-snackbar">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

// ── Policies tab (admin only) ────────────────────────────────────────────────
function PoliciesTab({ notify }: { notify: (m: string, s?: Severity) => void }) {
  const [policies, setPolicies] = useState<PolicyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<PolicyConfig> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPolicies(await svc.listPolicies()); }
    catch (e: unknown) { notify(e instanceof Error ? e.message : "Failed to load policies", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      if (edit.id) await svc.updatePolicy(edit.id, edit);
      else await svc.createPolicy(edit);
      notify("Policy saved.");
      setEdit(null);
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Save failed", "error");
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    setBusy(true);
    try { await svc.deletePolicy(id); notify("Policy removed."); load(); }
    catch (e: unknown) { notify(e instanceof Error ? e.message : "Delete failed", "error"); }
    finally { setBusy(false); }
  };

  return (
    <Box data-testid="ta-policies-tab">
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Per-km rates and caps. A blank city is the company-wide default.</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setEdit({ city: "", vehicle_type: "bike", rate_per_km: "0", max_daily_limit: "0", max_monthly_limit: "0", is_active: true })} data-testid="ta-policy-add">Add Policy</Button>
      </Stack>
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: "#F8F9FA" }}><TableRow>
            <TableCell sx={{ fontWeight: 800 }}>City</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Vehicle</TableCell>
            <TableCell sx={{ fontWeight: 800 }} align="right">Rate/km</TableCell>
            <TableCell sx={{ fontWeight: 800 }} align="right">Daily cap</TableCell>
            <TableCell sx={{ fontWeight: 800 }} align="right">Monthly cap</TableCell>
            <TableCell sx={{ fontWeight: 800 }} align="center">Active</TableCell>
            <TableCell sx={{ fontWeight: 800 }} align="center">Edit</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
            ) : policies.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>No policies yet.</TableCell></TableRow>
            ) : policies.map((p) => (
              <TableRow key={p.id} hover data-testid={`ta-policy-row-${p.id}`}>
                <TableCell>{p.city || "All cities"}</TableCell>
                <TableCell>{p.vehicle_type_display || p.vehicle_type}</TableCell>
                <TableCell align="right">{money(p.rate_per_km)}</TableCell>
                <TableCell align="right">{Number(p.max_daily_limit) > 0 ? money(p.max_daily_limit) : "—"}</TableCell>
                <TableCell align="right">{Number(p.max_monthly_limit) > 0 ? money(p.max_monthly_limit) : "—"}</TableCell>
                <TableCell align="center"><Chip size="small" label={p.is_active ? "Yes" : "No"} color={p.is_active ? "success" : "default"} /></TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => setEdit(p)} data-testid={`ta-policy-edit-${p.id}`}><VisibilityIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => remove(p.id)} data-testid={`ta-policy-delete-${p.id}`}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="xs" fullWidth data-testid="ta-policy-dialog">
        <DialogTitle sx={{ fontWeight: 800 }}>{edit?.id ? "Edit Policy" : "Add Policy"}</DialogTitle>
        <DialogContent dividers>
          {edit && (
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <TextField fullWidth label="City (blank = all)" value={edit.city || ""} onChange={(e) => setEdit({ ...edit, city: e.target.value })} data-testid="ta-policy-city-input" />
              <TextField select fullWidth label="Vehicle type" value={edit.vehicle_type || "bike"} onChange={(e) => setEdit({ ...edit, vehicle_type: e.target.value })} data-testid="ta-policy-vehicle-select">
                {["bike", "car", "walk", "public"].map((v) => <MenuItem key={v} value={v} data-testid={`ta-policy-vehicle-${v}`}>{v}</MenuItem>)}
              </TextField>
              <TextField fullWidth type="number" label="Rate per km" value={edit.rate_per_km ?? "0"} onChange={(e) => setEdit({ ...edit, rate_per_km: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} data-testid="ta-policy-rate-input" />
              <TextField fullWidth type="number" label="Max daily limit (0 = none)" value={edit.max_daily_limit ?? "0"} onChange={(e) => setEdit({ ...edit, max_daily_limit: e.target.value })} data-testid="ta-policy-daily-input" />
              <TextField fullWidth type="number" label="Max monthly limit (0 = none)" value={edit.max_monthly_limit ?? "0"} onChange={(e) => setEdit({ ...edit, max_monthly_limit: e.target.value })} data-testid="ta-policy-monthly-input" />
              <TextField select fullWidth label="Active" value={edit.is_active ? "yes" : "no"} onChange={(e) => setEdit({ ...edit, is_active: e.target.value === "yes" })} data-testid="ta-policy-active-select">
                <MenuItem value="yes">Active</MenuItem>
                <MenuItem value="no">Inactive</MenuItem>
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)} color="inherit" data-testid="ta-policy-cancel">Cancel</Button>
          <Button onClick={save} variant="contained" disabled={busy} data-testid="ta-policy-save">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Analytics tab ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [data, setData] = useState<TAAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await svc.getAnalytics());
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Box sx={{ textAlign: "center", py: 6 }}><CircularProgress /></Box>;
  if (!data) return <Typography color="text.secondary">No analytics available.</Typography>;

  const m = (v: number) => `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const s = data.summary;

  return (
    <Box data-testid="ta-analytics-tab">
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        {([
          ["Total Claimed", m(s.total_claimed)],
          ["Total Approved", m(s.total_approved)],
          ["Total Paid", m(s.total_paid)],
          ["Pending", m(s.pending_amount)],
          ["Requests", String(s.total_requests)],
        ] as [string, string][]).map(([l, v]) => (
          <Paper key={l} sx={{ p: 2, flex: "1 1 160px", borderRadius: 2 }} data-testid={`ta-analytics-${l.replace(/\s+/g, "-").toLowerCase()}`}>
            <Typography variant="caption" color="text.secondary">{l}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{v}</Typography>
          </Paper>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Paper sx={{ p: 2, flex: "1 1 240px", borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Performance</Typography>
          <Typography variant="body2">Approval rate: <b>{data.approval_rate != null ? `${data.approval_rate}%` : "—"}</b></Typography>
          <Typography variant="body2">Avg processing: <b>{data.avg_processing_days != null ? `${data.avg_processing_days} days` : "—"}</b></Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: "1 1 240px", borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Payments</Typography>
          <Typography variant="body2">This month: <b>{m(data.payment_rollups.this_month)}</b></Typography>
          <Typography variant="body2">This quarter: <b>{m(data.payment_rollups.this_quarter)}</b></Typography>
          <Typography variant="body2">This year: <b>{m(data.payment_rollups.this_year)}</b></Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: "1 1 240px", borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Transport mix</Typography>
          {data.transport_breakdown.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No data</Typography>
          ) : (
            data.transport_breakdown.map((t) => (
              <Typography key={t.transport_mode} variant="body2">{t.transport_mode || "—"}: <b>{t.count}</b></Typography>
            ))
          )}
        </Paper>
      </Box>
    </Box>
  );
}

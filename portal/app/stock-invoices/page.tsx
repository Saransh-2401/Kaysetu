"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip, Chip, CircularProgress,
  Stack, useTheme, alpha, TextField, Grid, InputAdornment, FormControl,
  InputLabel, Select, MenuItem, TablePagination, TableSortLabel,
  Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from "@mui/material";
import { motion } from "framer-motion";

import { SearchIcon, FileDownloadIcon, FilterAltOffIcon, ReceiptLongIcon, EditOutlinedIcon, PaymentsIcon } from "@/components/icons";

import { accountsApi, StockRequestInvoiceResult, mapStatus } from "@/lib/accounts-api";
import { distributorService, StockRequest } from "@/lib/distributor-service";
import { authService } from "@/lib/auth-service";
import { API_BASE_URL, tokenManager } from "@/lib/api-client";
import InvoiceModal from "@/components/distributor/InvoiceModal";

type SortField = "invoice_number" | "invoice_date" | "due_date" | "total_amount";

export default function StockInvoicesPage() {
  const theme = useTheme();

  const [invoices, setInvoices] = useState<StockRequestInvoiceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [userRole, setUserRole] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination & Sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState<SortField>("invoice_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Mark as Paid dialog
  const [payDialog, setPayDialog] = useState<{ open: boolean; inv: StockRequestInvoiceResult | null }>({ open: false, inv: null });
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);

  // Edit (InvoiceModal)
  const [editRequest, setEditRequest] = useState<StockRequest | null>(null);
  const [editLoading, setEditLoading] = useState<number | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  useEffect(() => {
    authService.getCurrentUser().then((u) => setUserRole(u?.role || "")).catch(() => {});
  }, []);

  const fetchInvoices = useCallback(async () => {
    // Stock (distributor) invoices are DIST data; a BOOKS tenant without the
    // distribution module has none, so present an empty list instead of 403-ing.
    if (!authService.hasModule("DIST")) {
      setInvoices([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: String(page + 1),
        page_size: String(rowsPerPage),
        ordering: `${sortOrder === "desc" ? "-" : ""}${sortField}`,
      };
      if (search) params.search = search;
      if (statusFilter !== "all") params.payment_status = statusFilter;
      if (fromDate) params.invoice_date__gte = fromDate;
      if (toDate) params.invoice_date__lte = toDate;

      const data = await accountsApi.getStockRequestInvoices(params);
      setInvoices(data.results);
      setTotalCount(data.count);
    } catch {
      setSnackbar({ open: true, message: "Failed to load invoices.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, sortField, sortOrder, search, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortOrder("desc"); }
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearch(""); setStatusFilter("all"); setFromDate(""); setToDate("");
    setSortField("invoice_date"); setSortOrder("desc"); setPage(0);
  };

  // ── Download PDF ──
  const handleDownloadPDF = async (inv: StockRequestInvoiceResult) => {
    try {
      setDownloading(inv.id);
      const token = tokenManager.getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/distributor-inventory/invoices/${inv.id}/download_pdf/`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setSnackbar({ open: true, message: "Failed to download PDF.", severity: "error" });
    } finally {
      setDownloading(null);
    }
  };

  // ── Mark as Paid ──
  const openPayDialog = (inv: StockRequestInvoiceResult) => {
    setPayRef("");
    setPayDialog({ open: true, inv });
  };

  const handleMarkPaid = async () => {
    if (!payDialog.inv || !payRef.trim()) return;
    try {
      setPaying(true);
      await accountsApi.markStockInvoicePaid(payDialog.inv.id, {
        payment_reference: payRef,
        payment_date: new Date().toISOString().split("T")[0],
      });
      setSnackbar({ open: true, message: "Invoice marked as paid!", severity: "success" });
      setPayDialog({ open: false, inv: null });
      fetchInvoices();
    } catch {
      setSnackbar({ open: true, message: "Failed to mark invoice as paid.", severity: "error" });
    } finally {
      setPaying(false);
    }
  };

  // ── Edit: fetch parent StockRequest, open InvoiceModal ──
  const handleOpenEdit = async (inv: StockRequestInvoiceResult) => {
    try {
      setEditLoading(inv.id);
      const req = await distributorService.getStockRequest(inv.stock_request);
      setEditRequest(req);
      setInvoiceModalOpen(true);
    } catch {
      setSnackbar({ open: true, message: "Failed to load invoice details.", severity: "error" });
    } finally {
      setEditLoading(null);
    }
  };

  // ── Helpers ──
  const statusChipColor = (s: string): "success" | "warning" | "error" => {
    const m = mapStatus(s);
    if (m === "Paid") return "success";
    if (m === "Overdue") return "error";
    return "warning";
  };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const sortLabel = (field: SortField, label: string) => (
    <TableSortLabel
      active={sortField === field}
      direction={sortField === field ? sortOrder : "asc"}
      onClick={() => handleSort(field)}
      sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.75rem" }}
    >
      {label}
    </TableSortLabel>
  );

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

          {/* Header */}
          <Stack direction="row" alignItems="center" spacing={2} mb={4}>
            <Box sx={{
              width: 48, height: 48, borderRadius: "14px",
              background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 8px 20px ${alpha(theme.palette.success.main, 0.3)}`,
            }}>
              <ReceiptLongIcon sx={{ color: "white", fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{
                background: `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.primary.main})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                letterSpacing: "-0.03em", lineHeight: 1.1,
              }}>
                Sales Invoices
              </Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Auto-generated invoices from stock requests
              </Typography>
            </Box>
          </Stack>

          {/* Table Card */}
          <Paper elevation={0} sx={{
            borderRadius: 4, overflow: "hidden",
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
          }}>
            {/* Filters */}
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth placeholder="Search invoice or request no..." size="small"
                    value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon color="primary" sx={{ opacity: 0.6, fontSize: 20 }} /></InputAdornment>,
                      sx: { borderRadius: 2, bgcolor: "white" },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ borderRadius: 2, bgcolor: "white" }}>
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="unpaid">Unpaid</MenuItem>
                      <MenuItem value="invoiced">Invoiced</MenuItem>
                      <MenuItem value="paid">Paid</MenuItem>
                      <MenuItem value="overdue">Overdue</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, md: 2.5 }}>
                  <TextField fullWidth type="date" label="From" size="small" value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "white" } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2.5 }}>
                  <TextField fullWidth type="date" label="To" size="small" value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setPage(0); }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "white" } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2 }}>
                  <Tooltip title="Clear Filters">
                    <IconButton onClick={handleClearFilters} size="small" sx={{
                      borderRadius: 2, bgcolor: "white",
                      border: `1px solid ${alpha(theme.palette.divider, 0.3)}`, p: 1,
                    }}>
                      <FilterAltOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>
            </Box>

            {/* Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                    <TableCell sx={{ pl: 3 }}>{sortLabel("invoice_number", "INVOICE NO.")}</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.75rem" }}>STOCK REQUEST</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.75rem" }}>DISTRIBUTOR</TableCell>
                    <TableCell>{sortLabel("invoice_date", "DATE")}</TableCell>
                    <TableCell>{sortLabel("due_date", "DUE DATE")}</TableCell>
                    <TableCell align="right">{sortLabel("total_amount", "AMOUNT")}</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.75rem" }}>STATUS</TableCell>
                    <TableCell align="right" sx={{ pr: 3, fontWeight: 800, color: "text.secondary", fontSize: "0.75rem" }}>ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 10 }}>
                        <Box sx={{ textAlign: "center" }}>
                          <CircularProgress size={36} thickness={4} />
                          <Typography variant="body2" color="text.secondary" mt={2}>Loading invoices...</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 10, textAlign: "center" }}>
                        <Typography variant="h6" color="text.secondary">No invoices found</Typography>
                        <Typography variant="body2" color="text.disabled">Try adjusting your filters</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv, index) => {
                      const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.payment_status !== "paid";
                      const isPaid = inv.payment_status === "paid";
                      return (
                        <TableRow
                          key={inv.id}
                          component={motion.tr as React.ElementType}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.04 }}
                          hover
                          sx={{ "&:last-child td, &:last-child th": { border: 0 }, "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                        >
                          <TableCell sx={{ pl: 3 }}>
                            <Typography variant="subtitle2" fontWeight={800} color="primary.main">#{inv.invoice_number}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{inv.request_number || "—"}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">{inv.distributor_name || "—"}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatDate(inv.invoice_date)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color={isOverdue ? "error.main" : "text.primary"} fontWeight={isOverdue ? 700 : 400}>
                              {formatDate(inv.due_date)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                              ₹{Number(inv.total_amount).toLocaleString("en-IN")}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={mapStatus(inv.payment_status).toUpperCase()}
                              size="small"
                              color={statusChipColor(inv.payment_status)}
                              sx={{ fontWeight: 700, fontSize: "0.65rem" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ pr: 3 }}>
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">

                              {/* Edit — only shown when not paid */}
                              {!isPaid && (
                                <Tooltip title="Edit Invoice">
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenEdit(inv)}
                                      disabled={editLoading === inv.id}
                                      sx={{
                                        bgcolor: alpha(theme.palette.warning.main, 0.06),
                                        color: theme.palette.warning.dark,
                                        "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.14) },
                                        "&.Mui-disabled": { opacity: 0.5 },
                                      }}
                                    >
                                      {editLoading === inv.id
                                        ? <CircularProgress size={16} thickness={4} color="inherit" />
                                        : <EditOutlinedIcon fontSize="small" />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}

                              {/* Mark as Paid — hidden when already paid */}
                              {!isPaid && (
                                <Tooltip title="Mark as Paid">
                                  <IconButton
                                    size="small"
                                    onClick={() => openPayDialog(inv)}
                                    sx={{
                                      bgcolor: alpha(theme.palette.success.main, 0.06),
                                      color: theme.palette.success.main,
                                      "&:hover": { bgcolor: alpha(theme.palette.success.main, 0.14) },
                                    }}
                                  >
                                    <PaymentsIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                              {/* Download PDF */}
                              <Tooltip title="Download PDF">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDownloadPDF(inv)}
                                    disabled={downloading === inv.id}
                                    sx={{
                                      bgcolor: alpha(theme.palette.info.main, 0.06),
                                      color: theme.palette.info.main,
                                      "&:hover": { bgcolor: alpha(theme.palette.info.main, 0.12) },
                                      "&.Mui-disabled": { opacity: 0.5 },
                                    }}
                                  >
                                    {downloading === inv.id
                                      ? <CircularProgress size={16} thickness={4} color="inherit" />
                                      : <FileDownloadIcon fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>

                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50]} component="div"
              count={totalCount} rowsPerPage={rowsPerPage} page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
            />
          </Paper>
        </motion.div>
      </Box>

      {/* ── Invoice Edit Modal (same as Stock Requests) ── */}
      <InvoiceModal
        open={invoiceModalOpen}
        onClose={() => { setInvoiceModalOpen(false); setEditRequest(null); }}
        request={editRequest}
        initialTrigger="stock_request"
        userRole={userRole}
        onSuccess={() => {
          setInvoiceModalOpen(false);
          setEditRequest(null);
          fetchInvoices();
        }}
      />

      {/* ── Mark as Paid Dialog ── */}
      <Dialog open={payDialog.open} onClose={() => setPayDialog({ open: false, inv: null })}>
        <DialogTitle sx={{ fontWeight: 800 }}>Mark as Paid</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Recording payment for <strong>{payDialog.inv?.invoice_number}</strong>.
            This will mark the invoice as paid.
          </Typography>
          <TextField
            fullWidth
            label="Payment Reference"
            placeholder="Bank Txn ID, Cheque No, etc."
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setPayDialog({ open: false, inv: null })}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleMarkPaid}
            disabled={!payRef.trim() || paying}
          >
            {paying ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open} autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

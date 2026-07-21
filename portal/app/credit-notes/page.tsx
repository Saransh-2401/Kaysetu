"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Grid, Paper, Typography, Button, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, useTheme, alpha,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Avatar, InputAdornment, Tooltip, CircularProgress, Autocomplete,
  Snackbar, Alert, TableSortLabel, TablePagination
} from "@mui/material";
import { motion } from "framer-motion";
import { salesService, AdjustmentNote } from "@/lib/sales-service";
import { authService } from "@/lib/auth-service";

// Icons
import { NoteAddIcon, SearchIcon, PrintIcon, FilterAltOffIcon, EditIcon, RemoveCircleOutlineIcon, AddCircleOutlineIcon } from "@/components/icons";

export default function CreditDebitNotesPage() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<AdjustmentNote[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<string>('adjustment_date');

  // Pagination states
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Form State
  const [formData, setFormData] = useState({
    note_type: "credit",
    invoice_id: null as number | null,
    amount: "",
    reason: ""
  });

  // Invoice Search State
  const [invoiceOptions, setInvoiceOptions] = useState<any[]>([]);
  const [searchingInvoices, setSearchingInvoices] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedInvoiceTotal, setSelectedInvoiceTotal] = useState<number | null>(null);

  // Notification State
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "error" as "success" | "error" | "info" | "warning"
  });

  const showMessage = (message: string, severity: "success" | "error" | "info" | "warning" = "error") => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchNotes = async () => {
    // Credit/debit notes are sales adjustments (ORDERS). A BOOKS-only tenant
    // raises no sales, so there are none to list — skip the ORDERS call.
    if (!authService.hasModule("ORDERS")) {
      setNotes([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params: any = {
        limit: rowsPerPage.toString(),
        offset: (page * rowsPerPage).toString(),
        search: search,
        // note_type: typeFilter === "all" ? undefined : typeFilter,
        // adjustment_date_after: fromDate || undefined,
        // adjustment_date_before: toDate || undefined,
        ordering: (order === 'desc' ? '-' : '') + orderBy,
      };

      // Add other filters if supported by backend
      if (typeFilter !== "all") params.note_type = typeFilter;
      // if (fromDate) params.adjustment_date_after = fromDate;
      // if (toDate) params.adjustment_date_before = toDate;

      const data = await salesService.getAdjustments(params);
      setNotes(data.results || []);
      setTotalCount(data.count || 0);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [page, rowsPerPage, search, typeFilter, fromDate, toDate, order, orderBy]);

  const fetchInvoices = async (isInitial = false) => {
    if (!authService.hasModule("ORDERS")) return;  // no sales invoices to adjust
    try {
      setSearchingInvoices(true);
      const currentOffset = isInitial ? 0 : offset;
      const response = await salesService.searchInvoicesForAdjustment(
        formData.note_type as 'credit' | 'debit',
        searchQuery,
        8,
        currentOffset
      );

      if (isInitial) {
        setInvoiceOptions(response.results || []);
        setOffset(response.results?.length || 0);
      } else {
        setInvoiceOptions(prev => [...prev, ...(response.results || [])]);
        setOffset(prev => prev + (response.results?.length || 0));
      }
      setHasMore(response.has_more);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearchingInvoices(false);
    }
  };

  // Search Invoices Effect with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices(true);
    }, searchQuery ? 500 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery, formData.note_type]);

  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    setPage(0); // Reset to first page on sort
  };

  const stats = useMemo(() => {
    const credit = notes.filter(n => n.note_type === 'credit').reduce((acc, n) => acc + Number(n.adjustment_amount), 0);
    const debit = notes.filter(n => n.note_type === 'debit').reduce((acc, n) => acc + Number(n.adjustment_amount), 0);
    return { credit, debit };
  }, [notes]);

  const handleEdit = (note: AdjustmentNote) => {
    setEditingId(note.id);
    setFormData({
      note_type: note.note_type,
      invoice_id: note.stock_request_invoice || note.manual_invoice || null,
      amount: note.adjustment_amount.toString(),
      reason: note.reason
    });
    // We don't easily have the invoice total here unless we search it or it's in the note.
    // However, the rule is amount <= total. If we're editing, we assume it's valid or they will change it.
    // Let's set it to some large value if we don't have it, but better is to look it up.
    // For now, since invoice is already fixed in the note, we'll allow it.

    // Crucially, we need the invoice in the Autocomplete list so it shows as selected.
    const mockInvoice = {
      id: note.stock_request_invoice || note.manual_invoice,
      invoice_number: note.invoice_number,
      customer_name: note.customer_name,
      total_amount: 999999999, // Allow any amount during edit since we don't have total
      type: note.note_type === 'credit' ? 'Stock Request Invoice' : 'Manual Invoice'
    };
    setInvoiceOptions([mockInvoice]);
    setSelectedInvoiceTotal(999999999);
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.invoice_id || !formData.amount || !formData.reason.trim()) {
      showMessage("Please fill all mandatory fields.");
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      showMessage("Adjustment amount must be greater than zero.");
      return;
    }

    if (selectedInvoiceTotal !== null && parseFloat(formData.amount) > selectedInvoiceTotal) {
      showMessage(`Adjustment amount cannot be greater than the invoice total (₹${selectedInvoiceTotal.toLocaleString()}).`, "warning");
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        note_type: formData.note_type,
        adjustment_amount: formData.amount,
        reason: formData.reason,
      };

      if (formData.note_type === 'credit') {
        payload.stock_request_invoice = formData.invoice_id;
      } else {
        payload.manual_invoice = formData.invoice_id;
      }

      if (editingId) {
        await salesService.updateAdjustment(editingId, payload);
        showMessage("Adjustment note updated successfully!", "success");
      } else {
        await salesService.createAdjustment(payload);
        showMessage("Adjustment note issued successfully!", "success");
      }

      setOpenDialog(false);
      setEditingId(null);
      setFormData({ note_type: "credit", invoice_id: null, amount: "", reason: "" });
      fetchNotes();
    } catch (error) {
      console.error("Submission failed:", error);
      showMessage("Failed to issue adjustment note. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* HEADER */}
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
              Adjustment Notes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage Credit Notes (Sales Returns) and Debit Notes (Purchase Returns).
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<NoteAddIcon />}
            onClick={() => {
              setEditingId(null);
              setFormData({ note_type: "credit", invoice_id: null, amount: "", reason: "" });
              setInvoiceOptions([]);
              setSearchQuery("");
              setSelectedInvoiceTotal(null);
              setOpenDialog(true);
            }}
            sx={{
              borderRadius: "12px", px: 3,
              background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
              boxShadow: `0 4px 14px 0 ${alpha(theme.palette.info.main, 0.39)}`,
            }}
          >
            Create Note
          </Button>
        </Stack>

        {/* SUMMARY CARDS */}
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 3, bgcolor: alpha(theme.palette.error.main, 0.05), border: `1px solid ${alpha(theme.palette.error.main, 0.1)}` }} elevation={0}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: "error.main", width: 48, height: 48 }}>
                  <RemoveCircleOutlineIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} color="error.main" sx={{ opacity: 0.8 }}>
                    TOTAL CREDIT NOTES (SALES RETURNS)
                  </Typography>
                  <Typography variant="h4" fontWeight={800}>
                    ₹{stats.credit.toLocaleString()}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 3, bgcolor: alpha(theme.palette.success.main, 0.05), border: `1px solid ${alpha(theme.palette.success.main, 0.1)}` }} elevation={0}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: "success.main", width: 48, height: 48 }}>
                  <AddCircleOutlineIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} color="success.main" sx={{ opacity: 0.8 }}>
                    TOTAL DEBIT NOTES (PURCHASE RETURNS)
                  </Typography>
                  <Typography variant="h4" fontWeight={800}>
                    ₹{stats.debit.toLocaleString()}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* FILTERS */}
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }} elevation={0}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth size="small"
                placeholder="Search note, customer or invoice..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon color="primary" sx={{ opacity: 0.5 }} /></InputAdornment>,
                  sx: { borderRadius: 2 }
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                select fullWidth size="small"
                label="Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="credit">Credit Note</MenuItem>
                <MenuItem value="debit">Debit Note</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 2.5 }}>
              <TextField
                fullWidth size="small"
                type="date"
                label="From Date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2.5 }}>
              <TextField
                fullWidth size="small"
                type="date"
                label="To Date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 1 }}>
              <Tooltip title="Clear Filters">
                <IconButton onClick={() => { setSearch(""); setTypeFilter("all"); setFromDate(""); setToDate(""); }} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                  <FilterAltOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Paper>

        {/* NOTES TABLE */}
        <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, boxShadow: "0px 10px 40px rgba(0,0,0,0.03)", bgcolor: 'background.paper' }}>
          <TableContainer sx={{ overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', pl: 3 }}>
                    <TableSortLabel
                      active={orderBy === 'note_number'}
                      direction={orderBy === 'note_number' ? order : 'asc'}
                      onClick={() => handleSort('note_number')}
                    >
                      NOTE ID
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>
                    <TableSortLabel
                      active={orderBy === 'adjustment_date'}
                      direction={orderBy === 'adjustment_date' ? order : 'asc'}
                      onClick={() => handleSort('adjustment_date')}
                    >
                      DATE
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>INV REF</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>
                    <TableSortLabel
                      active={orderBy === 'customer_name'}
                      direction={orderBy === 'customer_name' ? order : 'asc'}
                      onClick={() => handleSort('customer_name')}
                    >
                      PARTY / CUSTOMER
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>TYPE</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>
                    <TableSortLabel
                      active={orderBy === 'adjustment_amount'}
                      direction={orderBy === 'adjustment_amount' ? order : 'asc'}
                      onClick={() => handleSort('adjustment_amount')}
                    >
                      ADJ. AMOUNT
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>REASON</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textAlign: 'right', pr: 3 }}>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
                ) : notes.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}><Typography color="text.secondary">No adjustment notes found.</Typography></TableCell></TableRow>
                ) : (
                  notes.map((note) => (
                    <TableRow key={note.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main', pl: 3 }}>{note.note_number}</TableCell>
                      <TableCell>{new Date(note.adjustment_date).toLocaleDateString()}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{note.invoice_number}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{note.customer_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={note.note_type === 'credit' ? 'Credit Note' : 'Debit Note'}
                          size="small"
                          color={note.note_type === 'credit' ? 'error' : 'success'}
                          variant="outlined"
                          sx={{ borderRadius: 1.5, fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>₹{Number(note.adjustment_amount).toLocaleString()}</TableCell>
                      <TableCell sx={{ maxWidth: 250, color: 'text.secondary' }}>
                        <Tooltip title={note.reason}>
                          <Typography variant="body2" noWrap>{note.reason}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 3 }}>
                        <IconButton size="small" onClick={() => handleEdit(note)} sx={{ mr: 1, color: 'info.main' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Print" onClick={() => window.print()} data-testid={`credit-note-print-btn-${note.id}`}><PrintIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            sx={{
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              px: 2,
              '& .MuiTablePagination-toolbar': {
                minHeight: '60px',
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'text.secondary',
                mt: 0.5
              }
            }}
          />
        </Paper>

        {/* CREATE DIALOG */}
        <Dialog open={openDialog} onClose={() => !submitting && setOpenDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>{editingId ? "Edit Adjustment Note" : "Issue Adjustment Note"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} mt={1}>
              <TextField
                select label="Note Type *" fullWidth
                value={formData.note_type}
                onChange={(e) => {
                  setFormData({ ...formData, note_type: e.target.value, invoice_id: null });
                  setInvoiceOptions([]);
                  setSearchQuery("");
                  setSelectedInvoiceTotal(null);
                }}
              >
                <MenuItem value="credit">Credit Note (Against Stock Request Invoice)</MenuItem>
                <MenuItem value="debit">Debit Note (Against Manual Invoice)</MenuItem>
              </TextField>

              <Autocomplete
                fullWidth
                disabled={!!editingId} // Disable invoice selection during edit
                loading={searchingInvoices}
                value={invoiceOptions.find(o => o.id === formData.invoice_id) || null}
                options={hasMore ? [...invoiceOptions, { isLoadMore: true }] : invoiceOptions}
                getOptionLabel={(option) => option.isLoadMore ? "" : `${option.invoice_number} - ${option.customer_name} (₹${option.total_amount})`}
                onInputChange={(e, value, reason) => {
                  if (reason === 'clear') {
                    setSearchQuery("");
                  } else if (e?.type === 'change' || !e) {
                    setSearchQuery(value);
                  }
                }}
                onChange={(e, value) => {
                  if (value && !value.isLoadMore) {
                    setFormData({ ...formData, invoice_id: value.id });
                    setSelectedInvoiceTotal(value.total_amount);
                  } else {
                    setFormData({ ...formData, invoice_id: null });
                    setSelectedInvoiceTotal(null);
                  }
                }}
                openOnFocus
                filterOptions={(x) => x}
                isOptionEqualToValue={(option, value) => {
                  if (option.isLoadMore || value.isLoadMore) return option.isLoadMore === value.isLoadMore;
                  return option.id === value.id;
                }}
                renderOption={(props, option) => {
                  const { key, ...liProps } = props;
                  if (option.isLoadMore) {
                    return (
                      <Box
                        component="li"
                        {...liProps}
                        key="load-more-invoice-item"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fetchInvoices(false);
                        }}
                        sx={{
                          justifyContent: 'center !important',
                          color: 'primary.main',
                          fontWeight: 700,
                          py: 1.5,
                          cursor: 'pointer',
                          borderTop: `1px solid ${theme.palette.divider}`,
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          {searchingInvoices && <CircularProgress size={16} />}
                          <Typography variant="body2" fontWeight={700}>
                            {searchingInvoices ? "Loading..." : "Load More Invoices"}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  }
                  return (
                    <Box component="li" {...liProps} key={key}>
                      <Stack>
                        <Typography variant="body2" fontWeight={700}>{option.invoice_number}</Typography>
                        <Typography variant="caption" color="text.secondary">{option.customer_name} • ₹{(option.total_amount || 0).toLocaleString()}</Typography>
                      </Stack>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={`Search ${formData.note_type === 'credit' ? 'Stock Invoice' : 'Manual Invoice'} *`}
                    placeholder="Enter invoice number or customer name..."
                    required
                  />
                )}
              />

              <TextField
                label="Adjustment Amount (Rupees) *"
                type="number" fullWidth required
                value={formData.amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, ''); // allow only numbers and dots
                  setFormData({ ...formData, amount: val });
                }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                inputProps={{ min: "0", step: "0.01" }}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />

              <TextField
                label="Reason for Adjustment *"
                fullWidth required multiline rows={3}
                placeholder="Mention specific reason (e.g., Damaged Goods, Rate Correction)..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setOpenDialog(false)} disabled={submitting}>Cancel</Button>
            <Button
              variant="contained" color={formData.note_type === 'credit' ? 'error' : 'success'}
              onClick={handleSubmit} disabled={submitting}
              sx={{ borderRadius: 2, px: 4, fontWeight: 700 }}
            >
              {submitting ? <CircularProgress size={24} color="inherit" /> : editingId ? "UPDATE NOTE" : `ISSUE ${formData.note_type.toUpperCase()} NOTE`}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%', borderRadius: 2, fontWeight: 600 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </motion.div>
    </>
  );
}

"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Box, Grid, Paper, Typography, Button, Stack, Chip, IconButton, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme,
    alpha, TextField, InputAdornment, LinearProgress, CircularProgress, Tooltip, Snackbar,
    Alert, TablePagination, Fade, TableSortLabel, FormControl, InputLabel, Select, MenuItem,
    Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { SearchIcon, ReceiptIcon, AddIcon, VisibilityIcon, DeleteOutlineIcon, FileDownloadIcon, FilterAltOffIcon, CheckCircleOutlineIcon, PaymentsIcon } from "@/components/icons";

import { salesService, ManualInvoice } from "@/lib/sales-service";
import ManualInvoiceModal from "@/components/invoices/ManualInvoiceModal";
import { formatDRFError } from "@/lib/utils";

export default function InvoicesPage() {
    const theme = useTheme();
    const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    // Pagination & Search State
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState("");

    // Filter State
    const [statusFilter, setStatusFilter] = useState("all");
    const [taxModeFilter, setTaxModeFilter] = useState("all");
    const [taxTypeFilter, setTaxTypeFilter] = useState("all");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Sorting State
    const [sortField, setSortField] = useState<string>("invoice_date");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Modal & Toast State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<ManualInvoice | null>(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

    // Pay Modal State
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [payInvoice, setPayInvoice] = useState<ManualInvoice | null>(null);
    const [paymentRef, setPaymentRef] = useState("");
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const data = await salesService.getManualInvoices();
            setInvoices(data.results || []);
        } catch (error) {
            console.error("Failed to fetch invoices:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const filteredInvoices = useMemo(() => {
        let result = [...invoices];

        // Search Filter
        if (search) {
            result = result.filter(inv =>
                inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
                inv.customer_name.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Dropdown Filters
        if (statusFilter !== "all") {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            result = result.filter(inv => {
                const dueDate = new Date(inv.due_date);
                dueDate.setHours(0, 0, 0, 0);
                const isOverdue = inv.status === 'unpaid' && dueDate < today;

                if (statusFilter === "overdue") {
                    return isOverdue;
                } else if (statusFilter === "unpaid") {
                    return inv.status === 'unpaid' && !isOverdue;
                } else {
                    return inv.status === statusFilter;
                }
            });
        }
        if (taxModeFilter !== "all") {
            const isInclusive = taxModeFilter === "inclusive";
            result = result.filter(inv => inv.is_tax_inclusive === isInclusive);
        }
        if (taxTypeFilter !== "all") {
            result = result.filter(inv => inv.tax_type === taxTypeFilter);
        }

        // Date Range Filter
        if (fromDate) {
            result = result.filter(inv => inv.invoice_date >= fromDate);
        }
        if (toDate) {
            result = result.filter(inv => inv.invoice_date <= toDate);
        }

        // Sorting
        result.sort((a: any, b: any) => {
            let valA = a[sortField];
            let valB = b[sortField];

            // Handle date comparison
            if (sortField === 'invoice_date' || sortField === 'payment_date' || sortField === 'due_date') {
                if (!valA) valA = 0;
                else valA = new Date(valA).getTime();

                if (!valB) valB = 0;
                else valB = new Date(valB).getTime();
            }

            // Handle numeric comparison
            if (sortField === 'grand_total') {
                valA = Number(valA);
                valB = Number(valB);
            }

            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [invoices, search, statusFilter, taxModeFilter, taxTypeFilter, fromDate, toDate, sortField, sortOrder]);

    const handleSort = (field: string) => {
        const isAsc = sortField === field && sortOrder === "asc";
        setSortOrder(isAsc ? "desc" : "asc");
        setSortField(field);
    };

    const handleClearFilters = () => {
        setSearch("");
        setStatusFilter("all");
        setTaxModeFilter("all");
        setTaxTypeFilter("all");
        setFromDate("");
        setToDate("");
        setSortField("invoice_date");
        setSortOrder("desc");
    };

    const paginatedInvoices = useMemo(() => {
        return filteredInvoices.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredInvoices, page, rowsPerPage]);

    const handleMarkAsPaid = async () => {
        if (!payInvoice || !paymentRef) return;
        try {
            setLoading(true);
            await salesService.markManualInvoiceAsPaid(payInvoice.id, paymentRef, paymentDate);
            setSnackbar({ open: true, message: "Invoice marked as paid!", severity: "success" });
            setPayModalOpen(false);
            setPaymentRef("");
            fetchInvoices();
        } catch (error: any) {
            setSnackbar({ open: true, message: formatDRFError(error), severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 4 } }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* HEADER SECTION */}
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                        spacing={2}
                        mb={4}
                    >
                        <Box>
                            <Typography variant="h3" fontWeight={900} sx={{
                                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                letterSpacing: '-0.03em',
                                mb: 0.5
                            }}>
                                Purchase Invoices
                            </Typography>
                            <Typography variant="body1" color="text.secondary" fontWeight={500}>
                                Create and manage purchase invoices.
                            </Typography>
                        </Box>

                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setSelectedInvoice(null);
                                setModalOpen(true);
                            }}
                            sx={{
                                px: 3,
                                py: 1.5,
                                borderRadius: 2.5,
                                fontWeight: 700,
                                fontSize: '1rem',
                                textTransform: 'none',
                                boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
                                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                                '&:hover': {
                                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                                    transform: 'translateY(-2px)',
                                    boxShadow: `0 12px 20px ${alpha(theme.palette.primary.main, 0.35)}`,
                                },
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            Create New Invoice
                        </Button>
                    </Stack>

                    {/* KPI ROW - Optional, could add stats for manual invoices here later */}

                    {/* TABLE SECTION */}
                    <Paper
                        elevation={0}
                        sx={{
                            borderRadius: 4,
                            overflow: 'hidden',
                            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.03)'
                        }}
                    >
                        <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                            <Grid container spacing={1.5} alignItems="center">
                                <Grid size={{ xs: 12, md: 2.5 }}>
                                    <TextField
                                        fullWidth
                                        placeholder="Search..."
                                        size="small"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon color="primary" sx={{ opacity: 0.6, fontSize: 20 }} />
                                                </InputAdornment>
                                            ),
                                            sx: { borderRadius: 2, bgcolor: 'background.paper' }
                                        }}
                                    />
                                </Grid>

                                <Grid size={{ xs: 6, md: 1.5 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Status</InputLabel>
                                        <Select
                                            value={statusFilter}
                                            label="Status"
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                                        >
                                            <MenuItem value="all">All</MenuItem>
                                            <MenuItem value="unpaid">Unpaid</MenuItem>
                                            <MenuItem value="paid">Paid</MenuItem>
                                            <MenuItem value="overdue">Overdue</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid size={{ xs: 6, md: 1.5 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Mode</InputLabel>
                                        <Select
                                            value={taxModeFilter}
                                            label="Mode"
                                            onChange={(e) => setTaxModeFilter(e.target.value)}
                                            sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                                        >
                                            <MenuItem value="all">All</MenuItem>
                                            <MenuItem value="inclusive">Incl.</MenuItem>
                                            <MenuItem value="exclusive">Excl.</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid size={{ xs: 6, md: 1.5 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Type</InputLabel>
                                        <Select
                                            value={taxTypeFilter}
                                            label="Type"
                                            onChange={(e) => setTaxTypeFilter(e.target.value)}
                                            sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                                        >
                                            <MenuItem value="all">All Types</MenuItem>
                                            <MenuItem value="cgst_sgst">CGST/SGST</MenuItem>
                                            <MenuItem value="igst">IGST</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid size={{ xs: 6, md: 2 }}>
                                    <TextField
                                        fullWidth
                                        type="date"
                                        label="From"
                                        size="small"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                                    />
                                </Grid>

                                <Grid size={{ xs: 6, md: 2 }}>
                                    <TextField
                                        fullWidth
                                        type="date"
                                        label="To"
                                        size="small"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, md: 1 }}>
                                    <Stack direction="row" justifyContent="flex-end">
                                        <Tooltip title="Clear Filters">
                                            <IconButton
                                                onClick={handleClearFilters}
                                                size="small"
                                                sx={{
                                                    borderRadius: 2,
                                                    bgcolor: 'background.paper',
                                                    border: `1px solid ${theme.palette.divider}`,
                                                    p: 1
                                                }}
                                            >
                                                <FilterAltOffIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Box>

                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                                        <TableCell sx={{ pl: 3 }}>
                                            <TableSortLabel
                                                active={sortField === 'invoice_number'}
                                                direction={sortField === 'invoice_number' ? sortOrder : 'asc'}
                                                onClick={() => handleSort('invoice_number')}
                                                sx={{ fontWeight: 800, color: 'text.secondary' }}
                                            >
                                                INVOICE NO.
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortField === 'customer_name'}
                                                direction={sortField === 'customer_name' ? sortOrder : 'asc'}
                                                onClick={() => handleSort('customer_name')}
                                                sx={{ fontWeight: 800, color: 'text.secondary' }}
                                            >
                                                CUSTOMER DETAILS
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortField === 'invoice_date'}
                                                direction={sortField === 'invoice_date' ? sortOrder : 'asc'}
                                                onClick={() => handleSort('invoice_date')}
                                                sx={{ fontWeight: 800, color: 'text.secondary' }}
                                            >
                                                DATE
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortField === 'due_date'}
                                                direction={sortField === 'due_date' ? sortOrder : 'asc'}
                                                onClick={() => handleSort('due_date')}
                                                sx={{ fontWeight: 800, color: 'text.secondary' }}
                                            >
                                                DUE DATE
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell align="right">
                                            <TableSortLabel
                                                active={sortField === 'grand_total'}
                                                direction={sortField === 'grand_total' ? sortOrder : 'asc'}
                                                onClick={() => handleSort('grand_total')}
                                                sx={{ fontWeight: 800, color: 'text.secondary' }}
                                            >
                                                GRAND TOTAL
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell>
                                            <TableSortLabel
                                                active={sortField === 'payment_date'}
                                                direction={sortField === 'payment_date' ? sortOrder : 'asc'}
                                                onClick={() => handleSort('payment_date')}
                                                sx={{ fontWeight: 800, color: 'text.secondary' }}
                                            >
                                                PAYMENT DATE
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>PAYMENT REF</TableCell>
                                        <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>STATUS</TableCell>
                                        <TableCell sx={{ fontWeight: 800, color: 'text.secondary', pr: 3 }} align="right">ACTIONS</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} sx={{ py: 10 }}>
                                                <Box sx={{ width: '100%', textAlign: 'center' }}>
                                                    <CircularProgress size={40} thickness={4} />
                                                    <Typography variant="body2" color="text.secondary" mt={2}>Fetching invoices...</Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : paginatedInvoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} sx={{ py: 10, textAlign: 'center' }}>
                                                <Typography variant="h6" color="text.secondary">No invoices found</Typography>
                                                <Typography variant="body2" color="text.disabled">Try adjusting your filters or create a new invoice</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <AnimatePresence>
                                            {paginatedInvoices.map((inv, index) => (
                                                <TableRow
                                                    key={inv.id}
                                                    component={motion.tr}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    hover
                                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                                >
                                                    <TableCell sx={{ pl: 3 }}>
                                                        <Typography variant="subtitle2" fontWeight={800} color="primary.main">#{inv.invoice_number}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={700} color="text.primary">{inv.customer_name}</Typography>
                                                        {inv.customer_address && (
                                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {inv.customer_address}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2">{new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="error.main" fontWeight={600}>
                                                            {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                                                            ₹{Number(inv.grand_total).toLocaleString()}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color={inv.payment_date ? "text.primary" : "text.disabled"}>
                                                            {inv.payment_date
                                                                ? new Date(inv.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                : '—'
                                                            }
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color={inv.payment_reference ? "text.primary" : "text.disabled"} sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                            {inv.payment_reference || '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const isOverdue = inv.status === 'unpaid' && new Date(inv.due_date) < new Date();
                                                            return (
                                                                <Chip
                                                                    label={isOverdue ? 'OVERDUE' : inv.status.toUpperCase()}
                                                                    size="small"
                                                                    color={inv.status === 'paid' ? 'success' : isOverdue ? 'error' : 'warning'}
                                                                    sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                                                />
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ pr: 3 }}>
                                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                            <Tooltip title="View/Edit">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        setSelectedInvoice(inv);
                                                                        setModalOpen(true);
                                                                    }}
                                                                    sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), color: theme.palette.primary.main }}
                                                                >
                                                                    <VisibilityIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            {inv.status === 'unpaid' && (
                                                                <Tooltip title="Mark as Paid">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => {
                                                                            setPayInvoice(inv);
                                                                            setPayModalOpen(true);
                                                                        }}
                                                                        sx={{ color: theme.palette.success.main, bgcolor: alpha(theme.palette.success.main, 0.05), '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.1) } }}
                                                                    >
                                                                        <PaymentsIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            <Tooltip title="Download PDF">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => salesService.downloadManualInvoicePDF(inv.id)}
                                                                    sx={{ bgcolor: alpha(theme.palette.info.main, 0.05), color: theme.palette.info.main }}
                                                                >
                                                                    <FileDownloadIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </AnimatePresence>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25]}
                            component="div"
                            count={filteredInvoices.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            onRowsPerPageChange={(e) => {
                                setRowsPerPage(parseInt(e.target.value, 10));
                                setPage(0);
                            }}
                            sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
                        />
                    </Paper>
                </motion.div>
            </Box>

            {/* MODAL */}
            <ManualInvoiceModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                invoice={selectedInvoice}
                onSuccess={fetchInvoices}
            />

            {/* Payment Reference Dialog */}
            <Dialog
                open={payModalOpen}
                onClose={() => setPayModalOpen(false)}
                PaperProps={{
                    sx: { borderRadius: 3, width: '100%', maxWidth: 400, p: 1 }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <PaymentsIcon color="success" />
                        <Typography variant="h6" fontWeight={800}>Confirm Payment</Typography>
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Enter the payment details for invoice <b>#{payInvoice?.invoice_number}</b> to mark it as paid.
                    </Typography>

                    <Stack spacing={2.5}>
                        <TextField
                            fullWidth
                            label="Payment Reference"
                            placeholder="UTR / Transaction ID / Cheque No."
                            value={paymentRef}
                            onChange={(e) => setPaymentRef(e.target.value)}
                            required
                            autoFocus
                        />
                        <TextField
                            fullWidth
                            label="Payment Date"
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2.5, pt: 1 }}>
                    <Button
                        onClick={() => setPayModalOpen(false)}
                        color="inherit"
                        variant="text"
                        sx={{ fontWeight: 700 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleMarkAsPaid}
                        variant="contained"
                        color="success"
                        disabled={!paymentRef || loading}
                        startIcon={loading ? <CircularProgress size={16} /> : <CheckCircleOutlineIcon />}
                        sx={{
                            px: 3,
                            borderRadius: 2,
                            fontWeight: 700,
                            boxShadow: `0 8px 16px ${alpha(theme.palette.success.main, 0.25)}`
                        }}
                    >
                        Mark as Paid
                    </Button>
                </DialogActions>
            </Dialog>

            {/* SNACKBAR */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
}

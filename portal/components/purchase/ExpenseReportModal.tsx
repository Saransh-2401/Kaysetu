"use client";
import React, { useEffect, useState } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Box, Typography,
    Stack, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, Button,
    CircularProgress, Chip, TextField, useTheme, alpha, Divider,
} from "@mui/material";
import { CloseIcon, FileDownloadIcon } from "@/components/icons";
import XLSXStyle from "xlsx-js-style";
import { purchaseService, PurchaseExpenseReport } from "@/lib/purchase-service";

interface Props {
    open: boolean;
    onClose: () => void;
}

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ExpenseReportModal({ open, onClose }: Props) {
    const theme = useTheme();
    const [data, setData] = useState<PurchaseExpenseReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const load = () => {
        setLoading(true);
        const params: Record<string, string> = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        purchaseService.getPurchaseExpenseReport(params)
            .then(setData)
            .catch((e) => console.error("Failed to load expense report:", e))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (open) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const exportExcel = () => {
        if (!data) return;
        const wb = XLSXStyle.utils.book_new();
        const summarySheet = XLSXStyle.utils.json_to_sheet([
            { Metric: "Total Expense", Value: data.summary.total_expense },
            { Metric: "Paid", Value: data.summary.paid },
            { Metric: "Unpaid", Value: data.summary.unpaid },
            { Metric: "PO Count", Value: data.summary.po_count },
        ]);
        XLSXStyle.utils.book_append_sheet(wb, summarySheet, "Summary");

        const supplierSheet = XLSXStyle.utils.json_to_sheet(
            data.by_supplier.map((s) => ({
                Supplier: s.supplier, "PO Count": s.po_count, Total: s.total, Paid: s.paid, Unpaid: s.unpaid,
            }))
        );
        XLSXStyle.utils.book_append_sheet(wb, supplierSheet, "By Supplier");

        const rowsSheet = XLSXStyle.utils.json_to_sheet(
            data.rows.map((r) => ({
                "PO Number": r.po_number, Supplier: r.supplier, "Order Date": r.order_date,
                Total: r.total, "Payment Status": r.payment_status, "Receipt Status": r.receipt_status,
            }))
        );
        XLSXStyle.utils.book_append_sheet(wb, rowsSheet, "Purchase Orders");

        const range = startDate || endDate ? `_${startDate || "start"}_to_${endDate || "end"}` : "";
        XLSXStyle.writeFile(wb, `PO_Expense_Report${range}.xlsx`);
    };

    const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.4)}` }}>
            <Typography variant="caption" fontWeight={800} color="text.secondary" textTransform="uppercase">{label}</Typography>
            <Typography variant="h6" fontWeight={900} sx={{ color }}>{value}</Typography>
        </Paper>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
            <DialogTitle sx={{ fontWeight: 800, pr: 6 }}>
                Purchase Expense Report
                <IconButton onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers data-testid="po-expense-report">
                <Stack direction="row" spacing={2} mb={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    <Button variant="outlined" onClick={load} sx={{ textTransform: "none" }}>Apply</Button>
                </Stack>

                {loading || !data ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
                ) : (
                    <>
                        <Grid container spacing={2} mb={3}>
                            <Grid size={{ xs: 6, md: 3 }}><Stat label="Total Expense" value={inr(data.summary.total_expense)} color="#2D3436" /></Grid>
                            <Grid size={{ xs: 6, md: 3 }}><Stat label="Paid" value={inr(data.summary.paid)} color="#00B894" /></Grid>
                            <Grid size={{ xs: 6, md: 3 }}><Stat label="Unpaid" value={inr(data.summary.unpaid)} color="#E17055" /></Grid>
                            <Grid size={{ xs: 6, md: 3 }}><Stat label="PO Count" value={String(data.summary.po_count)} color="#0984E3" /></Grid>
                        </Grid>

                        <Typography variant="subtitle2" fontWeight={800} mb={1}>By Supplier</Typography>
                        <Table size="small" sx={{ mb: 3 }}>
                            <TableHead><TableRow>
                                <TableCell>Supplier</TableCell><TableCell align="right">POs</TableCell>
                                <TableCell align="right">Total</TableCell><TableCell align="right">Paid</TableCell><TableCell align="right">Unpaid</TableCell>
                            </TableRow></TableHead>
                            <TableBody>
                                {data.by_supplier.map((s, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{s.supplier}</TableCell>
                                        <TableCell align="right">{s.po_count}</TableCell>
                                        <TableCell align="right">{inr(s.total)}</TableCell>
                                        <TableCell align="right">{inr(s.paid)}</TableCell>
                                        <TableCell align="right">{inr(s.unpaid)}</TableCell>
                                    </TableRow>
                                ))}
                                {data.by_supplier.length === 0 && (
                                    <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>No data</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>

                        <Typography variant="subtitle2" fontWeight={800} mb={1}>Purchase Orders ({data.rows.length})</Typography>
                        <Box sx={{ maxHeight: 240, overflow: "auto" }}>
                            <Table size="small" stickyHeader>
                                <TableHead><TableRow>
                                    <TableCell>PO</TableCell><TableCell>Supplier</TableCell><TableCell>Date</TableCell>
                                    <TableCell align="right">Total</TableCell><TableCell>Payment</TableCell>
                                </TableRow></TableHead>
                                <TableBody>
                                    {data.rows.map((r, i) => (
                                        <TableRow key={i}>
                                            <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{r.po_number}</TableCell>
                                            <TableCell>{r.supplier}</TableCell>
                                            <TableCell>{r.order_date}</TableCell>
                                            <TableCell align="right">{inr(r.total)}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={r.payment_status} color={r.payment_status === "paid" ? "success" : "default"} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Close</Button>
                <Button variant="contained" startIcon={<FileDownloadIcon />} onClick={exportExcel} disabled={!data} data-testid="po-expense-export-btn" sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#00B894", "&:hover": { bgcolor: "#019875" } }}>
                    Export to Excel
                </Button>
            </DialogActions>
        </Dialog>
    );
}

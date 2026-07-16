"use client";
import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import {
    Box,
    Grid,
    Paper,
    Typography,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Button,
    useTheme,
    alpha,
    TextField,
    MenuItem,
    CircularProgress,
    TablePagination,
    TableSortLabel,
    InputAdornment,
    Tooltip,
} from "@mui/material";
import { motion } from "framer-motion";
import { warehouseService, StockLedger } from "@/lib/warehouse-service";
import StockLedgerActivityModal from "@/components/warehouse/StockLedgerActivityModal";
import { format } from "date-fns";

// Icons
import { AccountBalanceWalletIcon, SearchIcon, FilterAltOffIcon, RefreshIcon, TrendingUpIcon, TrendingDownIcon, WarningAmberIcon } from "@/components/icons";

// Flag magnitudes that are almost certainly bad data (e.g. the 1,001,923 Kg COOKIES entry).
const ANOMALY_THRESHOLD = 1_000_000;

// Quantities without noisy trailing decimals (157.000 -> 157, -157.000 -> -157).
const fmtQty = (n: any) => {
    const v = Number(n) || 0;
    return Number.isInteger(v)
        ? v.toLocaleString("en-IN")
        : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

// Only the voucher types the backend actually writes, labelled by the real-world
// operation they represent. (The model defines more choices, but nothing ever
// creates rows for them, so listing them only produced empty "0 results" filters.)
//   stock_entry        -> hand-typed manual stock entries / adjustments
//   production_receipt -> finished goods manufactured (stock IN)
//   production_issue   -> raw material consumed by production (stock OUT)
//   purchase_receipt   -> goods received from suppliers
//   stock_request      -> finished goods transferred out to distributors
const VOUCHER_TYPE_LABELS: Record<string, string> = {
    stock_entry: "Manual Entry",
    production_receipt: "Produced",
    production_issue: "Consumed in Production",
    purchase_receipt: "Received from Supplier",
    stock_request: "Transferred to Distributor",
};

export default function StockLedgerPage() {
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [ledgerEntries, setLedgerEntries] = useState<StockLedger[]>([]);

    // Pagination states
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // Filter states
    const [search, setSearch] = useState("");
    const [voucherTypeFilter, setVoucherTypeFilter] = useState("all");
    const [itemCategoryFilter, setItemCategoryFilter] = useState("all");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Sorting states
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');
    const [orderBy, setOrderBy] = useState<string>('transaction_date');

    // Activity log modal
    const [activityId, setActivityId] = useState<number | null>(null);

    const fetchLedgerEntries = async () => {
        setLoading(true);
        try {
            const params: any = {
                limit: rowsPerPage.toString(),
                offset: (page * rowsPerPage).toString(),
                search: search,
                ordering: (order === 'desc' ? '-' : '') + orderBy,
            };

            if (voucherTypeFilter !== "all") params.voucher_type = voucherTypeFilter;
            if (itemCategoryFilter !== "all") params.item_category = itemCategoryFilter;
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;

            const response = await warehouseService.getStockLedger(params);
            setLedgerEntries(response.results);
            setTotalCount(response.count || 0);
        } catch (error) {
            console.error("Error fetching stock ledger:", error);
            toast.error("Failed to load stock ledger.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLedgerEntries();
    }, [page, rowsPerPage, search, voucherTypeFilter, itemCategoryFilter, fromDate, toDate, order, orderBy]);

    useEffect(() => {
        setPage(0);
    }, [search, voucherTypeFilter, itemCategoryFilter, fromDate, toDate, order, orderBy]);

    const handleSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
        setPage(0);
    };

    const getVoucherTypeLabel = (type: string) => VOUCHER_TYPE_LABELS[type] || type;

    const getVoucherTypeColor = (type: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
        const colors: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
            'stock_entry': 'info',             // Manual Entry
            'production_receipt': 'success',   // Produced
            'production_issue': 'secondary',   // Consumed in Production
            'purchase_receipt': 'primary',     // Received from Supplier
            'stock_request': 'warning',        // Transferred to Distributor
        };
        return colors[type] || 'default';
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems="center"
                    mb={4}
                >
                    <Box>
                        <Typography
                            variant="h4"
                            fontWeight={800}
                            sx={{ letterSpacing: "-0.02em", display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                            <AccountBalanceWalletIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                            Stock Ledger
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Complete audit trail of all stock movements - like a bank statement for inventory.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => {
                                setPage(0);
                                fetchLedgerEntries();
                            }}
                            disabled={loading}
                            sx={{ borderRadius: 1 }}
                        >
                            Refresh
                        </Button>
                    </Stack>
                </Stack>

                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        mb: 3,
                        borderRadius: 4,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        background: alpha(theme.palette.background.paper, 0.8),
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Search voucher or item..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 2 }}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Item Category"
                                value={itemCategoryFilter}
                                onChange={(e) => setItemCategoryFilter(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                            >
                                <MenuItem value="all">All Categories</MenuItem>
                                <MenuItem value="Raw Material">Raw Material</MenuItem>
                                <MenuItem value="Finished Goods">Finished Goods</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, md: 2.5 }}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Voucher Type"
                                value={voucherTypeFilter}
                                onChange={(e) => setVoucherTypeFilter(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                            >
                                <MenuItem value="all">All Types</MenuItem>
                                {Object.entries(VOUCHER_TYPE_LABELS).map(([value, label]) => (
                                    <MenuItem key={value} value={value}>{label}</MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, md: 1.75 }}>
                            <TextField
                                fullWidth
                                size="small"
                                type="date"
                                label="From Date"
                                InputLabelProps={{ shrink: true }}
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 1.75 }}>
                            <TextField
                                fullWidth
                                size="small"
                                type="date"
                                label="To Date"
                                InputLabelProps={{ shrink: true }}
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 1 }}>
                            <Tooltip title="Reset Filters">
                                <IconButton
                                    onClick={() => {
                                        setSearch("");
                                        setVoucherTypeFilter("all");
                                        setItemCategoryFilter("all");
                                        setFromDate("");
                                        setToDate("");
                                    }}
                                    sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}
                                >
                                    <FilterAltOffIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Grid>
                    </Grid>
                </Paper>

                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        overflow: "hidden",
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        boxShadow: "0px 10px 40px rgba(0,0,0,0.03)",
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: 'background.paper',
                        mb: 4
                    }}
                >
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10, flexGrow: 1 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: "action.hover" }}>
                                            <TableCell sx={{ fontWeight: 700, pl: 4 }}>
                                                <TableSortLabel
                                                    active={orderBy === 'transaction_date'}
                                                    direction={orderBy === 'transaction_date' ? order : 'asc'}
                                                    onClick={() => handleSort('transaction_date')}
                                                >
                                                    DATE & TIME
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>ITEM</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>VOUCHER TYPE</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>VOUCHER NO</TableCell>
                                            <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>
                                                <TableSortLabel
                                                    active={orderBy === 'quantity'}
                                                    direction={orderBy === 'quantity' ? order : 'asc'}
                                                    onClick={() => handleSort('quantity')}
                                                >
                                                    QTY
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>
                                                <TableSortLabel
                                                    active={orderBy === 'balance_qty'}
                                                    direction={orderBy === 'balance_qty' ? order : 'asc'}
                                                    onClick={() => handleSort('balance_qty')}
                                                >
                                                    BALANCE
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>UNIT</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {ledgerEntries.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                                                    <Typography color="text.secondary">No stock ledger entries found.</Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : ledgerEntries.map((entry) => {
                                            const bal = Number(entry.balance_qty);
                                            const qty = Number(entry.quantity);
                                            const negBalance = bal < 0;
                                            const anomalous = Math.abs(bal) >= ANOMALY_THRESHOLD || Math.abs(qty) >= ANOMALY_THRESHOLD;
                                            const flagColor = negBalance ? theme.palette.error.main : anomalous ? theme.palette.warning.main : null;
                                            return (
                                            <TableRow
                                                key={entry.id}
                                                hover
                                                onClick={() => setActivityId(entry.id)}
                                                data-testid={`ledger-row-${entry.id}`}
                                                sx={{
                                                    cursor: "pointer",
                                                    ...(flagColor ? { bgcolor: alpha(flagColor, 0.06), borderLeft: `3px solid ${flagColor}` } : {}),
                                                }}
                                            >
                                                <TableCell sx={{ pl: flagColor ? 3.5 : 4, fontFamily: "monospace", fontSize: '0.85rem' }}>
                                                    {format(new Date(entry.transaction_date), 'dd MMM yyyy, HH:mm')}
                                                </TableCell>
                                                <TableCell>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {entry.product_name || entry.item_name || 'N/A'}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {entry.product_sku || entry.item_code}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={getVoucherTypeLabel(entry.voucher_type)}
                                                        size="small"
                                                        color={getVoucherTypeColor(entry.voucher_type)}
                                                        sx={{ borderRadius: 1.5, fontWeight: 600 }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                    {entry.voucher_no}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: qty > 0 ? 'success.main' : 'error.main'
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                                        {qty > 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                                                        {qty > 0 ? `+${fmtQty(qty)}` : fmtQty(qty)}
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600, color: negBalance ? 'error.main' : 'inherit' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                                        {flagColor && (
                                                            <Tooltip title={negBalance ? 'Negative balance — inventory integrity issue' : 'Unusually large quantity — review for data error'}>
                                                                <WarningAmberIcon sx={{ fontSize: 15, color: flagColor }} />
                                                            </Tooltip>
                                                        )}
                                                        {fmtQty(bal)}
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                                    {entry.uom || '-'}
                                                </TableCell>
                                            </TableRow>
                                            );
                                        })}
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
                        </>
                    )}
                </Paper>
            </motion.div>

            <StockLedgerActivityModal
                ledgerId={activityId}
                open={activityId != null}
                onClose={() => setActivityId(null)}
            />
        </>
    );
}

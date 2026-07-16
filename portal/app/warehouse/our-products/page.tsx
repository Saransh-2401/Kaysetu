"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Box,
    Paper,
    Typography,
    Button,
    Stack,
    TextField,
    InputAdornment,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Avatar,
    Chip,
    IconButton,
    Tooltip,
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    useTheme,
    alpha,
    FormControl,
    InputLabel,
    Select,
    CircularProgress,
    Snackbar,
    Alert,
    Divider,
    Checkbox,
    FormControlLabel,
    TableSortLabel,
} from "@mui/material";
import { motion } from "framer-motion";
import { ClearIcon, SearchIcon, RefreshIcon, AddIcon, EditTwoToneIcon, DeleteTwoToneIcon, Inventory2Icon, WarningAmberIcon, CloseIcon, PhotoCameraIcon, CheckCircleTwoToneIcon, CancelTwoToneIcon, ErrorOutlineTwoToneIcon, DoNotDisturbOnTwoToneIcon, CompareArrowsIcon } from "@/components/icons";

// Icons

import StockAdjustmentModal from "@/components/warehouse/StockAdjustmentModal";
import { warehouseService, Product } from "@/lib/warehouse-service";

// Quantities without noisy trailing decimals (99874.000 -> 99,874).
const fmtQty = (n: any) => {
  const v = Number(n) || 0;
  return Number.isInteger(v)
    ? v.toLocaleString("en-IN")
    : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

export default function ProductMasterPage() {
    const theme = useTheme();

    // --- STATE ---
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Modal State

    const [openAdjustmentDialog, setOpenAdjustmentDialog] = useState(false);
    const [adjustmentTarget, setAdjustmentTarget] = useState<Product | null>(null);

    // Snackbar state
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success" as "success" | "error" | "info" | "warning",
    });

    const showSnackbar = (message: string, severity: "success" | "error" | "info" | "warning") => {
        setSnackbar({ open: true, message, severity });
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const prodRes = await warehouseService.getProducts();
            setProducts(prodRes.results || []);
        } catch (error) {
            console.error("Error fetching data:", error);
            showSnackbar("Failed to load products", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const [stockStatusFilter, setStockStatusFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

    useEffect(() => {
        setPage(0);
    }, [searchQuery, stockStatusFilter, statusFilter, sortConfig]);

    const handleSort = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const handleClearFilters = () => {
        setSearchQuery("");
        setStockStatusFilter("All");
        setStatusFilter("All");
        setSortConfig(null);
        setPage(0);
    };

    // --- FILTERING ---
    const filteredProducts = useMemo(() => {
        let filtered = products.filter((p) =>
            p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.hsn_code && p.hsn_code.includes(searchQuery))
        );

        if (stockStatusFilter !== "All") {
            if (stockStatusFilter === "In Stock") {
                filtered = filtered.filter(p => Number(p.quantity) > Number(p.low_stock_threshold));
            } else if (stockStatusFilter === "Low Stock") {
                filtered = filtered.filter(p => Number(p.quantity) > 0 && Number(p.quantity) <= Number(p.low_stock_threshold));
            } else if (stockStatusFilter === "Out of Stock") {
                filtered = filtered.filter(p => Number(p.quantity) <= 0);
            }
        }

        if (statusFilter !== "All") {
            filtered = filtered.filter(p => p.status.toLowerCase() === statusFilter.toLowerCase());
        } else {
            filtered = filtered.filter(p => p.status.toLowerCase() !== "archived");
        }

        if (sortConfig) {
            filtered = [...filtered].sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof Product];
                let bVal: any = b[sortConfig.key as keyof Product];

                if (sortConfig.key === 'selling_price') {
                    aVal = Number(a.selling_price) || 0;
                    bVal = Number(b.selling_price) || 0;
                } else if (sortConfig.key === 'quantity') {
                    aVal = Number(a.quantity) || 0;
                    bVal = Number(b.quantity) || 0;
                } else if (sortConfig.key === 'product_name') {
                    aVal = a.product_name.toLowerCase();
                    bVal = b.product_name.toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            });
        } else {
            // Default ordering surfaces the most critical first:
            // Out of Stock -> Low Stock -> In Stock (so the 6 OOS items in the
            // QA report are no longer buried on page 2).
            const severity = (p: Product) => {
                const q = Number(p.quantity);
                if (q <= 0) return 0;
                if (q <= Number(p.low_stock_threshold)) return 1;
                return 2;
            };
            filtered = [...filtered].sort((a, b) => severity(a) - severity(b));
        }

        return filtered;
    }, [products, searchQuery, stockStatusFilter, statusFilter, sortConfig]);

    const paginatedProducts = filteredProducts.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    // --- HANDLERS ---
    const handleOpenAdjustment = (product: Product) => {
        setAdjustmentTarget(product);
        setOpenAdjustmentDialog(true);
    };

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 4 } }}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                    <Box>
                        <Typography variant="h4" fontWeight={800} sx={{ color: "text.primary" }}>
                            Our Products
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="outlined"
                            color="inherit"
                            startIcon={<RefreshIcon />}
                            onClick={fetchData}
                            disabled={loading}
                            sx={{
                                borderRadius: "12px",
                                px: 3,
                                borderColor: alpha(theme.palette.divider, 0.2),
                            }}
                        >
                            Refresh
                        </Button>
                    </Stack>
                </Stack>

                <Grid container spacing={3} mb={4}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper
                            onClick={handleClearFilters}
                            data-testid="op-kpi-total"
                            sx={{ p: 2, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`, cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
                        >
                            <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', borderRadius: 2 }}>
                                <Inventory2Icon />
                            </Avatar>
                            <Box>
                                <Typography variant="h5" fontWeight={800}>{products.length}</Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Products</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper
                            onClick={() => { handleClearFilters(); setStatusFilter('Active'); }}
                            data-testid="op-kpi-active"
                            sx={{ p: 2, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`, cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
                        >
                            <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', borderRadius: 2 }}>
                                <CheckCircleTwoToneIcon />
                            </Avatar>
                            <Box>
                                <Typography variant="h5" fontWeight={800}>{products.filter(p => p.status === 'active').length}</Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>Active Products</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper
                            onClick={() => { handleClearFilters(); setStockStatusFilter('Low Stock'); }}
                            data-testid="op-kpi-lowstock"
                            sx={{ p: 2, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`, cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
                        >
                            <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'warning.main', borderRadius: 2 }}>
                                <WarningAmberIcon />
                            </Avatar>
                            <Box>
                                <Typography variant="h5" fontWeight={800}>
                                    {products.filter(p => Number(p.quantity) > 0 && Number(p.quantity) <= Number(p.low_stock_threshold)).length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>Low Stock Alert</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper
                            onClick={() => { handleClearFilters(); setStockStatusFilter('Out of Stock'); }}
                            data-testid="op-kpi-outofstock"
                            sx={{ p: 2, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`, cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
                        >
                            <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', borderRadius: 2 }}>
                                <DoNotDisturbOnTwoToneIcon />
                            </Avatar>
                            <Box>
                                <Typography variant="h5" fontWeight={800}>
                                    {products.filter(p => Number(p.quantity) <= 0).length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>Out of Stock</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Search & ToolBar */}
                <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5), border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                        <TextField
                            sx={{ flexGrow: 1 }}
                            size="small"
                            placeholder="Search by Product Name, SKU, HSN..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: 2 }
                            }}
                        />
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Stock Status</InputLabel>
                            <Select
                                value={stockStatusFilter}
                                onChange={(e) => setStockStatusFilter(e.target.value)}
                                label="Stock Status"
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="All">All Statuses</MenuItem>
                                <MenuItem value="In Stock">In Stock</MenuItem>
                                <MenuItem value="Low Stock">Low Stock</MenuItem>
                                <MenuItem value="Out of Stock">Out of Stock</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                label="Status"
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="All">All Types</MenuItem>
                                <MenuItem value="Active">Active</MenuItem>
                                <MenuItem value="Inactive">Inactive</MenuItem>
                                <MenuItem value="Archived">Archived</MenuItem>
                            </Select>
                        </FormControl>
                        <Button
                            color="error"
                            variant="outlined"
                            startIcon={<ClearIcon />}
                            onClick={handleClearFilters}
                            sx={{ borderRadius: 2, whiteSpace: "nowrap", height: 40 }}
                        >
                            Clear
                        </Button>
                    </Stack>
                </Paper>

                {/* QUICK STATUS FILTER CHIPS */}
                <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap data-testid="op-quick-filters">
                    {["All", "In Stock", "Low Stock", "Out of Stock"].map((s) => (
                        <Chip
                            key={s}
                            label={s}
                            clickable
                            size="small"
                            data-testid={`op-filter-chip-${s.toLowerCase().replace(/ /g, "-")}`}
                            color={stockStatusFilter === s ? "primary" : "default"}
                            variant={stockStatusFilter === s ? "filled" : "outlined"}
                            onClick={() => setStockStatusFilter(s)}
                            sx={{ fontWeight: 700 }}
                        />
                    ))}
                </Stack>

                {/* Table */}
                <TableContainer component={Paper} sx={{ borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, overflow: 'hidden' }}>
                    <Table>
                        <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    <TableSortLabel
                                        active={sortConfig?.key === 'product_name'}
                                        direction={sortConfig?.key === 'product_name' ? sortConfig.direction : 'asc'}
                                        onClick={() => handleSort('product_name')}
                                    >
                                        Product
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>SKU / HSN</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    <TableSortLabel
                                        active={sortConfig?.key === 'selling_price'}
                                        direction={sortConfig?.key === 'selling_price' ? sortConfig.direction : 'asc'}
                                        onClick={() => handleSort('selling_price')}
                                    >
                                        Pricing (MRP / Sale)
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    <TableSortLabel
                                        active={sortConfig?.key === 'quantity'}
                                        direction={sortConfig?.key === 'quantity' ? sortConfig.direction : 'asc'}
                                        onClick={() => handleSort('quantity')}
                                    >
                                        Current Stock
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Stock Status</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                                        <CircularProgress />
                                    </TableCell>
                                </TableRow>
                            ) : paginatedProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                                        <Typography color="text.secondary">No products found</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedProducts.map((product) => (
                                <TableRow key={product.id} hover data-testid={`op-row-${product.id}`}>
                                    <TableCell>
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            <Avatar
                                                src={product.product_image}
                                                variant="rounded"
                                                sx={{ width: 44, height: 44, bgcolor: alpha(theme.palette.primary.main, 0.1) }}
                                            >
                                                <Inventory2Icon fontSize="small" />
                                            </Avatar>
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700}>{product.product_name}</Typography>
                                                {product.product_location ? (
                                                    <Typography variant="caption" color="text.secondary">{product.product_location}</Typography>
                                                ) : (
                                                    <Tooltip title="No warehouse location assigned — staff can't locate this product for dispatch">
                                                        <Stack direction="row" alignItems="center" spacing={0.3} sx={{ color: "warning.main" }}>
                                                            <WarningAmberIcon sx={{ fontSize: 12 }} />
                                                            <Typography variant="caption" fontWeight={700}>No location set</Typography>
                                                        </Stack>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{product.sku}</Typography>
                                        <Typography variant="caption" color="text.secondary">HSN: {product.hsn_code || "N/A"}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>₹{product.selling_price}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>₹{product.mrp}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={700}>
                                            {fmtQty(product.quantity)} <Typography variant="caption" color="text.secondary">{product.uom}</Typography>
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={Number(product.quantity) > 0 ? (Number(product.quantity) <= Number(product.low_stock_threshold) ? "LOW STOCK" : "IN STOCK") : "OUT OF STOCK"}
                                            size="small"
                                            color={Number(product.quantity) > 0 ? (Number(product.quantity) <= Number(product.low_stock_threshold) ? "warning" : "success") : "error"}
                                            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={product.status.toUpperCase()}
                                            size="small"
                                            variant="outlined"
                                            color={product.status === 'active' ? 'primary' : product.status === 'inactive' ? 'warning' : 'default'}
                                            sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                            <Tooltip title="Adjust Stock">
                                                <IconButton
                                                    size="small"
                                                    data-testid={`op-adjust-btn-${product.id}`}
                                                    onClick={() => handleOpenAdjustment(product)}
                                                    sx={{ color: "info.main", "&:hover": { bgcolor: alpha(theme.palette.info.main, 0.1) } }}
                                                >
                                                    <CompareArrowsIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={filteredProducts.length}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                    />
                </TableContainer>



                <StockAdjustmentModal
                    open={openAdjustmentDialog}
                    onClose={() => setOpenAdjustmentDialog(false)}
                    targetItem={adjustmentTarget}
                    targetType="product"
                    onSuccess={() => {
                        fetchData();
                        showSnackbar("Stock adjustment successful.", "success");
                    }}
                />
            </Box>



            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled" sx={{ width: "100%", borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
}

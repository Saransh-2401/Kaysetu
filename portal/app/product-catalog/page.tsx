"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Box,
    Paper,
    Typography,
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
    useTheme,
    alpha,
    FormControl,
    InputLabel,
    Select,
    CircularProgress,
    Snackbar,
    Alert,
} from "@mui/material";
import { motion } from "framer-motion";

import { SearchIcon, RefreshIcon, ClearIcon, Inventory2Icon, WarningAmberIcon } from "@/components/icons";

import { warehouseService, Product } from "@/lib/warehouse-service";

const getStockStatus = (p: Product): "in" | "low" | "out" => {
    const qty = Number(p.quantity) || 0;
    const threshold = Number(p.low_stock_threshold) || 0;
    if (qty <= 0) return "out";
    if (qty <= threshold) return "low";
    return "in";
};

export default function ProductCatalogPage() {
    const theme = useTheme();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [stockStatusFilter, setStockStatusFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" as "success" | "error" | "info" | "warning" });

    // Products are searched server-side so SKU/HSN/name search spans the
    // full dataset (not just the first 1000 rows loaded for the table).
    const fetchData = async (search?: string) => {
        try {
            setLoading(true);
            const params: Record<string, string> = { limit: "1000" };
            const term = (search ?? "").trim();
            if (term) params.search = term;
            const res = await warehouseService.getProducts(params);
            setProducts(res.results || []);
        } catch (error) {
            console.error("Error fetching products:", error);
            setSnackbar({ open: true, message: "Failed to load products", severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Debounced server-side product search.
    const didMountSearch = useRef(false);
    useEffect(() => {
        if (!didMountSearch.current) {
            didMountSearch.current = true;
            return;
        }
        const handle = setTimeout(() => {
            fetchData(searchQuery);
        }, 400);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    useEffect(() => {
        setPage(0);
    }, [searchQuery, stockStatusFilter, statusFilter]);

    const filtered = useMemo(() => {
        return products.filter((p) => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                q === "" ||
                p.product_name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q) ||
                (p.hsn_code ? p.hsn_code.includes(searchQuery.trim()) : false);

            const stockStatus = getStockStatus(p);
            const matchesStock =
                stockStatusFilter === "All" ||
                (stockStatusFilter === "In Stock" && stockStatus === "in") ||
                (stockStatusFilter === "Low Stock" && stockStatus === "low") ||
                (stockStatusFilter === "Out of Stock" && stockStatus === "out");

            const matchesStatus = statusFilter === "All" || p.status === statusFilter;

            return matchesSearch && matchesStock && matchesStatus;
        });
    }, [products, searchQuery, stockStatusFilter, statusFilter]);

    const paginated = useMemo(
        () => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [filtered, page, rowsPerPage]
    );

    const hasActiveFilters = searchQuery !== "" || stockStatusFilter !== "All" || statusFilter !== "All";

    const clearFilters = () => {
        setSearchQuery("");
        setStockStatusFilter("All");
        setStatusFilter("All");
    };

    return (
        <Box className="page-enter" sx={{ p: { xs: 2, md: 3 } }}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800} color="text.primary">
                        Product Catalogue
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Browse and search products by name, SKU or HSN code (read-only)
                    </Typography>
                </Box>
                <Tooltip title="Refresh">
                    <IconButton onClick={() => fetchData(searchQuery)} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08), color: "primary.main" }}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Stack>

            {/* Filters */}
            <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search by Product Name, SKU, HSN..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
                    />
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                        <InputLabel>Stock Status</InputLabel>
                        <Select value={stockStatusFilter} label="Stock Status" onChange={(e) => setStockStatusFilter(e.target.value)}>
                            <MenuItem value="All">All Statuses</MenuItem>
                            <MenuItem value="In Stock">In Stock</MenuItem>
                            <MenuItem value="Low Stock">Low Stock</MenuItem>
                            <MenuItem value="Out of Stock">Out of Stock</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Product Status</InputLabel>
                        <Select value={statusFilter} label="Product Status" onChange={(e) => setStatusFilter(e.target.value)}>
                            <MenuItem value="All">All Types</MenuItem>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                            <MenuItem value="archived">Archived</MenuItem>
                        </Select>
                    </FormControl>
                    <Tooltip title="Clear filters">
                        <span>
                            <IconButton
                                onClick={clearFilters}
                                disabled={!hasActiveFilters}
                                sx={{
                                    bgcolor: hasActiveFilters ? alpha(theme.palette.error.main, 0.1) : "transparent",
                                    color: hasActiveFilters ? "error.main" : "text.disabled",
                                }}
                            >
                                <ClearIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Paper>

            {/* Table */}
            <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, overflow: "hidden" }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                                <TableCell>Product</TableCell>
                                <TableCell>SKU</TableCell>
                                <TableCell>HSN</TableCell>
                                <TableCell>UOM</TableCell>
                                <TableCell>Tax</TableCell>
                                <TableCell align="right">MRP (₹)</TableCell>
                                <TableCell align="right">Selling (₹)</TableCell>
                                <TableCell align="right">Stock</TableCell>
                                <TableCell>Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>
                            ) : paginated.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                                        <Stack alignItems="center" spacing={1}>
                                            <Inventory2Icon sx={{ fontSize: 40, color: "text.disabled" }} />
                                            <Typography variant="body2" color="text.secondary">
                                                {hasActiveFilters ? "No products match your filters" : "No products found"}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginated.map((p) => {
                                    const stockStatus = getStockStatus(p);
                                    return (
                                        <TableRow
                                            key={p.id}
                                            component={motion.tr}
                                            hover
                                            sx={{ "&:last-child td": { borderBottom: 0 } }}
                                        >
                                            <TableCell>
                                                <Stack direction="row" spacing={1.5} alignItems="center">
                                                    <Avatar
                                                        src={p.product_image || undefined}
                                                        variant="rounded"
                                                        sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main", width: 40, height: 40 }}
                                                    >
                                                        <Inventory2Icon fontSize="small" />
                                                    </Avatar>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {p.product_name}
                                                    </Typography>
                                                </Stack>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontFamily="monospace">
                                                    {p.sku}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{p.hsn_code || "—"}</TableCell>
                                            <TableCell>{p.uom || "—"}</TableCell>
                                            <TableCell>
                                                {p.tax_percentage != null ? `${p.tax_percentage}%` : p.tax_slab_name || "—"}
                                            </TableCell>
                                            <TableCell align="right">{Number(p.mrp).toLocaleString("en-IN")}</TableCell>
                                            <TableCell align="right">{Number(p.selling_price).toLocaleString("en-IN")}</TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                                                    {stockStatus === "low" && <WarningAmberIcon sx={{ fontSize: 16, color: "warning.main" }} />}
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {Number(p.quantity).toLocaleString("en-IN")}
                                                    </Typography>
                                                </Stack>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={
                                                        stockStatus === "out"
                                                            ? "Out of Stock"
                                                            : stockStatus === "low"
                                                            ? "Low Stock"
                                                            : "In Stock"
                                                    }
                                                    color={stockStatus === "out" ? "error" : stockStatus === "low" ? "warning" : "success"}
                                                    variant="outlined"
                                                    sx={{ fontWeight: 600 }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    component="div"
                    count={filtered.length}
                    page={page}
                    onPageChange={(_e, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                />
            </Paper>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
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
    Autocomplete,
} from "@mui/material";
import { motion } from "framer-motion";

// Icons
import { SearchIcon, RefreshIcon, ClearIcon, AddIcon, EditTwoToneIcon, DeleteTwoToneIcon, Inventory2Icon, WarningAmberIcon, CloseIcon, PhotoCameraIcon, CheckCircleTwoToneIcon, CancelTwoToneIcon, ErrorOutlineTwoToneIcon, DoNotDisturbOnTwoToneIcon, CompareArrowsIcon } from "@/components/icons";

import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";
import StockAdjustmentModal from "@/components/warehouse/StockAdjustmentModal";
import { warehouseService, Product } from "@/lib/warehouse-service";
import { mastersService, TaxSlab } from "@/lib/masters-service";
import { formatDRFError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/auth-service";

export default function ProductMasterPage() {
    const theme = useTheme();
    const router = useRouter();

    // --- STATE ---
    const [products, setProducts] = useState<Product[]>([]);
    const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);
    const [uomOptions, setUomOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Inline "quick add" tax slab dialog state
    const [openTaxDialog, setOpenTaxDialog] = useState(false);
    const [savingTax, setSavingTax] = useState(false);
    const [newTaxHsnInput, setNewTaxHsnInput] = useState("");
    const [newTax, setNewTax] = useState<{ name: string; percentage: number; hsn_codes: string[]; description: string }>({
        name: "",
        percentage: 0,
        hsn_codes: [],
        description: "",
    });
    const [taxErrors, setTaxErrors] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Modal State
    const [openDialog, setOpenDialog] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<Product>>({
        product_name: "",
        sku: "",
        hsn_code: "",
        description: "",
        mrp: 0,
        selling_price: 0,
        price_includes_tax: true,
        quantity: 0,
        uom: "Unit",
        low_stock_threshold: 0,
        status: "active",
        product_location: "",
        tax_slab: "" as any,
        weight: 0,
        length: 0,
        width: 0,
        height: 0,
        shipping_class: "",
    });
    const [saving, setSaving] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: number | null; name: string }>({
        open: false,
        id: null,
        name: "",
    });

    // Snackbar state
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success" as "success" | "error" | "info" | "warning",
    });

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await authService.getCurrentUser();
                if (user.role === 'warehouse_manager') {
                    setSnackbar({ open: true, message: "You are not authorized to access this section.", severity: "error" });
                    setTimeout(() => {
                        router.push('/warehouse');
                    }, 1500);
                }
            } catch (error) {
                console.error("Auth check failed:", error);
            }
        };
        checkAuth();
    }, [router]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const [openAdjustmentDialog, setOpenAdjustmentDialog] = useState(false);
    const [adjustmentTarget, setAdjustmentTarget] = useState<Product | null>(null);

    const handleOpenAdjustment = (product: Product) => {
        setAdjustmentTarget(product);
        setOpenAdjustmentDialog(true);
    };

    const showSnackbar = (message: string, severity: "success" | "error" | "info" | "warning") => {
        setSnackbar({ open: true, message, severity });
    };

    // --- INLINE QUICK-ADD TAX SLAB ---
    const handleOpenTaxDialog = () => {
        setNewTax({ name: "", percentage: 0, hsn_codes: [], description: "" });
        setNewTaxHsnInput("");
        setTaxErrors({});
        setOpenTaxDialog(true);
    };

    const handleAddNewTaxHsn = () => {
        const code = newTaxHsnInput.trim();
        if (!/^\d{4,8}$/.test(code)) {
            setTaxErrors(prev => ({ ...prev, hsn: "Enter a valid 4-8 digit HSN code" }));
            return;
        }
        if (newTax.hsn_codes.includes(code)) {
            setTaxErrors(prev => ({ ...prev, hsn: "HSN code already added" }));
            return;
        }
        setNewTax(prev => ({ ...prev, hsn_codes: [...prev.hsn_codes, code] }));
        setNewTaxHsnInput("");
        setTaxErrors(prev => ({ ...prev, hsn: "" }));
    };

    const handleRemoveNewTaxHsn = (code: string) => {
        setNewTax(prev => ({ ...prev, hsn_codes: prev.hsn_codes.filter(c => c !== code) }));
    };

    const handleCreateTaxSlab = async () => {
        const errs: Record<string, string> = {};
        if (!newTax.name.trim()) errs.name = "Tax name is required";
        if (!newTax.percentage || newTax.percentage < 0 || newTax.percentage > 100) errs.percentage = "Enter a valid percentage (0-100)";
        if (newTax.hsn_codes.length === 0) errs.hsn = "Add at least one HSN code";
        if (Object.keys(errs).length > 0) {
            setTaxErrors(errs);
            return;
        }
        try {
            setSavingTax(true);
            const created = await mastersService.createTaxSlab(newTax);
            setTaxSlabs(prev => [...prev, created]);
            setCurrentItem(prev => ({ ...prev, tax_slab: created.id as any }));
            setOpenTaxDialog(false);
            showSnackbar("Tax slab created and selected", "success");
        } catch (error) {
            showSnackbar(formatDRFError(error) || "Failed to create tax slab", "error");
        } finally {
            setSavingTax(false);
        }
    };

    // --- FETCH DATA ---
    // Products are searched server-side so SKU/HSN/name search spans the
    // full dataset (not just the first 1000 rows loaded for the table).
    const fetchProducts = async (search?: string) => {
        try {
            setLoading(true);
            const params: Record<string, string> = { limit: '1000' };
            const term = (search ?? '').trim();
            if (term) params.search = term;
            const prodRes = await warehouseService.getProducts(params);
            setProducts(prodRes.results || []);
        } catch (error) {
            console.error("Error fetching products:", error);
            showSnackbar("Failed to load products", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchMasters = async () => {
        try {
            const [taxRes, uomRes] = await Promise.all([
                mastersService.getTaxSlabs(),
                mastersService.getUOMs({ is_active: 'true', limit: '1000' }),
            ]);
            setTaxSlabs(taxRes.results || []);
            setUomOptions((uomRes.results || []).map(u => u.uom_name));
        } catch (error) {
            console.error("Error fetching masters:", error);
        }
    };

    // Reload masters + products with the current search term (used after mutations).
    const fetchData = async () => {
        await Promise.all([fetchMasters(), fetchProducts(searchQuery)]);
    };

    useEffect(() => {
        fetchMasters();
        fetchProducts();
    }, []);

    // Debounced server-side product search.
    const didMountSearch = useRef(false);
    useEffect(() => {
        if (!didMountSearch.current) {
            didMountSearch.current = true;
            return;
        }
        const handle = setTimeout(() => {
            fetchProducts(searchQuery);
        }, 400);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    const [stockStatusFilter, setStockStatusFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

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
        }

        return filtered;
    }, [products, searchQuery, stockStatusFilter, statusFilter, sortConfig]);

    useEffect(() => {
        setPage(0);
    }, [searchQuery, stockStatusFilter, statusFilter]);

    const paginatedProducts = filteredProducts.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    // --- HANDLERS ---
    const handleOpenAdd = () => {
        setCurrentItem({
            product_name: "",
            sku: "",
            hsn_code: "",
            description: "",
            mrp: 0,
            selling_price: 0,
            price_includes_tax: true,
            quantity: 0,
            uom: "Unit",
            low_stock_threshold: 0,
            status: "active",
            product_location: "",
            tax_slab: "" as any,
            weight: 0,
            length: 0,
            width: 0,
            height: 0,
            shipping_class: "",
        });
        setImagePreview(null);
        setImageFile(null);
        setErrors({});
        setOpenDialog(true);
    };

    const handleOpenEdit = (product: Product) => {
        setCurrentItem(product);
        setImagePreview(product.product_image || null);
        setImageFile(null);
        setErrors({});
        setOpenDialog(true);
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!currentItem.product_name?.trim()) newErrors.product_name = "Product Name is required";
        else if (currentItem.product_name.length > 200) newErrors.product_name = "Name cannot exceed 200 characters";

        if (!currentItem.sku?.trim()) newErrors.sku = "SKU is required";
        else if (currentItem.sku.length > 100) newErrors.sku = "SKU cannot exceed 100 characters";
        else if (!/^[a-zA-Z0-9_-]+$/.test(currentItem.sku)) newErrors.sku = "SKU must be alphanumeric (dash/underscore allowed)";

        if (!currentItem.tax_slab) newErrors.tax_slab = "Tax Slab is required";

        if (currentItem.hsn_code && !/^\d{6}$|^\d{8}$/.test(currentItem.hsn_code)) {
            newErrors.hsn_code = "HSN Code must be 6 or 8 digits";
        }
        if (currentItem.uom && currentItem.uom.length > 20) newErrors.uom = "UOM too long";
        if (currentItem.product_location && currentItem.product_location.length > 200) newErrors.product_location = "Location too long";
        if (currentItem.shipping_class && currentItem.shipping_class.length > 100) newErrors.shipping_class = "Shipping class too long";
        if (currentItem.description && currentItem.description.length > 500) newErrors.description = "Description cannot exceed 500 characters";

        // Price Validation
        const mrp = Number(currentItem.mrp) || 0;
        const sellingPrice = Number(currentItem.selling_price) || 0;

        if (mrp <= 0) {
            newErrors.mrp = "MRP must be greater than 0";
        }
        if (sellingPrice <= 0) {
            newErrors.selling_price = "Selling Price must be greater than 0";
        }

        if (sellingPrice > mrp) {
            newErrors.selling_price = "Selling Price cannot exceed MRP";
        } else if (currentItem.tax_slab) {
            const selectedTax = taxSlabs.find(t => t.id === currentItem.tax_slab);
            if (selectedTax) {
                const taxRate = Number(selectedTax.percentage) || 0;
                if (currentItem.price_includes_tax) {
                    // Inclusive: selling price already includes tax, just check against MRP
                    if (sellingPrice > mrp + 0.001) {
                        newErrors.selling_price = `Selling Price (₹${sellingPrice.toFixed(2)}) exceeds MRP (₹${mrp.toFixed(2)})`;
                    }
                } else {
                    // Exclusive: check price + tax against MRP
                    const totalWithTax = sellingPrice * (1 + taxRate / 100);
                    if (totalWithTax > mrp + 0.001) {
                        newErrors.selling_price = `Price with tax (₹${totalWithTax.toFixed(2)}) exceeds MRP (₹${mrp.toFixed(2)})`;
                    }
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNumericChange = (field: string, value: string) => {
        // Only allow digits and decimal point
        const cleanValue = value.replace(/[^0-9.]/g, '');
        // Prevent multiple decimal points
        const parts = cleanValue.split('.');
        const finalValue = parts.length > 2 ? `${parts[0]}.${parts[1]}` : cleanValue;

        setCurrentItem({ ...currentItem, [field]: finalValue });
    };

    const handleIntegerChange = (field: string, value: string) => {
        // Only allow digits (no decimals) and restrict to 8 characters max
        const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 8);
        setCurrentItem({ ...currentItem, [field]: cleanValue });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!validateForm()) {
            showSnackbar("Please fix errors in the form", "warning");
            return;
        }

        try {
            setSaving(true);
            const formData = new FormData();

            // Append all fields to FormData
            Object.entries(currentItem).forEach(([key, value]) => {
                if (key !== 'product_image' && value !== undefined && value !== null) {
                    // Skip empty strings for optional relation fields like tax_slab
                    if (key === 'tax_slab' && value === "") return;
                    formData.append(key, value.toString());
                }
            });

            if (imageFile) {
                formData.append('product_image', imageFile);
            }

            if (currentItem.id) {
                await warehouseService.updateProduct(currentItem.id, formData);
                showSnackbar("Product updated successfully", "success");
            } else {
                await warehouseService.createProduct(formData);
                showSnackbar("Product created successfully", "success");
            }

            setOpenDialog(false);
            fetchData();
        } catch (error: any) {
            console.error("Save failed:", error);
            const errorData = error.response?.data || error;
            showSnackbar(formatDRFError(errorData), "error");
            if (error.response?.data) {
                setErrors(error.response.data);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.id) return;
        setSaving(true);
        try {
            await warehouseService.deleteProduct(deleteModal.id);
            showSnackbar("Product deleted successfully", "success");
            setDeleteModal({ open: false, id: null, name: "" });
            fetchData();
        } catch (error: any) {
            console.error("Delete failed:", error);
            const errorData = error.response?.data || error;
            showSnackbar(formatDRFError(errorData), "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 4 } }}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                    <Box>
                        <Typography variant="h4" fontWeight={800} sx={{ color: "text.primary" }}>
                            Product Master
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Final products inventory and catalogue management
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenAdd}
                        sx={{
                            borderRadius: 1,
                            px: 3,
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                            boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
                        }}
                    >
                        Add Product
                    </Button>
                </Stack>

                <Grid container spacing={3} mb={4}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper
                            onClick={handleClearFilters}
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
                            sx={{ p: 2, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`, cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
                        >
                            <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'warning.main', borderRadius: 2 }}>
                                <WarningAmberIcon />
                            </Avatar>
                            <Box>
                                <Typography variant="h5" fontWeight={800}>
                                    {products.filter(p => p.quantity > 0 && p.quantity <= p.low_stock_threshold).length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>Low Stock Alert</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper
                            onClick={() => { handleClearFilters(); setStockStatusFilter('Out of Stock'); }}
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
                                <MenuItem value="active">Active</MenuItem>
                                <MenuItem value="inactive">Inactive</MenuItem>
                                <MenuItem value="archived">Archived</MenuItem>
                            </Select>
                        </FormControl>

                        <Tooltip title="Clear Filters">
                            <Box>
                                <IconButton
                                    onClick={handleClearFilters}
                                    disabled={searchQuery === "" && stockStatusFilter === "All" && statusFilter === "All" && sortConfig === null}
                                    color="error"
                                    sx={{
                                        bgcolor: (searchQuery !== "" || stockStatusFilter !== "All" || statusFilter !== "All" || sortConfig !== null) ? alpha(theme.palette.error.main, 0.1) : 'transparent',
                                        '&:hover': {
                                            bgcolor: alpha(theme.palette.error.main, 0.2),
                                        }
                                    }}
                                >
                                    <ClearIcon />
                                </IconButton>
                            </Box>
                        </Tooltip>
                    </Stack>
                </Paper>

                {/* Table */}
                <TableContainer component={Paper} sx={{ borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, overflow: 'hidden' }}>
                    <Table>
                        <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    <TableSortLabel
                                        active={sortConfig?.key === "product_name"}
                                        direction={sortConfig?.key === "product_name" ? sortConfig.direction : "asc"}
                                        onClick={() => handleSort("product_name")}
                                    >
                                        Product
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>SKU / HSN</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    <TableSortLabel
                                        active={sortConfig?.key === "selling_price"}
                                        direction={sortConfig?.key === "selling_price" ? sortConfig.direction : "asc"}
                                        onClick={() => handleSort("selling_price")}
                                    >
                                        Pricing (MRP / Sale)
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    <TableSortLabel
                                        active={sortConfig?.key === "quantity"}
                                        direction={sortConfig?.key === "quantity" ? sortConfig.direction : "asc"}
                                        onClick={() => handleSort("quantity")}
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
                                    <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
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
                                <TableRow key={product.id} hover>
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
                                                <Typography variant="caption" color="text.secondary">{product.product_location || "No location set"}</Typography>
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
                                            {product.quantity} <Typography variant="caption" color="text.secondary">{product.uom}</Typography>
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={product.quantity > 0 ? "IN STOCK" : "OUT OF STOCK"}
                                            size="small"
                                            color={product.quantity > 0 ? (product.quantity <= product.low_stock_threshold ? "warning" : "success") : "error"}
                                            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={product.status === 'active' ? "ACTIVE" : product.status === 'archived' ? "ARCHIVED" : "INACTIVE"}
                                            size="small"
                                            variant="outlined"
                                            color={product.status === 'active' ? 'primary' : product.status === 'archived' ? 'warning' : 'default'}
                                            sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                            <IconButton size="small" onClick={() => handleOpenEdit(product)} color="primary">
                                                <EditTwoToneIcon fontSize="small" />
                                            </IconButton>
                                            <Tooltip title="Stock Adjustment">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenAdjustment(product)}
                                                    sx={{ color: "info.main", "&:hover": { bgcolor: alpha(theme.palette.info.main, 0.1) } }}
                                                >
                                                    <CompareArrowsIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <IconButton
                                                size="small"
                                                onClick={() => setDeleteModal({ open: true, id: product.id, name: product.product_name })}
                                                color="error"
                                            >
                                                <DeleteTwoToneIcon fontSize="small" />
                                            </IconButton>
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

                {/* Delete Confirmation */}
                <DeleteConfirmModal
                    open={deleteModal.open}
                    onClose={() => setDeleteModal({ ...deleteModal, open: false })}
                    onConfirm={handleDelete}
                    title="Delete Product?"
                    message="Are you sure you want to delete this product? This will also remove any associated inventory records."
                    itemName={deleteModal.name}
                    loading={saving}
                />
            </Box>

            {/* Ad/Edit Dialog */}
            <Dialog
                open={openDialog}
                onClose={(e, reason) => {
                    if (reason === 'backdropClick') return;
                    if (!saving) setOpenDialog(false);
                }}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 1,
                        boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
                    }
                }}
            >
                <DialogTitle sx={{
                    p: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.02)
                }}>
                    <Typography variant="h5" component="span" fontWeight={800}>
                        {currentItem.id ? "Edit Product" : "Add New Product"}
                    </Typography>
                    <IconButton onClick={() => setOpenDialog(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />

                <DialogContent sx={{ p: 4 }}>
                    <Grid container spacing={4}>
                        {/* LEFT COLUMN: Basic Details */}
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Stack spacing={3}>
                                <Typography variant="subtitle2" component="div" color="primary" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 4, height: 16, bgcolor: 'primary.main', borderRadius: 1 }} />
                                    General Information
                                </Typography>

                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 8 }}>
                                        <TextField
                                            fullWidth
                                            label="Product Name"
                                            required
                                            value={currentItem.product_name}
                                            onChange={(e) => setCurrentItem({ ...currentItem, product_name: e.target.value.slice(0, 200) })}
                                            error={!!errors.product_name}
                                            helperText={errors.product_name || `${currentItem.product_name?.length || 0}/200`}
                                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            fullWidth
                                            label="SKU"
                                            required
                                            value={currentItem.sku}
                                            onChange={(e) => setCurrentItem({ ...currentItem, sku: e.target.value.slice(0, 100) })}
                                            error={!!errors.sku}
                                            helperText={errors.sku || `${currentItem.sku?.length || 0}/100`}
                                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            fullWidth
                                            label="HSN Code"
                                            value={currentItem.hsn_code}
                                            onChange={(e) => setCurrentItem({ ...currentItem, hsn_code: e.target.value.slice(0, 8) })}
                                            error={!!errors.hsn_code}
                                            helperText={errors.hsn_code || `${currentItem.hsn_code?.length || 0}/8`}
                                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <FormControl fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}>
                                            <InputLabel>Status</InputLabel>
                                            <Select
                                                value={currentItem.status}
                                                label="Status"
                                                onChange={(e) => setCurrentItem({ ...currentItem, status: e.target.value as any })}
                                            >
                                                <MenuItem value="active">Active</MenuItem>
                                                <MenuItem value="inactive">Inactive</MenuItem>
                                                <MenuItem value="archived">Archived</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <Autocomplete
                                            freeSolo
                                            options={uomOptions}
                                            value={currentItem.uom || ""}
                                            onChange={(_e, val) => setCurrentItem({ ...currentItem, uom: (val || "").slice(0, 20) })}
                                            onInputChange={(_e, val) => setCurrentItem({ ...currentItem, uom: (val || "").slice(0, 20) })}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="UOM"
                                                    placeholder="Search unit..."
                                                    error={!!errors.uom}
                                                    helperText={errors.uom || `${currentItem.uom?.length || 0}/20`}
                                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={4}
                                            label="Product Description"
                                            placeholder="Enter detailed product specifications..."
                                            value={currentItem.description}
                                            onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value.slice(0, 500) })}
                                            error={!!errors.description}
                                            helperText={errors.description || `${currentItem.description?.length || 0}/500`}
                                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                        />
                                    </Grid>
                                </Grid>
                            </Stack>
                        </Grid>

                        {/* RIGHT COLUMN: Image */}
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Stack spacing={2} sx={{ height: '100%' }}>
                                <Typography variant="subtitle2" component="div" color="primary" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 4, height: 16, bgcolor: 'primary.main', borderRadius: 1 }} />
                                    Product Image
                                </Typography>
                                <Box
                                    onClick={() => document.getElementById('image-upload')?.click()}
                                    sx={{
                                        border: '2px dashed',
                                        borderColor: alpha(theme.palette.divider, 0.4),
                                        borderRadius: 1,
                                        height: 240,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: alpha(theme.palette.background.default, 0.6),
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        '&:hover': {
                                            borderColor: theme.palette.primary.main,
                                            bgcolor: alpha(theme.palette.primary.main, 0.02)
                                        }
                                    }}
                                >
                                    <input
                                        type="file"
                                        id="image-upload"
                                        hidden
                                        accept="image/*"
                                        onChange={handleImageChange}
                                    />
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <Stack alignItems="center" spacing={1}>
                                            <Avatar sx={{ width: 64, height: 64, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                                                <PhotoCameraIcon />
                                            </Avatar>
                                            <Typography variant="body2" color="text.secondary" fontWeight={500}>Click to upload</Typography>
                                            <Typography variant="caption" color="text.disabled">Supports PNG, JPG (Max 5MB)</Typography>
                                        </Stack>
                                    )}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                                    This image will be used in catalogues and invoices
                                </Typography>
                            </Stack>
                        </Grid>

                        {/* SECTION: Pricing & Taxation */}
                        <Grid size={{ xs: 12 }}>
                            <Box sx={{
                                p: 3,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.info.main, 0.03),
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                            }}>
                                <Stack spacing={3}>
                                    <Typography variant="subtitle2" component="div" color="success.main" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 4, height: 16, bgcolor: 'success.main', borderRadius: 1 }} />
                                        Pricing & Taxation
                                    </Typography>
                                    <Grid container spacing={3}>
                                        <Grid size={{ xs: 12, sm: 3 }}>
                                            <TextField
                                                fullWidth
                                                label="MRP (₹)"
                                                value={currentItem.mrp}
                                                onChange={(e) => handleNumericChange('mrp', e.target.value)}
                                                error={!!errors.mrp}
                                                helperText={errors.mrp}
                                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: 'background.paper' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 3 }}>
                                            <TextField
                                                fullWidth
                                                label="Selling Price (₹)"
                                                value={currentItem.selling_price}
                                                onChange={(e) => handleNumericChange('selling_price', e.target.value)}
                                                error={!!errors.selling_price}
                                                helperText={errors.selling_price}
                                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: 'background.paper' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 3 }}>
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                                <FormControl
                                                    fullWidth
                                                    required
                                                    error={!!errors.tax_slab}
                                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: 'background.paper' } }}
                                                >
                                                    <InputLabel>Tax Slab</InputLabel>
                                                    <Select
                                                        value={currentItem.tax_slab}
                                                        label="Tax Slab"
                                                        onChange={(e) => setCurrentItem({ ...currentItem, tax_slab: e.target.value as number })}
                                                    >
                                                        {taxSlabs
                                                            .filter(tax => tax.is_active || tax.id === currentItem.tax_slab)
                                                            .map(tax => (
                                                                <MenuItem key={tax.id} value={tax.id}>
                                                                    {tax.name} ({tax.percentage}%){!tax.is_active ? " — Inactive" : ""}
                                                                </MenuItem>
                                                            ))}
                                                    </Select>
                                                    {errors.tax_slab && (
                                                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                                                            {errors.tax_slab}
                                                        </Typography>
                                                    )}
                                                </FormControl>
                                                <Tooltip title="Add new tax slab">
                                                    <IconButton
                                                        onClick={handleOpenTaxDialog}
                                                        sx={{
                                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                            color: 'primary.main',
                                                            borderRadius: 1,
                                                            width: 56,
                                                            height: 56,
                                                            flexShrink: 0,
                                                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                                                        }}
                                                    >
                                                        <AddIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                        {/* Hidden: price_includes_tax — always true, kept for future use */}
                                        <Grid size={{ xs: 12, sm: 3 }} sx={{ display: 'none' }}>
                                            <Paper elevation={0} sx={{
                                                height: '56px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                px: 2,
                                                borderRadius: 1,
                                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                                bgcolor: 'background.paper'
                                            }}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={currentItem.price_includes_tax}
                                                            onChange={(e) => setCurrentItem({ ...currentItem, price_includes_tax: e.target.checked })}
                                                        />
                                                    }
                                                    label={<Typography variant="body2" fontWeight={500}>Price includes Tax</Typography>}
                                                />
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                </Stack>
                            </Box>
                        </Grid>

                        {/* SECTION: Inventory & Warehouse */}
                        <Grid size={{ xs: 12 }}>
                            <Box sx={{
                                p: 3,
                                borderRadius: 1,
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                            }}>
                                <Stack spacing={3}>
                                    <Typography variant="subtitle2" component="div" color="warning.main" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 4, height: 16, bgcolor: 'warning.main', borderRadius: 1 }} />
                                        Stock & Warehouse
                                    </Typography>
                                    <Grid container spacing={3}>
                                        <Grid size={{ xs: 12, sm: 3 }}>
                                            <TextField
                                                fullWidth
                                                label="Opening Quantity"
                                                value={currentItem.quantity}
                                                onChange={(e) => handleIntegerChange('quantity', e.target.value)}
                                                disabled={true}
                                                error={!!errors.quantity}
                                                sx={{
                                                    "& .MuiOutlinedInput-root": { borderRadius: 1 },
                                                    '& .MuiInputBase-input.Mui-disabled': {
                                                        WebkitTextFillColor: alpha('#000', 0.5),
                                                        bgcolor: alpha('#000', 0.04),
                                                    }
                                                }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 3 }}>
                                            <TextField
                                                fullWidth
                                                label="Low Stock Alert"
                                                value={currentItem.low_stock_threshold}
                                                onChange={(e) => handleIntegerChange('low_stock_threshold', e.target.value)}
                                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                fullWidth
                                                label="Warehouse Location / Bin"
                                                placeholder="e.g., WH-1, Row 4, Shelf B"
                                                value={currentItem.product_location}
                                                onChange={(e) => setCurrentItem({ ...currentItem, product_location: e.target.value.slice(0, 200) })}
                                                error={!!errors.product_location}
                                                helperText={errors.product_location || `${currentItem.product_location?.length || 0}/200`}
                                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Stack>
                            </Box>
                        </Grid>

                        {/* SECTION: Logistics & Physical */}
                        <Grid size={{ xs: 12 }}>
                            <Box sx={{
                                p: 3,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.text.primary, 0.02),
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                            }}>
                                <Stack spacing={3}>
                                    <Typography variant="subtitle2" component="div" color="text.secondary" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 4, height: 16, bgcolor: 'text.secondary', borderRadius: 1 }} />
                                        Logistics & Dimensions
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 6, sm: 2.4 }}>
                                            <TextField fullWidth label="Weight (kg)" value={currentItem.weight} onChange={(e) => handleNumericChange('weight', e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: 'background.paper' } }} />
                                        </Grid>
                                        <Grid size={{ xs: 6, sm: 2.4 }}>
                                            <TextField fullWidth label="Length (cm)" value={currentItem.length} onChange={(e) => handleNumericChange('length', e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: 'background.paper' } }} />
                                        </Grid>
                                        <Grid size={{ xs: 6, sm: 2.4 }}>
                                            <TextField fullWidth label="Width (cm)" value={currentItem.width} onChange={(e) => handleNumericChange('width', e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: 'background.paper' } }} />
                                        </Grid>
                                        <Grid size={{ xs: 6, sm: 2.4 }}>
                                            <TextField fullWidth label="Height (cm)" value={currentItem.height} onChange={(e) => handleNumericChange('height', e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: 'background.paper' } }} />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 2.4 }}>
                                            <TextField
                                                fullWidth
                                                label="Shipping Class"
                                                placeholder="Standard"
                                                value={currentItem.shipping_class}
                                                onChange={(e) => setCurrentItem({ ...currentItem, shipping_class: e.target.value.slice(0, 100) })}
                                                error={!!errors.shipping_class}
                                                helperText={errors.shipping_class || `${currentItem.shipping_class?.length || 0}/100`}
                                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: 'background.paper' } }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Stack>
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ p: 4 }}>
                    <Button onClick={() => setOpenDialog(false)} color="inherit" sx={{ borderRadius: 2, px: 3 }}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving}
                        sx={{
                            borderRadius: 1,
                            px: 5,
                            py: 1.5,
                            bgcolor: 'text.primary',
                            '&:hover': { bgcolor: 'grey.900' }
                        }}
                    >
                        {saving ? <CircularProgress size={24} color="inherit" /> : currentItem.id ? "Update Product" : "Create Product"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* --- QUICK ADD TAX SLAB DIALOG --- */}
            <Dialog open={openTaxDialog} onClose={() => setOpenTaxDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Add New Tax Slab</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{ mt: 1 }}>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                fullWidth
                                label="Tax Name"
                                placeholder="e.g. GST 18%"
                                value={newTax.name}
                                onChange={(e) => setNewTax({ ...newTax, name: e.target.value.slice(0, 50) })}
                                error={!!taxErrors.name}
                                helperText={taxErrors.name}
                                required
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                            />
                            <TextField
                                label="Percentage (%)"
                                type="number"
                                value={newTax.percentage}
                                onChange={(e) => setNewTax({ ...newTax, percentage: parseFloat(e.target.value) || 0 })}
                                error={!!taxErrors.percentage}
                                helperText={taxErrors.percentage}
                                required
                                sx={{ maxWidth: 160, "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                inputProps={{ min: 0, max: 100, step: 0.01 }}
                            />
                        </Stack>

                        <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>HSN Codes Mapping</Typography>
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                                <TextField
                                    fullWidth
                                    placeholder="Enter 4-8 digit HSN"
                                    value={newTaxHsnInput}
                                    onChange={(e) => setNewTaxHsnInput(e.target.value.replace(/\D/g, ""))}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNewTaxHsn(); } }}
                                    error={!!taxErrors.hsn}
                                    helperText={taxErrors.hsn || "Press Enter or click Add"}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleAddNewTaxHsn}
                                    sx={{ borderRadius: 1, textTransform: "none", minWidth: 90, height: 56 }}
                                >
                                    Add
                                </Button>
                            </Stack>
                            {newTax.hsn_codes.length > 0 && (
                                <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
                                    {newTax.hsn_codes.map(code => (
                                        <Chip key={code} label={code} onDelete={() => handleRemoveNewTaxHsn(code)} sx={{ borderRadius: 1, fontWeight: 600 }} />
                                    ))}
                                </Box>
                            )}
                        </Box>

                        <TextField
                            fullWidth
                            label="Description"
                            multiline
                            rows={2}
                            value={newTax.description}
                            onChange={(e) => setNewTax({ ...newTax, description: e.target.value.slice(0, 500) })}
                            helperText={`${newTax.description.length}/500 characters`}
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setOpenTaxDialog(false)} color="inherit">Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateTaxSlab}
                        disabled={savingTax}
                        sx={{ borderRadius: 1 }}
                    >
                        {savingTax ? <CircularProgress size={22} color="inherit" /> : "Create & Select"}
                    </Button>
                </DialogActions>
            </Dialog>

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

            {/* STOCK ADJUSTMENT MODAL */}
            {openAdjustmentDialog && adjustmentTarget && (
                <StockAdjustmentModal
                    open={openAdjustmentDialog}
                    onClose={() => setOpenAdjustmentDialog(false)}
                    targetItem={adjustmentTarget}
                    targetType="product"
                    onSuccess={() => {
                        fetchData();
                    }}
                />
            )}
        </>
    );
}

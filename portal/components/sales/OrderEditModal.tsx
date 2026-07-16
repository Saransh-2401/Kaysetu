"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Box, Typography, Button, Stack, TextField, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, Grid, useTheme, alpha,
    CircularProgress, Tooltip, Snackbar, Alert, Autocomplete, Chip,
    Divider, InputAdornment,
} from "@mui/material";
import { CloseIcon, SaveIcon, DeleteOutlineIcon, AddCircleOutlineIcon, ReceiptLongIcon, ShoppingBagIcon } from "@/components/icons";
import { salesService, SalesOrder, SalesOrderItem } from "@/lib/sales-service";
import { warehouseService, Product } from "@/lib/warehouse-service";
import { formatDRFError } from "@/lib/utils";

interface OrderEditModalProps {
    open: boolean;
    onClose: () => void;
    order: SalesOrder | null;
    onSuccess: () => void;
}

interface EditItem extends SalesOrderItem {
    initialQty: number;
    _tempId?: number; // for newly added items that don't have a backend id yet
}

let tempIdCounter = 0;

export default function OrderEditModal({ open, onClose, order, onSuccess }: OrderEditModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [items, setItems] = useState<EditItem[]>([]);
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" as "error" | "success" });

    // Add product state
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    useEffect(() => {
        if (open && order) {
            fetchOrderDetails();
            fetchAvailableProducts();
        }
    }, [open, order]);

    const fetchOrderDetails = async () => {
        if (!order) return;
        try {
            setFetching(true);
            const fullOrder = await salesService.getSalesOrder(order.id) as any;
            const orderItems = fullOrder.items || fullOrder.order_items || [];
            const preparedItems = orderItems.map((item: any) => ({
                ...item,
                quantity: Number(item.quantity),
                rate: Number(item.rate),
                amount: Number(item.amount),
                tax_percentage: Number(item.tax_percentage) || Number(item.product_tax_rate) || 0,
                initialQty: Number(item.quantity),
            }));
            setItems(preparedItems);
        } catch (error) {
            console.error("Error fetching order:", error);
            setSnackbar({ open: true, message: "Failed to load order details", severity: "error" });
        } finally {
            setFetching(false);
        }
    };

    const fetchAvailableProducts = async () => {
        try {
            setLoadingItems(true);
            const res = await warehouseService.getProducts({ status: "active" });
            setAvailableProducts(res.results || []);
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setLoadingItems(false);
        }
    };

    // Filter out products already in the order
    const filteredAvailableProducts = useMemo(() => {
        const existingProductIds = new Set(items.map(i => i.product).filter(Boolean));
        const existingSkus = new Set(items.map(i => i.item_code).filter(Boolean));
        return availableProducts.filter(p =>
            !existingProductIds.has(p.id) && !existingSkus.has(p.sku)
        );
    }, [availableProducts, items]);

    const hasChanges = useMemo(() => {
        if (!order?.items) return false;
        if (items.length !== order.items.length) return true;
        return items.some(item => item.quantity !== item.initialQty);
    }, [items, order]);

    const hasInvalidItems = useMemo(() => {
        return items.some(item => !item.quantity || item.quantity <= 0);
    }, [items]);

    // Backend stores rate as base rate. It computes amounts via its own save() logic.
    // We mirror that: for inclusive, total = qty * rate * (1+tax/100); for exclusive, total = qty*rate + tax.
    // But since the backend already calculated these, we scale from the original per-unit values when qty changes.
    const calcLine = (item: EditItem) => {
        const qty = item.quantity;
        const rate = item.rate;
        const taxPct = Number(item.tax_percentage) || Number(item.product_tax_rate) || 0;
        const subtotal = Math.round(qty * rate * 100) / 100;

        if (item.price_includes_tax) {
            const unitInclusive = Math.round(rate * (1 + taxPct / 100) * 100) / 100;
            const total = Math.round(qty * unitInclusive * 100) / 100;
            return { subtotal, tax: Math.round((total - subtotal) * 100) / 100, total };
        }
        const tax = Math.round(subtotal * taxPct / 100 * 100) / 100;
        return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
    };

    const totals = useMemo(() => {
        let subtotal = 0, taxAmount = 0, total = 0;
        items.forEach(item => {
            const line = calcLine(item);
            subtotal += line.subtotal;
            taxAmount += line.tax;
            total += line.total;
        });
        return { subtotal, taxAmount, total };
    }, [items]);

    const getItemKey = (item: EditItem) => item.id ?? `temp-${item._tempId}`;

    const handleQtyChange = (key: number | string, val: string) => {
        if (val === "") {
            setItems(prev => prev.map(item =>
                getItemKey(item) === key ? { ...item, quantity: 0 } : item
            ));
            return;
        }
        const numVal = parseInt(val);
        if (isNaN(numVal) || numVal < 0 || numVal > 9999) return;
        setItems(prev => prev.map(item =>
            getItemKey(item) === key ? { ...item, quantity: numVal, amount: numVal * item.rate } : item
        ));
    };

    const removeItem = (key: number | string) => {
        if (items.length <= 1) {
            setSnackbar({ open: true, message: "Order must have at least one item", severity: "error" });
            return;
        }
        setItems(prev => prev.filter(item => getItemKey(item) !== key));
    };

    const handleAddProduct = (selectedProduct: Product | null) => {
        if (!selectedProduct) return;

        if (items.some(i => i.product === selectedProduct.id)) {
            setSnackbar({ open: true, message: "This product is already in the order", severity: "error" });
            return;
        }

        const taxPct = Number(selectedProduct.tax_percentage) || 0;
        const sellingPrice = selectedProduct.selling_price || 0;
        // Backend expects exclusive base rate — back-calculate for inclusive products
        const baseRate = selectedProduct.price_includes_tax && taxPct > 0
            ? Math.round(sellingPrice / (1 + taxPct / 100) * 100) / 100
            : sellingPrice;

        const newItem: EditItem = {
            _tempId: ++tempIdCounter,
            product: selectedProduct.id,
            item: 0,
            product_name: selectedProduct.product_name,
            item_code: selectedProduct.sku,
            hsn_code: selectedProduct.hsn_code,
            price_includes_tax: selectedProduct.price_includes_tax,
            quantity: 1,
            rate: baseRate,
            amount: baseRate,
            tax_percentage: taxPct,
            initialQty: 0,
        };

        setItems(prev => [...prev, newItem]);
    };

    const handleSave = async () => {
        if (!order) return;
        if (hasInvalidItems) {
            setSnackbar({ open: true, message: "All items must have quantity and rate greater than zero", severity: "error" });
            return;
        }

        try {
            setLoading(true);
            const data = {
                items: items.map(item => ({
                    ...(item.id ? { id: item.id } : {}),
                    ...(item.item ? { item: item.item } : {}),
                    ...(item.product ? { product: item.product } : {}),
                    quantity: item.quantity,
                    rate: item.rate,
                    tax_percentage: Number(item.tax_percentage) || 0,
                    price_includes_tax: item.price_includes_tax || false,
                })),
            };
            await salesService.updateOrderItems(order.id, data);
            setSnackbar({ open: true, message: "Order updated successfully", severity: "success" });
            onSuccess();
            onClose();
        } catch (error: any) {
            setSnackbar({ open: true, message: formatDRFError(error.response?.data || error), severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    overflow: "hidden",
                    maxHeight: "90vh",
                }
            }}
        >
            {/* Header */}
            <DialogTitle
                sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    color: "white",
                    py: 2.5,
                    px: 3,
                }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <ReceiptLongIcon sx={{ fontSize: 28 }} />
                        <Box>
                            <Typography variant="h6" fontWeight={700} color="inherit">Edit Order</Typography>
                            <Typography variant="caption" sx={{ opacity: 0.85 }}>
                                {order?.order_number} &bull; {order?.customer_name}
                            </Typography>
                        </Box>
                    </Stack>
                    <IconButton onClick={onClose} size="small" sx={{ color: "white", "&:hover": { bgcolor: alpha("#fff", 0.15) } }}>
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {fetching ? (
                    <Box display="flex" flexDirection="column" alignItems="center" py={8}>
                        <CircularProgress size={40} />
                        <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">Loading order items...</Typography>
                    </Box>
                ) : (
                    <>
                        {/* Add Product Section */}
                        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                            <Autocomplete
                                options={filteredAvailableProducts}
                                loading={loadingItems}
                                getOptionLabel={(option) => `${option.product_name} (${option.sku})`}
                                onChange={(_, val) => {
                                    handleAddProduct(val);
                                }}
                                value={null}
                                openOnFocus
                                blurOnSelect
                                clearOnBlur
                                ListboxProps={{ style: { maxHeight: 250 } }}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} key={option.id}>
                                        <Stack direction="row" alignItems="center" spacing={1.5} width="100%">
                                            <Box
                                                sx={{
                                                    width: 36, height: 36, borderRadius: 1.5,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                }}
                                            >
                                                <ShoppingBagIcon sx={{ fontSize: 18, color: "primary.main" }} />
                                            </Box>
                                            <Box flex={1}>
                                                <Typography variant="body2" fontWeight={600}>{option.product_name}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {option.sku} &bull; {option.uom}
                                                    {Number(option.tax_percentage) > 0 ? ` • Tax: ${option.tax_percentage}%` : ""}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" fontWeight={600} color="primary.main">
                                                &#8377;{Number(option.selling_price).toLocaleString("en-IN")}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                )}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Search & add products to order..."
                                        size="small"
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <AddCircleOutlineIcon color="primary" sx={{ fontSize: 20 }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            "& .MuiOutlinedInput-root": {
                                                borderRadius: 2.5,
                                                bgcolor: alpha(theme.palette.primary.main, 0.03),
                                                border: `1.5px dashed ${alpha(theme.palette.primary.main, 0.25)}`,
                                                "&:hover": {
                                                    borderColor: theme.palette.primary.main,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                                                },
                                                "& fieldset": { border: "none" },
                                            }
                                        }}
                                    />
                                )}
                            />
                        </Box>

                        <Divider />

                        {/* Items List */}
                        <Box sx={{ px: 3, py: 2, maxHeight: 400, overflow: "auto" }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1, mb: 1.5, display: "block" }}>
                                Order Items ({items.length})
                            </Typography>

                            <Stack spacing={1.5}>
                                {items.map((item) => {
                                    const key = getItemKey(item);
                                    const taxRate = Number(item.tax_percentage) || Number(item.product_tax_rate) || 0;
                                    const line = calcLine(item);
                                    const isNew = !item.id;

                                    return (
                                        <Box
                                            key={key}
                                            sx={{
                                                p: 2,
                                                borderRadius: 2.5,
                                                border: `1px solid ${isNew ? alpha(theme.palette.success.main, 0.3) : alpha(theme.palette.divider, 0.8)}`,
                                                bgcolor: isNew ? alpha(theme.palette.success.main, 0.03) : "background.paper",
                                                transition: "all 0.2s",
                                                "&:hover": {
                                                    boxShadow: `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`,
                                                    borderColor: alpha(theme.palette.primary.main, 0.3),
                                                },
                                            }}
                                        >
                                            {/* Row 1: Product name + delete */}
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                                                <Box flex={1} mr={1}>
                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                        <Typography variant="body2" fontWeight={700}>
                                                            {item.product_name || item.item_name}
                                                        </Typography>
                                                        {isNew && (
                                                            <Chip label="New" size="small" color="success" variant="outlined"
                                                                sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                                                            />
                                                        )}
                                                    </Stack>
                                                    {item.item_code && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.item_code}
                                                            {item.hsn_code ? ` • HSN: ${item.hsn_code}` : ""}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Tooltip title="Remove item">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => removeItem(key)}
                                                        sx={{
                                                            color: "text.disabled",
                                                            "&:hover": { color: "error.main", bgcolor: alpha(theme.palette.error.main, 0.08) },
                                                        }}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>

                                            {/* Row 2: Qty, Rate, Tax, Amount */}
                                            <Grid container spacing={1.5} alignItems="center">
                                                <Grid size={{ xs: 3 }}>
                                                    <TextField
                                                        label="Qty"
                                                        type="number"
                                                        size="small"
                                                        fullWidth
                                                        value={item.quantity || ""}
                                                        onChange={(e) => handleQtyChange(key, e.target.value)}
                                                        inputProps={{ style: { fontWeight: 700, textAlign: "center" }, min: 1, max: 9999, step: 1 }}
                                                        sx={{
                                                            "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: alpha(theme.palette.grey[100], 0.5) },
                                                            "& .MuiInputLabel-root": { fontSize: 12 },
                                                        }}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 3.5 }}>
                                                    <Box sx={{ textAlign: "center" }}>
                                                        <Typography variant="caption" color="text.secondary" display="block">Rate (₹)</Typography>
                                                        <Typography variant="body2" fontWeight={700}>
                                                            {Number(item.rate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid size={{ xs: 2 }}>
                                                    <Box sx={{ textAlign: "center" }}>
                                                        <Typography variant="caption" color="text.secondary" display="block">Tax</Typography>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {taxRate}%
                                                        </Typography>
                                                        <Chip
                                                            label={item.price_includes_tax ? "Incl." : "Excl."}
                                                            size="small"
                                                            sx={{ height: 16, fontSize: 9, fontWeight: 700, mt: 0.3 }}
                                                            color={item.price_includes_tax ? "info" : "default"}
                                                            variant="outlined"
                                                        />
                                                    </Box>
                                                </Grid>
                                                <Grid size={{ xs: 3.5 }}>
                                                    <Box sx={{ textAlign: "right" }}>
                                                        <Typography variant="caption" color="text.secondary" display="block">Amount</Typography>
                                                        <Typography variant="body2" fontWeight={700} color="primary.main">
                                                            &#8377;{line.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    );
                                })}

                                {items.length === 0 && (
                                    <Box sx={{ py: 4, textAlign: "center" }}>
                                        <ShoppingBagIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                                        <Typography color="text.secondary">No items in this order. Add products above.</Typography>
                                    </Box>
                                )}
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Totals Section */}
                        <Box sx={{ px: 3, py: 2, bgcolor: alpha(theme.palette.grey[100], 0.4) }}>
                            <Grid container spacing={1}>
                                <Grid size={{ xs: 4 }}>
                                    <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                                    <Typography variant="body1" fontWeight={600}>
                                        &#8377;{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </Typography>
                                </Grid>
                                <Grid size={{ xs: 4 }}>
                                    <Typography variant="caption" color="text.secondary">Tax</Typography>
                                    <Typography variant="body1" fontWeight={600}>
                                        &#8377;{totals.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </Typography>
                                </Grid>
                                <Grid size={{ xs: 4 }} sx={{ textAlign: "right" }}>
                                    <Typography variant="caption" color="text.secondary">Total</Typography>
                                    <Typography variant="h6" fontWeight={800} color="primary.main">
                                        &#8377;{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </>
                )}
            </DialogContent>

            <DialogActions
                sx={{
                    p: 2.5,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    bgcolor: "background.paper",
                }}
            >
                <Button onClick={onClose} color="inherit" sx={{ borderRadius: 2 }}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={loading || fetching || items.length === 0 || hasInvalidItems}
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                    sx={{
                        borderRadius: 2,
                        px: 3.5,
                        py: 1,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                        fontWeight: 700,
                        boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`,
                        "&:hover": {
                            boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.45)}`,
                        },
                    }}
                >
                    {loading ? "Saving..." : "Save Changes"}
                </Button>
            </DialogActions>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert severity={snackbar.severity} variant="filled" sx={{ width: "100%", borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
}

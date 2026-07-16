"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Box, Typography, Button, Stack, TextField, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, Grid, useTheme, alpha,
    CircularProgress, Divider, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, Tooltip
} from "@mui/material";
import { CloseIcon, CheckCircleIcon, DeleteOutlineIcon, WarningAmberIcon } from "@/components/icons";
import { Snackbar, Alert } from "@mui/material";
import { salesService, SalesOrder, SalesOrderItem } from "@/lib/sales-service";
import { formatDRFError } from "@/lib/utils";

interface OrderApprovalModalProps {
    open: boolean;
    onClose: () => void;
    order: SalesOrder | null;
    onSuccess: () => void;
}

interface ApprovalItem extends Omit<SalesOrderItem, 'quantity'> {
    currentStock: number;
    initialQty: number;
    item_id?: number;
    quantity: number | string;
}

export default function OrderApprovalModal({ open, onClose, order, onSuccess }: OrderApprovalModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [fetchingStock, setFetchingStock] = useState(false);
    const [items, setItems] = useState<ApprovalItem[]>([]);
    const [notes, setNotes] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" as "error" | "success" });

    const fetchStockDetails = async () => {
        if (!order) return;
        try {
            setFetchingStock(true);
            const stockData = await salesService.getStockDetails(order.id);
            const stockMap = stockData.reduce((acc: any, curr: any) => {
                acc[curr.item_id] = curr.current_stock;
                return acc;
            }, {});

            const preparedItems = (order.items || []).map(item => ({
                ...item,
                item_id: item.id,
                quantity: Math.floor(Number(item.quantity)),
                currentStock: Math.floor(stockMap[item.id!] || 0),
                initialQty: Math.floor(Number(item.quantity))
            }));
            setItems(preparedItems);
        } catch (error) {
            console.error("Error fetching stock:", error);
        } finally {
            setFetchingStock(false);
        }
    };

    useEffect(() => {
        if (open && order) {
            fetchStockDetails();
            setNotes("");
            setErrors({});
        }
    }, [open, order]);

    const hasChanges = useMemo(() => {
        if (!order || !order.items) return false;
        if (items.length !== order.items.length) return true;
        return items.some(item => Number(item.quantity) !== item.initialQty);
    }, [items, order]);

    const isInsufficientStock = useMemo(() => {
        return items.some(item => Number(item.quantity) > item.currentStock);
    }, [items]);

    const hasInvalidQty = useMemo(() => {
        return items.some(item => !item.quantity || Number(item.quantity) <= 0);
    }, [items]);

    const handleQtyChange = (id: number, val: string) => {
        // Allow empty string so user can clear input and type new value
        if (val === "") {
            setItems(prev => prev.map(item =>
                item.id === id ? { ...item, quantity: "" } : item
            ));
            return;
        }

        const numVal = parseInt(val);
        if (isNaN(numVal)) return;

        if (numVal <= 0) {
            setSnackbar({
                open: true,
                message: "Not allowed to set 0 qty. Remove the Product from the List.",
                severity: "error"
            });
            // We still update to allow them to see the 0 and then remove it
        }

        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantity: numVal, amount: numVal * item.rate } : item
        ));
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };


    const handleSubmit = async () => {
        if (!order) return;

        if (hasInvalidQty) {
            setSnackbar({ open: true, message: "Please ensure all quantities are greater than zero or remove the items.", severity: "error" });
            return;
        }

        if (isInsufficientStock) {
            setSnackbar({ open: true, message: "Cannot approve order with insufficient stock.", severity: "error" });
            return;
        }

        if (hasChanges && !notes.trim()) {
            setErrors({ notes: "Notes are mandatory when making changes to the order" });
            return;
        }

        try {
            setLoading(true);
            const data = {
                items: items.map(item => ({ id: item.item_id || item.id, quantity: item.quantity })),
                notes: notes
            };
            await salesService.updateAndApproveOrder(order.id, data);
            onSuccess();
            onClose();
        } catch (error: any) {
            alert(formatDRFError(error.response?.data || error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
            <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="h6" fontWeight={700}>Confirm & Approve Order</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Order: {order?.order_number} • Customer: {order?.customer_name}
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {fetchingStock ? (
                    <Box display="flex" flexDirection="column" alignItems="center" py={5}>
                        <CircularProgress size={40} />
                        <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">Fetching distributor stock levels...</Typography>
                    </Box>
                ) : (
                    <Grid container spacing={3}>
                        <Grid size={12}>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: alpha(theme.palette.grey[100], 0.7) }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700 }}>Ordered Qty</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700 }}>Distributor Stock</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700 }}>Action</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.id} sx={{
                                                bgcolor: Number(item.quantity) > item.currentStock ? alpha(theme.palette.error.light, 0.05) : 'inherit'
                                            }}>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600}>{item.product_name}</Typography>
                                                    {Number(item.quantity) > item.currentStock && (
                                                        <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                                                            <WarningAmberIcon color="error" sx={{ fontSize: 14 }} />
                                                            <Typography variant="caption" color="error">Insufficient Stock</Typography>
                                                        </Box>
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <TextField
                                                        variant="standard"
                                                        type="number"
                                                        size="small"
                                                        value={item.quantity}
                                                        onChange={(e) => handleQtyChange(item.id!, e.target.value)}
                                                        sx={{ width: 60 }}
                                                        inputProps={{
                                                            style: { textAlign: 'center', fontWeight: 700 },
                                                            step: "1",
                                                            min: "1"
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="body2" color={item.currentStock > 0 ? "success.main" : "error.main"}>
                                                        {item.currentStock}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Remove item">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => removeItem(item.id!)}
                                                            color="error"
                                                        >
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Grid>

                        <Grid size={12}>
                            <TextField
                                fullWidth
                                label="Approval Notes"
                                placeholder="Enter reason for changes (Mandatory if order is modified)"
                                multiline
                                rows={4}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                error={!!errors.notes}
                                helperText={errors.notes}
                                required={hasChanges}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                        </Grid>
                    </Grid>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2.5, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={loading || fetchingStock || items.length === 0 || isInsufficientStock || hasInvalidQty}
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
                    sx={{ borderRadius: 2, px: 3, py: 1 }}
                >
                    Confirm & Approve Order
                </Button>
            </DialogActions>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
}

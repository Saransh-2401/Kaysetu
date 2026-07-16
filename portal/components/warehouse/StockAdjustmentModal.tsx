"use client";
import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Button,
    Stack,
    TextField,
    MenuItem,
    CircularProgress,
    Typography,
    Snackbar,
    Alert
} from "@mui/material";
import { WarningAmberIcon } from "@/components/icons";
import { format } from "date-fns";
import { warehouseService, Item, Product, Warehouse } from "@/lib/warehouse-service";

// Adjustments are financial events — require a meaningful remark (not "ll"/"k"/"f").
const MIN_REMARK_LENGTH = 10;

// Show whole-number quantities without noisy trailing decimals.
const fmtQty = (n: any) => {
    const v = Number(n) || 0;
    return Number.isInteger(v)
        ? v.toLocaleString("en-IN")
        : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

interface StockAdjustmentModalProps {
    open: boolean;
    onClose: () => void;
    targetItem: any | null;
    targetType: "item" | "product";
    onSuccess: () => void;
}

export default function StockAdjustmentModal({
    open,
    onClose,
    targetItem,
    targetType,
    onSuccess
}: StockAdjustmentModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [adjType, setAdjType] = useState<"Increase" | "Decrease">("Increase");
    const [quantity, setQuantity] = useState<string>("");
    const [reason, setReason] = useState("Audit");
    const [remarks, setRemarks] = useState("");
    const [warehouseId, setWarehouseId] = useState<number | "">("");
    const [confirmStep, setConfirmStep] = useState(false);
    const [toast, setToast] = useState({ open: false, message: "", severity: "error" as "error" | "success" });

    useEffect(() => {
        if (open) {
            setAdjType("Increase");
            setQuantity("");
            setReason("Audit");
            setRemarks("");
            setWarehouseId("");
            setConfirmStep(false);
            setToast({ open: false, message: "", severity: "success" });

            // Fetch warehouses
            warehouseService.getWarehouses().then(res => {
                if (res.results.length > 0) {
                    setWarehouseId(res.results[0].id);
                }
            });
        } else {
            setQuantity("");
            setRemarks("");
            setWarehouseId("");
            setConfirmStep(false);
            setToast({ open: false, message: "", severity: "success" });
        }
    }, [open]);

    const handleClose = (event?: any, reason?: string) => {
        if (reason && reason === 'backdropClick') return;
        if (!submitting) onClose();
    };

    const handlePostAdjustment = async () => {
        if (!warehouseId || !targetItem || !quantity) return;

        setSubmitting(true);
        try {
            const qtyNum = Number(quantity);
            if (qtyNum <= 0) {
                setToast({ open: true, message: `Quantity must be greater than 0`, severity: "error" });
                setSubmitting(false);
                return;
            }
            const signedQty = adjType === "Increase" ? qtyNum : -qtyNum;

            let finalRate = Number(targetItem.valuation_rate || targetItem.standard_rate || targetItem.cost || targetItem.price || 0);
            const currentStock = Number(targetItem.current_stock || targetItem.stock || targetItem.quantity || 0);

            if (targetType === "product") {
                finalRate = Number(targetItem.selling_price) || 0;
            }

            if (adjType === "Decrease" && currentStock < qtyNum) {
                setToast({ open: true, message: `Cannot decrease stock below zero. Current available stock is ${currentStock}.`, severity: "error" });
                setSubmitting(false);
                return;
            }

            const itemData: any = {
                quantity: signedQty,
                rate: finalRate,
                amount: signedQty * finalRate,
            };

            if (targetType === "product") {
                itemData.product = targetItem.id;
            } else {
                itemData.item = targetItem.id;
            }

            const entry = await warehouseService.createStockEntry({
                entry_type: "stock_adjustment",
                stock_type: targetType,
                entry_date: format(new Date(), "yyyy-MM-dd"),
                target_warehouse: Number(warehouseId),
                remarks: remarks || `Manual Adjustment: ${reason}`,
                items: [itemData]
            });

            await warehouseService.submitStockEntry(entry.id);
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error posting adjustment:", error);
            setToast({ open: true, message: "Failed to post adjustment.", severity: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const currentStock = Number(
        (targetItem as any)?.current_stock ?? (targetItem as any)?.stock ?? (targetItem as any)?.quantity ?? 0
    );
    const qtyNum = Number(quantity) || 0;
    const projectedStock = adjType === "Increase" ? currentStock + qtyNum : currentStock - qtyNum;
    const uomLabel = (targetItem as any)?.uom || "";
    const remarkTooShort = remarks.trim().length < MIN_REMARK_LENGTH;

    // Validate before showing the confirmation step.
    const handleReview = () => {
        if (!warehouseId) {
            setToast({ open: true, message: "Warehouse is still loading — please wait.", severity: "error" });
            return;
        }
        if (qtyNum <= 0) {
            setToast({ open: true, message: "Quantity must be greater than 0", severity: "error" });
            return;
        }
        if (remarkTooShort) {
            setToast({ open: true, message: `Remarks must be at least ${MIN_REMARK_LENGTH} characters.`, severity: "error" });
            return;
        }
        if (adjType === "Decrease" && currentStock < qtyNum) {
            setToast({ open: true, message: `Cannot decrease below zero. Current stock is ${fmtQty(currentStock)}.`, severity: "error" });
            return;
        }
        setConfirmStep(true);
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { p: 1, borderRadius: '16px' } }}>
            <DialogTitle fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <WarningAmberIcon color="error" /> Reconcile Stock {" - "}
                {targetItem?.name || targetItem?.item_name || targetItem?.product_name || targetItem?.sku}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={3} mt={2}>
                    <TextField
                        label="Adjustment Target"
                        fullWidth
                        value={targetType === "item" ? "Item Master" : "Product Master"}
                        disabled
                    />
                    <TextField
                        label={targetType === "item" ? "Selected Item" : "Selected Product"}
                        fullWidth
                        value={targetItem ? (targetItem.name || targetItem.item_name || targetItem.product_name) : ""}
                        disabled
                    />
                    <Stack direction="row" spacing={2}>
                        <TextField
                            label="Action"
                            select
                            fullWidth
                            value={adjType}
                            onChange={(e) => setAdjType(e.target.value as any)}
                        >
                            <MenuItem value="Increase">Increase Stock (+)</MenuItem>
                            <MenuItem value="Decrease">Decrease Stock (-)</MenuItem>
                        </TextField>
                        <TextField
                            label="Quantity"
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                            fullWidth
                            value={quantity}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                setQuantity(val);
                            }}
                            onKeyDown={(e) => {
                                if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                                    e.preventDefault();
                                }
                            }}
                            required
                        />
                    </Stack>
                    <TextField
                        label="Reason Code"
                        select
                        fullWidth
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    >
                        <MenuItem value="Damaged">Damaged / Expired</MenuItem>
                        <MenuItem value="Theft">Theft / Loss</MenuItem>
                        <MenuItem value="Audit">Audit Correction</MenuItem>
                        <MenuItem value="Found">Found during inventory count</MenuItem>
                    </TextField>
                    <TextField
                        label="Remarks"
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="Explain the discrepancy (e.g. damaged in transit, physical count correction)..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        required
                        error={remarks.length > 0 && remarkTooShort}
                        helperText={
                            remarks.length > 0 && remarkTooShort
                                ? `At least ${MIN_REMARK_LENGTH} characters required (${remarks.trim().length}/${MIN_REMARK_LENGTH})`
                                : "A meaningful reason is mandatory for the audit trail."
                        }
                        inputProps={{ "data-testid": "stock-adjust-remarks-input" } as any}
                    />

                    {/* Live impact preview: Current -> After = New */}
                    {qtyNum > 0 && (
                        <Box
                            data-testid="stock-adjust-preview"
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: "action.hover",
                                border: "1px dashed",
                                borderColor: projectedStock < 0 ? "error.main" : "divider",
                            }}
                        >
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Current</Typography>
                                    <Typography variant="h6" fontWeight={800}>{fmtQty(currentStock)} {uomLabel}</Typography>
                                </Box>
                                <Typography variant="h5" sx={{ color: adjType === "Increase" ? "success.main" : "error.main", fontWeight: 800 }}>
                                    {adjType === "Increase" ? "+" : "−"}{fmtQty(qtyNum)} →
                                </Typography>
                                <Box sx={{ textAlign: "right" }}>
                                    <Typography variant="caption" color="text.secondary">New Balance</Typography>
                                    <Typography variant="h6" fontWeight={800} sx={{ color: projectedStock < 0 ? "error.main" : "text.primary" }}>
                                        {fmtQty(projectedStock)} {uomLabel}
                                    </Typography>
                                </Box>
                            </Stack>
                            {projectedStock < 0 && (
                                <Typography variant="caption" color="error.main" fontWeight={700}>
                                    This would drive stock below zero and will be blocked.
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Confirmation step */}
                    {confirmStep && (
                        <Alert severity="warning" variant="outlined" data-testid="stock-adjust-confirm" sx={{ borderRadius: 2 }}>
                            This will {adjType === "Increase" ? "increase" : "decrease"} stock of{" "}
                            <strong>{targetItem?.name || targetItem?.item_name || targetItem?.product_name}</strong> by{" "}
                            <strong>{fmtQty(qtyNum)} {uomLabel}</strong>. New balance: <strong>{fmtQty(projectedStock)} {uomLabel}</strong>. Confirm?
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                {confirmStep ? (
                    <>
                        <Button onClick={() => setConfirmStep(false)} disabled={submitting}>Back</Button>
                        <Button
                            variant="contained"
                            color="error"
                            data-testid="stock-adjust-confirm-btn"
                            onClick={handlePostAdjustment}
                            disabled={submitting || projectedStock < 0}
                            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            {submitting ? "Posting..." : "Confirm & Post"}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
                        <Button
                            variant="contained"
                            data-testid="stock-adjust-review-btn"
                            onClick={handleReview}
                            disabled={submitting || !quantity || remarkTooShort}
                        >
                            Review Adjustment
                        </Button>
                    </>
                )}
            </DialogActions>

            <Snackbar
                open={toast.open}
                autoHideDuration={4000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setToast({ ...toast, open: false })}
                    severity={toast.severity}
                    variant="filled"
                    sx={{ width: '100%', borderRadius: 2 }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
}

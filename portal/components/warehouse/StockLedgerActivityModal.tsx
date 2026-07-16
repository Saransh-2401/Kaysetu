"use client";
import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Box,
    Typography,
    Stack,
    Chip,
    Divider,
    CircularProgress,
    alpha,
    useTheme,
    Grid,
} from "@mui/material";
import { CloseIcon, HistoryIcon, TrendingUpIcon, TrendingDownIcon } from "@/components/icons";
import { format } from "date-fns";
import { warehouseService, StockLedgerActivity } from "@/lib/warehouse-service";

interface Props {
    ledgerId: number | null;
    open: boolean;
    onClose: () => void;
}

export default function StockLedgerActivityModal({ ledgerId, open, onClose }: Props) {
    const theme = useTheme();
    const [data, setData] = useState<StockLedgerActivity | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || ledgerId == null) return;
        let active = true;
        setData(null);
        setLoading(true);
        warehouseService.getStockLedgerActivity(ledgerId)
            .then((d) => active && setData(d))
            .catch((e) => console.error("Failed to load ledger activity:", e))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [open, ledgerId]);

    const fmt = (ts: string) => {
        try { return format(new Date(ts), "dd MMM yyyy, HH:mm"); } catch { return ts; }
    };

    const Detail = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">{label}</Typography>
            <Typography variant="body2" fontWeight={600}>{value ?? "—"}</Typography>
        </Box>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}>
            <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1, pr: 6 }}>
                <HistoryIcon color="primary" /> Ledger Activity
                <IconButton onClick={onClose} size="small" sx={{ position: "absolute", right: 12, top: 12 }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers data-testid="stock-ledger-activity-modal">
                {loading || !data ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
                ) : (
                    <>
                        {/* Movement summary */}
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), mb: 2.5 }}>
                            <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                                {data.ledger.quantity >= 0
                                    ? <TrendingUpIcon color="success" fontSize="small" />
                                    : <TrendingDownIcon color="error" fontSize="small" />}
                                <Typography variant="subtitle1" fontWeight={800}>
                                    {data.ledger.product_name || data.ledger.item_name || "Item"}
                                </Typography>
                                <Chip
                                    size="small"
                                    label={`${data.ledger.quantity >= 0 ? "+" : ""}${data.ledger.quantity}`}
                                    color={data.ledger.quantity >= 0 ? "success" : "error"}
                                    sx={{ fontWeight: 700 }}
                                />
                            </Stack>
                            <Grid container spacing={1.5}>
                                <Grid size={{ xs: 6 }}><Detail label="Voucher" value={`${data.source.label || data.ledger.voucher_no}`} /></Grid>
                                <Grid size={{ xs: 6 }}><Detail label="Warehouse" value={data.ledger.warehouse_name} /></Grid>
                                <Grid size={{ xs: 6 }}><Detail label="Balance After" value={data.ledger.balance_qty} /></Grid>
                                <Grid size={{ xs: 6 }}><Detail label="Stock Value" value={`₹${data.ledger.stock_value.toLocaleString("en-IN")}`} /></Grid>
                            </Grid>
                        </Box>

                        <Typography variant="caption" fontWeight={800} color="text.secondary" textTransform="uppercase">
                            Activity Timeline
                        </Typography>
                        <Divider sx={{ mt: 1, mb: 2 }} />

                        {data.events.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">No activity recorded.</Typography>
                        ) : (
                            <Stack spacing={0}>
                                {data.events.map((ev, i) => (
                                    <Stack key={i} direction="row" spacing={2}>
                                        {/* timeline rail */}
                                        <Stack alignItems="center">
                                            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: theme.palette.primary.main, mt: 0.5 }} />
                                            {i < data.events.length - 1 && (
                                                <Box sx={{ width: 2, flexGrow: 1, bgcolor: alpha(theme.palette.primary.main, 0.2), my: 0.5 }} />
                                            )}
                                        </Stack>
                                        <Box sx={{ pb: 2.5, flexGrow: 1 }}>
                                            <Typography variant="body2" fontWeight={700}>{ev.title}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {fmt(ev.timestamp)}{ev.actor ? ` · ${ev.actor}` : ""}
                                            </Typography>
                                            {ev.note && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{ev.note}</Typography>
                                            )}
                                        </Box>
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

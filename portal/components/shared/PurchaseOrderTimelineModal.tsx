"use client";
import React, { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Button,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useTheme,
    alpha,
    CircularProgress,
    Grid,
    Chip,
    Paper,
    Tooltip,
} from "@mui/material";

// Icons
import { AssignmentIcon, CloseIcon, ShoppingCartIcon, ReceiptIcon, ContentCopyIcon } from "@/components/icons";

import { purchaseService, PurchaseOrder } from "@/lib/purchase-service";

const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'received' || s === 'paid' || s === 'completed' || s === 'approved') return 'success';
    if (s === 'pending' || s === 'unpaid' || s === 'draft') return 'warning';
    if (s === 'cancelled' || s === 'short_closed') return 'error';
    if (s === 'partially_received') return 'info';
    return 'default';
};

export default function PurchaseOrderTimelineModal({
    open,
    onClose,
    poId,
    poDetails,
    onOpenMRModal,
}: PurchaseOrderTimelineModalProps) {
    const theme = useTheme();
    const [po, setPo] = useState<PurchaseOrder | null>(poDetails || null);
    const [timelineItems, setTimelineItems] = useState<any[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedRef, setCopiedRef] = useState(false);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedRef(true);
            setTimeout(() => setCopiedRef(false), 1500);
        } catch {
            /* clipboard unavailable — silently ignore */
        }
    };

    useEffect(() => {
        if (open) {
            if (poDetails) {
                setPo(poDetails);
                fetchPOItems(poDetails.id);
            } else if (poId) {
                fetchPODetails(poId);
            }
        } else {
            // cleanup on close
            setPo(null);
            setTimelineItems([]);
            setError(null);
        }
    }, [open, poId, poDetails]);

    const fetchPODetails = async (id: number) => {
        setTimelineLoading(true);
        setError(null);
        try {
            const data = await purchaseService.getPurchaseOrder(id);
            setPo(data);
            setTimelineItems(data.items || []);
        } catch (err) {
            console.error('Failed to fetch PO details:', err);
            setError('Failed to load purchase order details.');
        } finally {
            setTimelineLoading(false);
        }
    };

    const fetchPOItems = async (id?: number) => {
        if (!id) return;
        setTimelineLoading(true);
        try {
            const data = await purchaseService.getPurchaseOrder(id);
            setTimelineItems(data.items || []);
        } catch (err) {
            console.error('Failed to fetch PO details:', err);
        } finally {
            setTimelineLoading(false);
        }
    };

    if (!po && !timelineLoading && !error && open) {
        return null;
    }

    // Build the lifecycle events as DATA, then sort strictly by their actual
    // timestamp (not a hardcoded step order — that was producing chronologically
    // impossible sequences like Payment appearing before Shipment Arrived).
    // Each event also carries its actor so "who did this" is always shown.
    const buildEvents = (p: PurchaseOrder) => {
        const history: any[] = (p as any).status_history || [];
        const hist = (name: string) => history.find((h: any) => h.status === name);
        const events: any[] = [];
        let seq = 0;

        events.push({
            seq: seq++,
            title: 'Order Created',
            subtitle: 'PO generated and sent to supplier',
            date: p.order_date,
            color: theme.palette.success.main,
            actor: hist('Order Created')?.user || (p as any).created_by_name,
        });

        const approvedH = hist('Order Approved');
        if (p.status === 'approved' || approvedH) {
            events.push({
                seq: seq++,
                title: 'Order Approved',
                subtitle: 'PO verified and approved by management',
                date: approvedH?.timestamp,
                color: theme.palette.success.main,
                actor: approvedH?.user,
            });
        }

        const payH = hist('Payment Completed') || hist('Payment Recorded');
        if (p.payment_status === 'paid' || payH) {
            const ref = (p as any).payment_reference || payH?.notes?.split('Ref: ')[1] || 'N/A';
            events.push({
                seq: seq++,
                title: 'Payment Completed',
                subtitle: `Ref: ${ref}`,
                copyRef: ref && ref !== 'N/A' ? ref : null,
                date: payH?.timestamp,
                color: theme.palette.success.main,
                actor: payH?.user,
            });
        }

        const shipH = hist('Shipment Arrived');
        if (p.receipt_status === 'shipment_arrived' ||
            p.receipt_status === 'partially_received' ||
            p.receipt_status === 'received' ||
            shipH) {
            events.push({
                seq: seq++,
                title: 'Shipment Arrived',
                subtitle: 'Items delivered to warehouse',
                date: shipH?.timestamp,
                color: theme.palette.info.main,
                actor: shipH?.user,
            });
        }

        history.filter((h: any) => h.status === 'Partially Stocked').forEach((h: any) => {
            events.push({
                seq: seq++,
                title: 'Partially Stocked',
                subtitle: h.notes || 'Some items received, others pending',
                date: h.timestamp,
                color: theme.palette.warning.main,
                actor: h.user,
                items: h.items,
            });
        });

        const fullH = hist('Fully Stocked');
        if (p.receipt_status === 'received' || fullH) {
            events.push({
                seq: seq++,
                title: 'Fully Stocked',
                subtitle: 'All items received and added to inventory',
                date: fullH?.timestamp,
                color: theme.palette.success.main,
                actor: fullH?.user,
            });
        }

        const closeH = history.find((h: any) => h.status === 'Short Closed' || h.status === 'Cancelled');
        if (p.receipt_status === 'short_closed' || p.receipt_status === 'cancelled' || closeH) {
            const shortClosed = p.receipt_status === 'short_closed';
            events.push({
                seq: seq++,
                title: shortClosed ? 'Short Closed' : 'Cancelled',
                subtitle: closeH?.notes ||
                    (shortClosed ? 'Order closed with partial fulfillment' : 'Order completely cancelled'),
                date: closeH?.timestamp,
                color: theme.palette.error.main,
                actor: closeH?.user,
            });
        }

        // Strictly chronological. Dated events sort by real timestamp; any event
        // missing a timestamp falls to the end in its natural pipeline order.
        const ms = (e: any) => e.date ? new Date(e.date).getTime() : Number.MAX_SAFE_INTEGER - 1000 + e.seq;
        events.sort((a, b) => ms(a) - ms(b));
        return events;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: 1 } }}
        >
            <DialogTitle sx={{ fontWeight: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <AssignmentIcon color="primary" />
                    <Box>
                        <Typography variant="h6" fontWeight={900}>Purchase Order Timeline</Typography>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                                {po?.po_number || 'Loading...'}
                            </Typography>
                            {po?.material_request_number && po?.material_request && onOpenMRModal && (
                                <Tooltip title="View Material Request Details">
                                    <Typography
                                        variant="caption"
                                        component="span"
                                        data-testid="po-timeline-mr-link"
                                        onClick={() => onOpenMRModal(po.material_request!)}
                                        sx={{
                                            color: 'primary.main',
                                            fontWeight: 900,
                                            cursor: 'pointer',
                                            '&:hover': { textDecoration: 'underline' }
                                        }}
                                    >
                                        [{po.material_request_number}]
                                    </Typography>
                                </Tooltip>
                            )}
                        </Stack>
                    </Box>
                </Stack>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {error ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="error" fontWeight={600}>{error}</Typography>
                    </Box>
                ) : timelineLoading && !po ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : po ? (
                    <Box sx={{ p: 2 }}>
                        {/* PO Summary */}
                        <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.03), border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={800}>SUPPLIER</Typography>
                                    <Typography variant="body2" fontWeight={700}>{po.supplier_name}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={800}>ORDER DATE</Typography>
                                    <Typography variant="body2" fontWeight={700}>{new Date(po.order_date).toLocaleDateString()}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={800}>TOTAL AMOUNT</Typography>
                                    <Typography variant="body2" fontWeight={700} color="primary">Rs. {Number(po.total)?.toLocaleString()}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={800}>PAYMENT STATUS<br /></Typography>
                                    <Chip
                                        label={(po.payment_status || 'unpaid').toUpperCase()}
                                        size="small"
                                        color={getStatusColor(po.payment_status || 'unpaid') as any}
                                        sx={{ fontWeight: 800, fontSize: '0.65rem' }}
                                    />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Ordered Items Table */}
                        <Typography variant="subtitle2" fontWeight={800} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ShoppingCartIcon fontSize="small" color="primary" />
                            ORDERED ITEMS
                        </Typography>

                        {timelineLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={28} />
                            </Box>
                        ) : timelineItems.length > 0 ? (
                            <TableContainer component={Paper} elevation={0} sx={{ mb: 4, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 1 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                                            <TableCell sx={{ fontWeight: 800, fontSize: '0.7rem' }}>#</TableCell>
                                            <TableCell sx={{ fontWeight: 800, fontSize: '0.7rem' }}>ITEM</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>QTY</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>RECEIVED</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>RATE</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>TAX</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>AMOUNT</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {timelineItems.map((item: any, idx: number) => {
                                            const qty = Number(item.quantity) || 0;
                                            const rate = Number(item.rate) || 0;
                                            const taxAmt = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
                                            const taxPct = (Number(item.cgst_rate || 0) + Number(item.sgst_rate || 0) + Number(item.igst_rate || 0));
                                            const amount = Number(item.amount) || (qty * rate);
                                            const received = Number(item.received_quantity) || 0;
                                            return (
                                                <TableRow key={item.id || idx} hover>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{idx + 1}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={700}>{item.item_name || item.name || '—'}</Typography>
                                                        {item.item_code && (
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                                {item.item_code}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Typography variant="body2" fontWeight={600}>{qty} {item.uom || ''}</Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Chip
                                                            label={`${received} / ${qty}`}
                                                            size="small"
                                                            color={received >= qty ? 'success' : received > 0 ? 'warning' : 'default'}
                                                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" fontWeight={600}>₹{rate.toLocaleString()}</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" fontWeight={600}>₹{taxAmt.toLocaleString()}</Typography>
                                                        {taxPct > 0 && (
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                @ {Number.isInteger(taxPct) ? taxPct : taxPct.toFixed(2)}%
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" fontWeight={700} color="primary">₹{amount.toLocaleString()}</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {/* Subtotal / Tax / Total */}
                                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                                            <TableCell colSpan={5} />
                                            <TableCell align="right"><Typography variant="caption" fontWeight={800}>SUBTOTAL</Typography></TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight={700}>
                                                    ₹{Number(po?.subtotal || timelineItems.reduce((s: number, i: any) => s + ((Number(i.quantity) || 0) * (Number(i.rate) || 0)), 0)).toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                                            <TableCell colSpan={5} />
                                            <TableCell align="right"><Typography variant="caption" fontWeight={800}>TAX</Typography></TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight={700}>
                                                    ₹{Number(po?.tax_amount || timelineItems.reduce((s: number, i: any) => s + (Number(i.cgst_amount || 0) + Number(i.sgst_amount || 0) + Number(i.igst_amount || 0)), 0)).toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                                            <TableCell colSpan={5} />
                                            <TableCell align="right"><Typography variant="subtitle2" fontWeight={900}>TOTAL</Typography></TableCell>
                                            <TableCell align="right">
                                                <Typography variant="subtitle2" fontWeight={900} color="primary">
                                                    ₹{Number(po?.total || 0).toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Paper elevation={0} sx={{ p: 3, mb: 4, textAlign: 'center', bgcolor: alpha(theme.palette.text.primary, 0.02), borderRadius: 1 }}>
                                <Typography variant="body2" color="text.secondary">No items data available</Typography>
                            </Paper>
                        )}

                        {/* Timeline */}
                        <Typography variant="subtitle2" fontWeight={800} mb={3} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ReceiptIcon fontSize="small" color="primary" />
                            ORDER LIFECYCLE
                        </Typography>

                        <Box sx={{ position: 'relative', pl: 4 }}>
                            {/* Timeline Line */}
                            <Box sx={{
                                position: 'absolute',
                                left: 15,
                                top: 8,
                                bottom: 8,
                                width: 2,
                                bgcolor: alpha(theme.palette.primary.main, 0.1)
                            }} />

                            <Stack spacing={3}>
                                {buildEvents(po).map((ev: any) => (
                                    <Box
                                        key={ev.seq}
                                        sx={{ position: 'relative' }}
                                        data-testid={`po-timeline-${ev.title.toLowerCase().replace(/ /g, '-')}`}
                                    >
                                        <Box sx={{
                                            position: 'absolute',
                                            left: -25,
                                            top: 4,
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            bgcolor: ev.color,
                                            border: `3px solid ${theme.palette.background.paper}`,
                                            boxShadow: `0 0 10px ${alpha(ev.color, 0.4)}`
                                        }} />
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={800}>{ev.title}</Typography>
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    <Typography variant="caption" color="text.secondary" display="block">{ev.subtitle}</Typography>
                                                    {ev.copyRef && (
                                                        <Tooltip title={copiedRef ? "Copied!" : "Copy reference"}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => copyToClipboard(ev.copyRef)}
                                                                data-testid="po-timeline-copy-ref-btn"
                                                                sx={{ p: 0.25 }}
                                                            >
                                                                <ContentCopyIcon sx={{ fontSize: 13 }} color={copiedRef ? "success" : "inherit"} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Stack>
                                                {ev.actor && (
                                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: 'italic' }}>
                                                        by {ev.actor}
                                                    </Typography>
                                                )}
                                                {ev.items && ev.items.length > 0 && (
                                                    <TableContainer sx={{ mt: 1.5, borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                                        <Table size="small">
                                                            <TableHead sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                                                                <TableRow>
                                                                    <TableCell sx={{ py: 0.5 }}><Typography variant="caption" fontWeight={800} color="warning.dark">Item</Typography></TableCell>
                                                                    <TableCell align="right" sx={{ py: 0.5 }}><Typography variant="caption" fontWeight={800} color="warning.dark">Received</Typography></TableCell>
                                                                    <TableCell align="right" sx={{ py: 0.5 }}><Typography variant="caption" fontWeight={800} color="text.secondary">Total</Typography></TableCell>
                                                                    <TableCell align="right" sx={{ py: 0.5 }}><Typography variant="caption" fontWeight={800} color="text.secondary">Pending</Typography></TableCell>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {ev.items.map((item: any, i: number) => (
                                                                    <TableRow key={i} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                                        <TableCell sx={{ py: 0.5 }}><Typography variant="caption" fontWeight={700}>{item.item_name}</Typography></TableCell>
                                                                        <TableCell align="right" sx={{ py: 0.5 }}><Typography variant="caption" fontWeight={900} color="warning.dark">+{item.newly_received}</Typography></TableCell>
                                                                        <TableCell align="right" sx={{ py: 0.5 }}><Typography variant="caption" color="text.secondary">{item.total_received} / {item.quantity}</Typography></TableCell>
                                                                        <TableCell align="right" sx={{ py: 0.5 }}><Typography variant="caption" color="text.secondary">{item.missing_quantity}</Typography></TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </TableContainer>
                                                )}
                                            </Box>
                                            {ev.date && (
                                                <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ whiteSpace: 'nowrap', pl: 1 }}>
                                                    {new Date(ev.date).toLocaleString()}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                    </Box>
                ) : null}
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    sx={{ borderRadius: 1, fontWeight: 700 }}
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}

interface PurchaseOrderTimelineModalProps {
    open: boolean;
    onClose: () => void;
    poId?: number | null;
    poDetails?: PurchaseOrder | null;
    onOpenMRModal?: (mrId: number) => void;
}

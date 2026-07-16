"use client";
import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Button,
    IconButton,
    Stack,
    alpha,
    useTheme,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
} from "@mui/material";
import { motion } from "framer-motion";
import { StockRequest, distributorService } from "@/lib/distributor-service";
import { VisibilityIcon, CheckCircleIcon, RefreshIcon } from "@/components/icons";

export default function StockRequestsPage() {
    const theme = useTheme();
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const data = await distributorService.getStockRequests();
            // Handle both paginated and non-paginated responses
            setRequests(Array.isArray(data) ? data : (data as any).results || []);
        } catch (error) {
            console.error("Failed to fetch requests", error);
            toast.error("Failed to load stock requests.");
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "warning";
            case "approved": return "info";
            case "in_transit": return "primary";
            case "delivered": return "success";
            case "partially_delivered": return "success";
            case "cancelled": return "error";
            default: return "default";
        }
    };

    const handleMarkAsDelivered = async (id: number) => {
        try {
            await distributorService.markDelivered(id);
            fetchRequests();
            setDetailOpen(false);
        } catch (error) {
            console.error("Failed to mark as delivered", error);
            toast.error("Failed to mark as delivered.");
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                    <Box>
                        <Typography variant="h4" fontWeight={800}>Stock Requests</Typography>
                        <Typography variant="body2" color="text.secondary">Track and manage your inventory replenishment requests.</Typography>
                    </Box>
                    <Button startIcon={<RefreshIcon />} onClick={fetchRequests}>Refresh</Button>
                </Stack>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 1 }}>
                        <Table>
                            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Request #</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {requests.map((request) => (
                                    <TableRow key={request.id} hover>
                                        <TableCell sx={{ fontWeight: 600 }}>{request.request_number}</TableCell>
                                        <TableCell>{new Date(request.request_date).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={request.status.toUpperCase()}
                                                size="small"
                                                color={getStatusColor(request.status) as any}
                                                sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                            />
                                        </TableCell>
                                        <TableCell>{request.items.length} items</TableCell>
                                        <TableCell>
                                            <IconButton color="primary" onClick={() => { setSelectedRequest(request); setDetailOpen(true); }}>
                                                <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                            {request.status === 'in_transit' && (
                                                <IconButton color="success" onClick={() => handleMarkAsDelivered(request.id)}>
                                                    <CheckCircleIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {requests.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                            <Typography color="text.secondary">No stock requests found.</Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* DETAILS DIALOG */}
                <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
                    <DialogTitle sx={{ fontWeight: 800 }}>Request Details: {selectedRequest?.request_number}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Box display="flex" justifyContent="space-between">
                                <Typography color="text.secondary">Status:</Typography>
                                <Chip
                                    label={selectedRequest?.status.toUpperCase()}
                                    size="small"
                                    color={getStatusColor(selectedRequest?.status || '') as any}
                                    sx={{ fontWeight: 700 }}
                                />
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                                <Typography color="text.secondary">Request Date:</Typography>
                                <Typography fontWeight={600}>{selectedRequest && new Date(selectedRequest.request_date).toLocaleString()}</Typography>
                            </Box>
                            <Divider />
                            <Typography fontWeight={700}>Items Requested:</Typography>
                            <Stack spacing={1}>
                                {selectedRequest?.items.map((item, idx) => (
                                    <Box key={idx} p={1.5} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 2 }}>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700}>{item.product_name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{item.sku}</Typography>
                                            </Box>
                                            <Typography fontWeight={800}>Qty: {item.requested_quantity}</Typography>
                                        </Stack>
                                    </Box>
                                ))}
                            </Stack>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 3 }}>
                        <Button onClick={() => setDetailOpen(false)}>Close</Button>
                        {selectedRequest?.status === 'in_transit' && (
                            <Button variant="contained" color="success" onClick={() => handleMarkAsDelivered(selectedRequest.id)}>
                                Confirm Receipt
                            </Button>
                        )}
                    </DialogActions>
                </Dialog>
            </motion.div>
        </>
    );
}

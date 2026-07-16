"use client";
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
    Snackbar,
    Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import { StockRequest, distributorService } from "@/lib/distributor-service";
import { VisibilityIcon, CheckCircleIcon, RefreshIcon, CancelIcon } from "@/components/icons";

export default function AdminStockRequestsPage() {
    const theme = useTheme();
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

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
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: number) => {
        try {
            await distributorService.approveStockRequest(id);
            fetchRequests();
            setDetailOpen(false);
            setSnackbar({ open: true, message: 'Stock request approved successfully!', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: 'Failed to approve stock request', severity: 'error' });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "warning";
            case "approved": return "info";
            case "in_transit": return "primary";
            case "delivered": return "success";
            case "cancelled": return "error";
            default: return "default";
        }
    };

    return (
        <>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                    <Box>
                        <Typography variant="h4" fontWeight={800}>Distributor Stock Requests</Typography>
                        <Typography variant="body2" color="text.secondary">Review and approve inventory replenishment requests from distributors.</Typography>
                    </Box>
                    <Button startIcon={<RefreshIcon />} onClick={fetchRequests} variant="outlined">Refresh</Button>
                </Stack>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 1 }}>
                        <Table>
                            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Request #</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Distributor</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {requests.map((request) => (
                                    <TableRow key={request.id} hover>
                                        <TableCell sx={{ fontWeight: 700 }}>{request.request_number}</TableCell>
                                        <TableCell>{request.distributor_name}</TableCell>
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
                                        <TableCell align="right">
                                            <IconButton color="primary" onClick={() => { setSelectedRequest(request); setDetailOpen(true); }}>
                                                <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                            {request.status === 'pending' && (
                                                <IconButton color="success" onClick={() => handleApprove(request.id)}>
                                                    <CheckCircleIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {requests.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                            <Typography color="text.secondary">No stock requests pending.</Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* DETAILS DIALOG */}
                <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
                    <DialogTitle sx={{ fontWeight: 800 }}>Review Request: {selectedRequest?.request_number}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Box display="flex" justifyContent="space-between">
                                <Typography color="text.secondary">Distributor:</Typography>
                                <Typography fontWeight={700}>{selectedRequest?.distributor_name}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                                <Typography color="text.secondary">Status:</Typography>
                                <Chip
                                    label={selectedRequest?.status.toUpperCase()}
                                    size="small"
                                    color={getStatusColor(selectedRequest?.status || '') as any}
                                    sx={{ fontWeight: 700 }}
                                />
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
                        {selectedRequest?.status === 'pending' && (
                            <Button variant="contained" color="success" onClick={() => handleApprove(selectedRequest.id)} startIcon={<CheckCircleIcon />}>
                                Approve Request
                            </Button>
                        )}
                    </DialogActions>
                </Dialog>
            </motion.div>
        </>
    );
}

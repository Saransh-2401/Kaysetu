"use client";
import React, { useState, useMemo, useEffect } from "react";
import {
    Box,
    Typography,
    Button,
    Stack,
    TextField,
    InputAdornment,
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
    MenuItem,
    Select,
    Autocomplete,
    Avatar,
    Card,
    CardContent,
    Divider,
} from "@mui/material";
import { motion } from "framer-motion";
import Link from "next/link";

// Icons
import { SearchIcon, CloseIcon, ShoppingBagIcon, DeleteOutlineIcon, HistoryIcon } from "@/components/icons";

// Types
import { MaterialRequest, MaterialRequestItem, Supplier } from "@/lib/purchase-service";
import { Item } from "@/lib/warehouse-service";
import { UserProfile } from "@/lib/auth-service";

interface MaterialRequisitionModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    request?: Partial<MaterialRequest> | null;
    isViewOnly?: boolean;
    currentUser: UserProfile | null;
    rawMaterials: Item[];
    suppliers: Supplier[];
    saving: boolean;
}

export default function MaterialRequisitionModal({
    open,
    onClose,
    onSave,
    request,
    isViewOnly = false,
    currentUser,
    rawMaterials,
    suppliers,
    saving
}: MaterialRequisitionModalProps) {
    const theme = useTheme();
    const [currentRequest, setCurrentRequest] = useState<Partial<MaterialRequest>>({});
    const [requestItems, setRequestItems] = useState<Partial<MaterialRequestItem>[]>([]);

    useEffect(() => {
        if (open) {
            if (request) {
                setCurrentRequest({ ...request });
                setRequestItems(request.items || []);
            } else {
                setCurrentRequest({
                    request_status: "draft",
                    total_amount: 0,
                    department: currentUser?.role === 'purchase_manager' ? 'Procurement' :
                        currentUser?.role === 'production_manager' ? 'Production' : 'Operations'
                });
                setRequestItems([]);
            }
        }
    }, [open, request, currentUser]);

    const canViewFullFields = useMemo(() => {
        if (!currentUser) return false;
        return ["admin", "purchase_manager", "accounts_officer", "warehouse_manager"].includes(currentUser.role);
    }, [currentUser]);

    const canEdit = useMemo(() => {
        if (!currentRequest.id) return true; // New requests
        if (currentUser?.role === 'admin') return true;
        if (currentUser?.role === 'production_manager') return currentRequest.request_status === 'draft';
        if (currentUser?.role === 'purchase_manager') return ['draft', 'pending_approval'].includes(currentRequest.request_status || '');
        if (currentUser?.role === 'accounts_officer') return ['sent_to_accounts', 'approved'].includes(currentRequest.request_status || '');
        return false;
    }, [currentUser, currentRequest]);

    const totalCalculated = useMemo(() => {
        return Math.round(requestItems.reduce((sum, item) => {
            const qty = typeof item.quantity === 'string' ? parseFloat(item.quantity) : (item.quantity || 0);
            const rate = typeof item.estimated_rate === 'string' ? parseFloat(item.estimated_rate) : (item.estimated_rate || 0);
            return sum + Math.round(qty * rate * 100) / 100;
        }, 0) * 100) / 100;
    }, [requestItems]);

    const handleAddRawMaterial = (item: Item) => {
        const exists = requestItems.find(ri => ri.item === item.id);
        if (exists) return;

        setRequestItems([
            ...requestItems,
            {
                item: item.id,
                item_name: item.item_name,
                item_code: item.item_code,
                quantity: 1,
                uom: item.uom,
                estimated_rate: Number(item.standard_rate) || Number(item.valuation_rate) || 0,
                supplier: undefined,
                specification: ""
            }
        ]);
    };

    const handleRemoveItem = (index: number) => {
        setRequestItems(requestItems.filter((_, i) => i !== index));
    };

    const updateItemField = (index: number, field: keyof MaterialRequestItem, value: any) => {
        const updated = [...requestItems];
        updated[index] = { ...updated[index], [field]: value };
        setRequestItems(updated);
    };

    const handleFormSubmit = () => {
        const isProductionManager = currentUser?.role === 'production_manager';
        const isPurchaseManager = currentUser?.role === 'purchase_manager' || currentUser?.role === 'admin';

        const payload: any = {
            ...currentRequest,
            items: requestItems.map(item => ({
                ...item,
                quantity: Math.round(parseFloat((item.quantity || 0).toString()) * 1000) / 1000,
                estimated_rate: Math.round(parseFloat((item.estimated_rate || 0).toString()) * 100) / 100
            })),
            total_amount: Math.round(totalCalculated * 100) / 100
        };

        // Automatic Status Assignment for NEW requests
        if (!currentRequest.id) {
            if (isProductionManager) {
                payload.request_status = 'pending_approval';
            } else if (isPurchaseManager) {
                payload.request_status = 'sent_to_accounts';
            }
        }

        onSave(payload);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            scroll="paper"
            PaperProps={{ sx: { borderRadius: 1, p: 0.5, overflow: 'hidden', boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)' } }}
        >
            <DialogTitle sx={{ p: { xs: 2, md: 4 }, pb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={{ xs: 1.5, md: 2 }} alignItems="center">
                        <Avatar sx={{
                            bgcolor: alpha(theme.palette.secondary.main, 0.1),
                            color: theme.palette.secondary.main,
                            width: { xs: 40, md: 50 },
                            height: { xs: 40, md: 50 }
                        }}>
                            <ShoppingBagIcon sx={{ fontSize: { xs: 20, md: 28 } }} />
                        </Avatar>
                        <Box>
                            <Typography variant="h5" fontWeight={900} color="text.primary" sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                                {isViewOnly ? "View Requisition" : (currentRequest.id ? "Edit Requisition" : "New Requisition")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mt: 0.2 }}>
                                {currentRequest.request_number || "Draft Request"}
                                {currentRequest.purchase_orders_details && currentRequest.purchase_orders_details.length > 0 && (
                                    <Box component="span" sx={{ ml: 1, color: 'primary.main', fontWeight: 900 }}>
                                        [{currentRequest.purchase_orders_details.map((po, index) => (
                                            <React.Fragment key={po.po_number}>
                                                <Link href={`/purchase-orders?view_po=${po.po_number}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                    <Box component="span" sx={{ '&:hover': { textDecoration: 'underline' }, cursor: 'pointer' }}>
                                                        {po.po_number}
                                                    </Box>
                                                </Link>
                                                {index < (currentRequest.purchase_orders_details?.length || 0) - 1 ? ", " : ""}
                                            </React.Fragment>
                                        ))}]
                                    </Box>
                                )}
                            </Typography>
                        </Box>
                    </Stack>
                    <IconButton onClick={onClose} size="small" sx={{
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                        color: theme.palette.error.main,
                        '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.16) }
                    }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ pt: 2, overflowY: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
                <Grid container spacing={4}>
                    {/* Reason / Purpose + Priority. Purpose hides in view mode when
                        empty; Priority always shows so blocking MRs are flagged. */}
                    <Grid size={{ xs: 12 }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
                            {((!isViewOnly && canEdit) || currentRequest.purpose) && (
                                <TextField
                                    label="Reason / Purpose"
                                    fullWidth
                                    multiline
                                    rows={2}
                                    placeholder="Why is this material needed? (production batch ref, urgency reason, etc.)"
                                    value={currentRequest.purpose || ""}
                                    disabled={!canEdit || isViewOnly}
                                    onChange={(e) => setCurrentRequest({ ...currentRequest, purpose: e.target.value })}
                                    slotProps={{ htmlInput: { maxLength: 500, "data-testid": "mr-purpose-input" } as any }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: 'background.paper' } }}
                                />
                            )}
                            <TextField
                                select
                                label="Priority"
                                value={currentRequest.priority || 'medium'}
                                disabled={!canEdit || isViewOnly}
                                onChange={(e) => setCurrentRequest({ ...currentRequest, priority: e.target.value as any })}
                                data-testid="mr-priority-input"
                                sx={{ minWidth: { xs: '100%', md: 200 }, '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: 'background.paper' } }}
                            >
                                <MenuItem value="low">Low</MenuItem>
                                <MenuItem value="medium">Medium</MenuItem>
                                <MenuItem value="high">High</MenuItem>
                                <MenuItem value="critical">Critical</MenuItem>
                            </TextField>
                        </Stack>
                    </Grid>

                    {/* Search Field */}
                    {canEdit && !isViewOnly && (
                        <Grid size={{ xs: 12 }}>
                            <Autocomplete
                                options={rawMaterials}
                                getOptionLabel={(option) => `${option.item_name} (${option.item_code})`}
                                onChange={(e, val) => val && handleAddRawMaterial(val)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Search & Add Items"
                                        variant="outlined"
                                        placeholder="Type item name or code..."
                                        sx={{
                                            '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: 'background.paper' },
                                            '& .MuiInputLabel-root': { fontWeight: 700 }
                                        }}
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon color="secondary" sx={{ mr: 1 }} />
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                )}
                                sx={{ mt: 1 }}
                            />
                        </Grid>
                    )}

                    <Grid size={{ xs: 12 }}>
                        <TableContainer sx={{
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.divider}`,
                            bgcolor: 'background.paper',
                            maxHeight: 500,
                            overflow: 'auto',
                        }}>
                            <Table size="small" stickyHeader>
                                <TableHead sx={{ bgcolor: 'action.hover' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 800, py: 3, color: 'text.secondary', pl: 4 }}>MATERIAL</TableCell>
                                        <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }} width={180}>QTY</TableCell>
                                        {canViewFullFields && (
                                            <>
                                                <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }} width={180}>EST. RATE</TableCell>
                                                <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>PREFERRED SUPPLIER</TableCell>
                                                <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>SUBTOTAL</TableCell>
                                            </>
                                        )}
                                        <TableCell align="center" width={60}></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {requestItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={canViewFullFields ? 6 : 3} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                                                <Box sx={{ opacity: 0.5, textAlign: 'center' }}>
                                                    <ShoppingBagIcon sx={{ fontSize: 48, mb: 1, color: 'text.disabled' }} />
                                                    <Typography variant="body2" fontWeight={600}>No items added yet</Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : requestItems.map((item, index) => (
                                        <TableRow key={index} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                            <TableCell sx={{ py: 3, pl: 4 }}>
                                                <Typography variant="body1" fontWeight={800} color="text.primary">{item.item_name}</Typography>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>{item.item_code}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    value={item.quantity}
                                                    disabled={!canEdit || isViewOnly}
                                                    InputProps={{
                                                        endAdornment: <InputAdornment position="end" sx={{ fontSize: '0.85rem', fontWeight: 900, color: 'text.secondary', pr: 1 }}>{item.uom}</InputAdornment>,
                                                        disableUnderline: false,
                                                    }}
                                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                                                    onKeyDown={(e) => {
                                                        if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                                        updateItemField(index, "quantity", val);
                                                    }}
                                                    variant="standard"
                                                    sx={{
                                                        '& .MuiInput-input': { fontWeight: 700, fontSize: '1.1rem', py: 1 },
                                                        '& .MuiInput-underline:before': { borderBottomColor: theme.palette.divider },
                                                        '& .MuiInput-underline:after': { borderBottomColor: theme.palette.warning.main }
                                                    }}
                                                />
                                            </TableCell>
                                            {canViewFullFields && (
                                                <>
                                                    <TableCell>
                                                        {(() => {
                                                            const rateZero = !item.estimated_rate || parseFloat(String(item.estimated_rate)) <= 0;
                                                            const showWarn = canEdit && !isViewOnly && rateZero;
                                                            return (
                                                                <TextField
                                                                    size="small"
                                                                    fullWidth
                                                                    value={item.estimated_rate}
                                                                    disabled={!canEdit || isViewOnly}
                                                                    error={showWarn}
                                                                    helperText={showWarn ? '₹0 — set a rate' : ''}
                                                                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                        updateItemField(index, "estimated_rate", val);
                                                                    }}
                                                                    variant="standard"
                                                                    sx={{ '& .MuiInput-input': { fontWeight: 700 }, '& .MuiFormHelperText-root': { fontSize: '0.6rem', mt: 0, whiteSpace: 'nowrap' } }}
                                                                />
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            fullWidth
                                                            size="small"
                                                            value={item.supplier || ""}
                                                            variant="standard"
                                                            displayEmpty
                                                            disabled={!canEdit || isViewOnly}
                                                            onChange={(e) => updateItemField(index, "supplier", e.target.value)}
                                                            sx={{ fontWeight: 600 }}
                                                            renderValue={(selected) => {
                                                                const filteredCount = suppliers.filter(s => item.item && s.supplied_items?.includes(item.item)).length;
                                                                if (!selected) {
                                                                    return (
                                                                        <Typography variant="body2" color={filteredCount === 0 ? "error" : "text.secondary"} fontWeight={600}>
                                                                            {filteredCount === 0 ? "No Supplier Linked" : "Select Supplier"}
                                                                        </Typography>
                                                                    );
                                                                }
                                                                const supplier = suppliers.find(s => s.id === selected);
                                                                return supplier ? supplier.supplier_name : "";
                                                            }}
                                                        >
                                                            {suppliers.filter(s => item.item && s.supplied_items?.includes(item.item)).length > 0 ? (
                                                                suppliers
                                                                    .filter(s => item.item && s.supplied_items?.includes(item.item))
                                                                    .map(s => (
                                                                        <MenuItem key={s.id} value={s.id}>
                                                                            <Box>
                                                                                <Typography variant="body2" fontWeight={600} lineHeight={1.2}>{s.supplier_name}</Typography>
                                                                                {s.business_name && (
                                                                                    <Typography variant="caption" color="text.secondary" lineHeight={1.2}>{s.business_name}</Typography>
                                                                                )}
                                                                            </Box>
                                                                        </MenuItem>
                                                                    ))
                                                            ) : (
                                                                <MenuItem disabled>
                                                                    <Typography variant="caption" color="error" fontWeight={700}>
                                                                        No registered suppliers for this item
                                                                    </Typography>
                                                                </MenuItem>
                                                            )}
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography fontWeight={900} color="secondary.main">
                                                            ₹{((item.quantity || 0) * (item.estimated_rate || 0)).toLocaleString()}
                                                        </Typography>
                                                    </TableCell>
                                                </>
                                            )}
                                            <TableCell align="center">
                                                {canEdit && !isViewOnly && (
                                                    <IconButton onClick={() => handleRemoveItem(index)} sx={{ color: theme.palette.error.main }} size="small">
                                                        <DeleteOutlineIcon />
                                                    </IconButton>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>

                    {/* Logs Selection */}
                    {currentRequest.id && isViewOnly && (
                        <Grid size={{ xs: 12 }}>
                            <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                                <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: 'background.paper', border: `1px dashed ${theme.palette.divider}` }}>
                                    <CardContent>
                                        <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                                            <HistoryIcon color="secondary" fontSize="small" />
                                            <Typography variant="subtitle2" color="secondary" fontWeight={900}>Activity Timeline</Typography>
                                        </Box>
                                        <Stack spacing={0}>
                                            {(currentRequest.status_history || []).length === 0 ? (
                                                <Box sx={{ py: 4, textAlign: 'center' }}>
                                                    <Typography variant="body2" color="text.secondary" fontWeight={600}>No activity logs yet.</Typography>
                                                </Box>
                                            ) : (
                                                (currentRequest.status_history || []).slice().reverse().map((log: any, idx: number, arr: any[]) => (
                                                    <Box key={idx} sx={{ display: 'flex', gap: 2.5, position: 'relative' }}>
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Box sx={{
                                                                width: 14,
                                                                height: 14,
                                                                borderRadius: '50%',
                                                                bgcolor: idx === 0 ? 'secondary.main' : theme.palette.action.disabledBackground,
                                                                mt: 0.5,
                                                                border: `3px solid ${theme.palette.background.paper}`,
                                                                boxShadow: `0 0 0 1px ${idx === 0 ? theme.palette.secondary.main : theme.palette.divider}`,
                                                                zIndex: 1
                                                            }} />
                                                            {idx < arr.length - 1 && (
                                                                <Box sx={{ width: 2, flexGrow: 1, bgcolor: theme.palette.divider, my: 0.2 }} />
                                                            )}
                                                        </Box>

                                                        <Box sx={{ flex: 1, pb: idx < arr.length - 1 ? 3 : 0 }}>
                                                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                                                                <Typography variant="body2" fontWeight={800} color={idx === 0 ? "secondary" : "text.primary"}>
                                                                    {log.status?.replace(/_/g, ' ').toUpperCase()}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" fontWeight={800}>
                                                                    {new Date(log.timestamp).toLocaleString('en-IN', {
                                                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
                                                                    })}
                                                                </Typography>
                                                            </Stack>
                                                            <Typography variant="caption" color="text.secondary" fontWeight={600} component="div" sx={{ mt: 0.5 }}>
                                                                By <b>{log.user}</b> {log.notes && `• ${log.notes}`}
                                                                {/* Inject PO numbers into timeline if applicable */}
                                                                {log.status === 'po_generated' && currentRequest.purchase_orders_details && currentRequest.purchase_orders_details.length > 0 && (
                                                                    <Box sx={{ mt: 1, p: 1, bgcolor: alpha(theme.palette.primary.main, 0.05), borderLeft: `3px solid ${theme.palette.primary.main}`, borderRadius: '0 4px 4px 0' }}>
                                                                        <Typography variant="caption" color="primary.main" fontWeight={800} display="block">
                                                                            Generated Orders: {currentRequest.purchase_orders_details.map((po, index) => (
                                                                                <React.Fragment key={po.id}>
                                                                                    <Link href={`/purchase-orders?view_po=${po.po_number}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                                                        <Box component="span" sx={{ '&:hover': { textDecoration: 'underline' } }}>{po.po_number}</Box>
                                                                                    </Link>
                                                                                    {index < (currentRequest.purchase_orders_details?.length || 0) - 1 ? ", " : ""}
                                                                                </React.Fragment>
                                                                            ))}
                                                                        </Typography>
                                                                    </Box>
                                                                )}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ))
                                            )}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Box>
                        </Grid>
                    )}
                </Grid>
            </DialogContent>

            <DialogActions sx={{
                p: { xs: 2, md: 4 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', sm: 'center' },
                gap: 3
            }}>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    justifyContent: { xs: 'center', sm: 'flex-start' }
                }}>
                    {canViewFullFields && (
                        <>
                            <Typography variant="overline" color="text.secondary" fontWeight={900}>Grand Total:</Typography>
                            <Typography variant="h5" fontWeight={900} color="secondary.main">₹{totalCalculated.toLocaleString()}</Typography>
                        </>
                    )}
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        sx={{
                            fontWeight: 800,
                            px: 4,
                            py: 1.2,
                            borderRadius: 2,
                            bgcolor: theme.palette.action.hover,
                            color: 'text.primary',
                            borderColor: 'transparent',
                            whiteSpace: 'nowrap',
                            '&:hover': { bgcolor: theme.palette.action.selected, borderColor: 'transparent' }
                        }}
                    >
                        {(canEdit && !isViewOnly) ? "Cancel" : "Close Window"}
                    </Button>
                    {canEdit && !isViewOnly && (
                        <Button
                            variant="contained"
                            onClick={handleFormSubmit}
                            disabled={saving || requestItems.length === 0}
                            sx={{
                                px: 5,
                                py: 1.2,
                                borderRadius: 2,
                                fontWeight: 900,
                                fontSize: '0.95rem',
                                whiteSpace: 'nowrap',
                                boxShadow: `0 4px 12px ${alpha(theme.palette.warning.main, 0.2)}`,
                                background: `linear-gradient(135deg, ${theme.palette.warning.light}, ${theme.palette.warning.main})`,
                                '&:hover': {
                                    background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
                                },
                            }}
                        >
                            {saving ? <CircularProgress size={24} color="inherit" /> : (currentRequest.id ? "Update Requisition" : "Submit Material Request")}
                        </Button>
                    )}
                </Stack>
            </DialogActions>
        </Dialog>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    Typography,
    IconButton,
    Box,
    alpha,
    useTheme,
    Alert,
    CircularProgress,
    Stack,
    MenuItem,
    InputAdornment,
    Avatar,
    Chip,
} from "@mui/material";
import { CloseIcon, TrendingUpIcon, EventAvailableIcon, ShoppingBagIcon, MonetizationOnIcon, PersonAddIcon, AccessTimeIcon, InventoryIcon } from "@/components/icons";
import { apiClient } from "../../lib/api-client";

interface SetTargetModalProps {
    open: boolean;
    onClose: () => void;
    agentId: number | null;
    agentName: string;
}

export default function SetTargetModal({
    open,
    onClose,
    agentId,
    agentName,
}: SetTargetModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());

    const [formData, setFormData] = useState({
        visit_target: 0,
        order_target: 0,
        stock_request_target: 0,
        revenue_target: 0,
        stock_request_revenue_target: 0,
        new_client_target: 0,
        login_hours_target: 0,
    });

    // Pincodes
    const [availablePincodes, setAvailablePincodes] = useState<string[]>([]);
    const [selectedPincodes, setSelectedPincodes] = useState<string[]>([]);

    const MONTHS = [
        { value: 1, label: "January" }, { value: 2, label: "February" },
        { value: 3, label: "March" }, { value: 4, label: "April" },
        { value: 5, label: "May" }, { value: 6, label: "June" },
        { value: 7, label: "July" }, { value: 8, label: "August" },
        { value: 9, label: "September" }, { value: 10, label: "October" },
        { value: 11, label: "November" }, { value: 12, label: "December" },
    ];

    const YEARS = [today.getFullYear(), today.getFullYear() + 1];

    useEffect(() => {
        if (open && agentId) {
            fetchExistingTarget();
            fetchManagerPincodes();
        }
    }, [open, agentId, month, year]);

    const fetchManagerPincodes = async () => {
        try {
            // Fetch agent details to get their manager
            const agentRes: any = await apiClient.get(`/auth/users/${agentId}/`);
            const managerId = agentRes.assigned_to;
            if (managerId) {
                const mgrRes: any = await apiClient.get(`/auth/users/${managerId}/`);
                const pincodes = (mgrRes.operating_pincodes || []).map(String);
                setAvailablePincodes(pincodes);
            } else {
                setAvailablePincodes([]);
            }
        } catch (e) {
            console.error("Failed to fetch manager pincodes", e);
            setAvailablePincodes([]);
        }
    };

    const fetchExistingTarget = async () => {
        try {
            setFetching(true);
            setError(null);
            const response: any = await apiClient.get(`/field-sales/targets/`, {
                agent: String(agentId),
                month: String(month),
                year: String(year)
            });

            if (response && response.count > 0) {
                const target = response.results[0];
                setFormData({
                    visit_target: target.visit_target,
                    order_target: target.order_target,
                    stock_request_target: target.stock_request_target || 0,
                    revenue_target: target.revenue_target,
                    stock_request_revenue_target: target.stock_request_revenue_target || 0,
                    new_client_target: target.new_client_target,
                    login_hours_target: target.login_hours_target,
                });
                setSelectedPincodes(target.pincodes || []);
            } else {
                setFormData({
                    visit_target: 0, order_target: 0, stock_request_target: 0,
                    revenue_target: 0, stock_request_revenue_target: 0,
                    new_client_target: 0, login_hours_target: 0,
                });
                setSelectedPincodes([]);
            }
        } catch (err) {
            console.error("Failed to fetch existing target:", err);
        } finally {
            setFetching(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            setError(null);

            const existingResponse: any = await apiClient.get(`/field-sales/targets/`, {
                agent: String(agentId),
                month: String(month),
                year: String(year)
            });

            const payload = {
                agent: agentId,
                month,
                year,
                ...formData,
                pincodes: selectedPincodes,
            };

            if (existingResponse && existingResponse.count > 0) {
                await apiClient.patch(`/field-sales/targets/${existingResponse.results[0].id}/`, payload);
            } else {
                await apiClient.post(`/field-sales/targets/`, payload);
            }

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 1500);
        } catch (err: any) {
            setError(err.message || "Failed to set target");
        } finally {
            setLoading(false);
        }
    };

    // Row 1: 4 fields, Row 2: 3 fields
    const targetFieldsRow1 = [
        { key: "visit_target", label: "Visits", icon: <EventAvailableIcon color="action" fontSize="small" />, max: 999 },
        { key: "stock_request_target", label: "Primary Orders", icon: <InventoryIcon color="action" fontSize="small" />, max: 999 },
        { key: "order_target", label: "Secondary Orders", icon: <ShoppingBagIcon color="action" fontSize="small" />, max: 999 },
        { key: "stock_request_revenue_target", label: "Primary Revenue", icon: <MonetizationOnIcon color="action" fontSize="small" />, max: 9999999 },
    ];
    const targetFieldsRow2 = [
        { key: "revenue_target", label: "Secondary Revenue", icon: <MonetizationOnIcon color="action" fontSize="small" />, max: 9999999 },
        { key: "new_client_target", label: "New Clients", icon: <PersonAddIcon color="action" fontSize="small" />, max: 999 },
        { key: "login_hours_target", label: "Login Hours", icon: <AccessTimeIcon color="action" fontSize="small" />, max: 999 },
    ];

    const handleTargetChange = (key: string, value: string, max: number) => {
        const intVal = parseInt(value, 10);
        if (value === "" || value === "0") {
            setFormData({ ...formData, [key]: 0 });
            return;
        }
        if (isNaN(intVal) || intVal < 0) return;
        if (intVal > max) return;
        setFormData({ ...formData, [key]: intVal });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { borderRadius: 3, boxShadow: "0 24px 80px rgba(0,0,0,0.15)" } }}
        >
            <DialogTitle
                sx={{
                    p: 3,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main" }}>
                        <TrendingUpIcon />
                    </Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight={800}>Monthly Targets</Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Setting objectives for {agentName}
                        </Typography>
                    </Box>
                </Stack>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 4 }}>
                {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>Targets saved successfully!</Alert>}

                <Grid container spacing={3}>
                    {/* Period Selector */}
                    <Grid size={{ xs: 6 }}>
                        <TextField select fullWidth label="Month" value={month}
                            onChange={(e) => setMonth(Number(e.target.value))} variant="outlined">
                            {MONTHS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextField select fullWidth label="Year" value={year}
                            onChange={(e) => setYear(Number(e.target.value))} variant="outlined">
                            {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                        </TextField>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" fontWeight={800} color="primary" sx={{ letterSpacing: 1, textTransform: 'uppercase', mt: 1 }}>
                            Performance Metrics
                        </Typography>
                    </Grid>

                    {/* Target Fields — Row 1: 4 fields */}
                    {targetFieldsRow1.map(field => (
                        <Grid size={{ xs: 6, sm: 3 }} key={field.key}>
                            <TextField
                                fullWidth
                                label={field.label}
                                value={(formData as any)[field.key] || ""}
                                onChange={(e) => handleTargetChange(field.key, e.target.value, field.max)}
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start">{field.icon}</InputAdornment>,
                                        inputProps: { inputMode: "numeric", pattern: "[0-9]*" },
                                    }
                                }}
                            />
                        </Grid>
                    ))}
                    {/* Target Fields — Row 2: 3 fields */}
                    {targetFieldsRow2.map(field => (
                        <Grid size={{ xs: 6, sm: 4 }} key={field.key}>
                            <TextField
                                fullWidth
                                label={field.label}
                                value={(formData as any)[field.key] || ""}
                                onChange={(e) => handleTargetChange(field.key, e.target.value, field.max)}
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start">{field.icon}</InputAdornment>,
                                        inputProps: { inputMode: "numeric", pattern: "[0-9]*" },
                                    }
                                }}
                            />
                        </Grid>
                    ))}

                    {/* Pincode selector */}
                    {availablePincodes.length > 0 && (
                        <Grid size={{ xs: 12 }}>
                            <Typography variant="subtitle2" fontWeight={800} color="primary" sx={{ letterSpacing: 1, textTransform: 'uppercase', mt: 1, mb: 1.5 }}>
                                Territory Pincodes
                            </Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                {availablePincodes.map(pin => {
                                    const isSelected = selectedPincodes.includes(pin);
                                    return (
                                        <Chip
                                            key={pin}
                                            label={pin}
                                            clickable
                                            onClick={() => {
                                                setSelectedPincodes(prev =>
                                                    isSelected ? prev.filter(p => p !== pin) : [...prev, pin]
                                                );
                                            }}
                                            color={isSelected ? "primary" : "default"}
                                            variant={isSelected ? "filled" : "outlined"}
                                            sx={{ fontWeight: 700, borderRadius: "8px" }}
                                        />
                                    );
                                })}
                            </Box>
                        </Grid>
                    )}
                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 3, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                <Button onClick={onClose} sx={{ fontWeight: 700 }}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={loading || fetching}
                    sx={{
                        px: 4, borderRadius: 2, fontWeight: 800, textTransform: "none",
                        boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
                    }}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Save Target"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

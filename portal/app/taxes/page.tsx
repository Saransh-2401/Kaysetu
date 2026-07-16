"use client";
import React, { useState, useEffect } from "react";
import {
    Box,
    Paper,
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
    Avatar,
    Chip,
    Switch,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useTheme,
    alpha,
    CircularProgress,
    Tooltip,
    Snackbar,
    Alert,
    Divider,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

import { SearchIcon, AddIcon, EditTwoToneIcon, DeleteTwoToneIcon, CloseIcon, RefreshIcon, ReceiptIcon, WarningAmberIcon } from "@/components/icons";

import { mastersService, TaxSlab } from "@/lib/masters-service";

export default function TaxesMasterPage() {
    const theme = useTheme();
    const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [saving, setSaving] = useState(false);

    // Dialog states
    const [openDialog, setOpenDialog] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<TaxSlab>>({
        name: "",
        percentage: 0,
        hsn_codes: [],
        description: "",
        is_active: true,
    });
    const [hsnInput, setHsnInput] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<TaxSlab | null>(null);

    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info" | "warning";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    const fetchTaxSlabs = async () => {
        try {
            setLoading(true);
            const response = await mastersService.getTaxSlabs();
            setTaxSlabs(response.results || []);
        } catch (error) {
            console.error("Failed to fetch tax slabs:", error);
            showSnackbar("Failed to load taxes", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTaxSlabs();
    }, []);

    const showSnackbar = (message: string, severity: "success" | "error" | "info" | "warning") => {
        setSnackbar({ open: true, message, severity });
    };

    const handleOpenAdd = () => {
        setCurrentItem({
            name: "",
            percentage: 0,
            hsn_codes: [],
            description: "",
            is_active: true,
        });
        setHsnInput("");
        setErrors({});
        setOpenDialog(true);
    };

    const handleOpenEdit = (item: TaxSlab) => {
        setCurrentItem(item);
        setHsnInput("");
        setErrors({});
        setOpenDialog(true);
    };

    const handleToggleStatus = async (tax: TaxSlab) => {
        const next = !tax.is_active;
        // Optimistic update
        setTaxSlabs((prev) => prev.map((t) => (t.id === tax.id ? { ...t, is_active: next } : t)));
        try {
            await mastersService.updateTaxSlab(tax.id, { is_active: next });
            showSnackbar(`"${tax.name}" marked ${next ? "Active" : "Inactive"}`, "success");
        } catch (error) {
            // Revert on failure
            setTaxSlabs((prev) => prev.map((t) => (t.id === tax.id ? { ...t, is_active: tax.is_active } : t)));
            showSnackbar("Failed to update tax status", "error");
        }
    };

    const handleAddHsn = () => {
        const code = hsnInput.trim();
        if (!code) return;

        // Simple validation: 4-8 digits (usually 6 or 8)
        if (!/^\d{4,8}$/.test(code)) {
            setErrors((prev: Record<string, string>) => ({ ...prev, hsn: "Enter valid 4-8 digit HSN" }));
            return;
        }

        // Check if already in current list
        if (currentItem.hsn_codes?.includes(code)) {
            setErrors((prev: Record<string, string>) => ({ ...prev, hsn: "Already added to this slab" }));
            return;
        }

        // Requirement 3: One HSN code can lie under one tax slab.
        // Check if this HSN is already in any other tax slab
        const existingSlab = taxSlabs.find(slab =>
            slab.id !== currentItem.id && slab.hsn_codes.includes(code)
        );

        if (existingSlab) {
            setErrors((prev: Record<string, string>) => ({
                ...prev,
                hsn: `Already associated with '${existingSlab.name}'`
            }));
            return;
        }

        setCurrentItem((prev: Partial<TaxSlab>) => ({
            ...prev,
            hsn_codes: [...(prev.hsn_codes || []), code]
        }));
        setHsnInput("");
        setErrors((prev: Record<string, string>) => {
            const { hsn, ...rest } = prev;
            return rest;
        });
    };

    const handleRemoveHsn = (code: string) => {
        setCurrentItem((prev: Partial<TaxSlab>) => ({
            ...prev,
            hsn_codes: prev.hsn_codes?.filter((c: string) => c !== code)
        }));
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!currentItem.name?.trim()) newErrors.name = "Name is required";

        if (currentItem.percentage === undefined || isNaN(currentItem.percentage)) {
            newErrors.percentage = "Percentage is mandatory";
        } else if (currentItem.percentage < 0 || currentItem.percentage > 100) {
            newErrors.percentage = "Percentage must be between 0 and 100";
        }

        if (!currentItem.hsn_codes || currentItem.hsn_codes.length === 0) {
            newErrors.hsn = "At least one HSN code is mandatory";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        try {
            setSaving(true);
            if (currentItem.id) {
                await mastersService.updateTaxSlab(currentItem.id, currentItem);
                showSnackbar("Tax updated successfully", "success");
            } else {
                await mastersService.createTaxSlab(currentItem);
                showSnackbar("Tax added successfully", "success");
            }
            setOpenDialog(false);
            fetchTaxSlabs();
        } catch (error: any) {
            console.error("Save failed:", error);
            const apiError = error.response?.data;
            if (apiError && typeof apiError === 'object') {
                // If backend returns validation errors, show them
                const errorMsg = Object.values(apiError).flat().join(", ");
                showSnackbar(errorMsg || "Failed to save tax", "error");
            } else {
                showSnackbar("Failed to save tax", "error");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await mastersService.deleteTaxSlab(itemToDelete.id);
            showSnackbar("Tax deleted successfully", "success");
            setDeleteDialogOpen(false);
            fetchTaxSlabs();
        } catch (error) {
            showSnackbar("Failed to delete tax", "error");
        }
    };

    const filteredTaxes = taxSlabs.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.hsn_codes.some((code: string) => code.includes(searchQuery))
    );

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 4 } }}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                    <Box>
                        <Typography variant="h4" fontWeight={800} sx={{ color: "text.primary", mb: 0.5 }}>
                            Taxes
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Manage tax slabs and associated HSN codes
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenAdd}
                        sx={{
                            borderRadius: 2,
                            px: 3,
                            py: 1,
                            textTransform: "none",
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                            boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
                        }}
                    >
                        Add Tax
                    </Button>
                </Stack>

                {/* Toolbar */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        mb: 3,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.background.paper, 0.4),
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        backdropFilter: "blur(10px)",
                    }}
                >
                    <Stack direction="row" spacing={2} alignItems="center">
                        <TextField
                            size="small"
                            placeholder="Search taxes, HSN codes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            sx={{ flexGrow: 1 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: 2 },
                            }}
                        />
                        <IconButton onClick={fetchTaxSlabs}>
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                </Paper>

                {/* Table */}
                <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        overflow: "hidden",
                    }}
                >
                    <Table>
                        <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Tax Name</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Percentage</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Associated HSN Codes</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                                        <CircularProgress size={40} thickness={4} />
                                        <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
                                            Loading tax data...
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : filteredTaxes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                                        <ReceiptIcon sx={{ fontSize: 60, color: "text.disabled", mb: 2 }} />
                                        <Typography variant="h6" color="text.secondary">
                                            No Taxes Found
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTaxes.map((tax) => (
                                    <TableRow key={tax.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700}>
                                                    {tax.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {tax.description || "No description"}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={`${tax.percentage}%`}
                                                size="small"
                                                sx={{
                                                    fontWeight: 700,
                                                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                                    color: "secondary.main",
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                                {tax.hsn_codes.map((code: string) => (
                                                    <Chip key={code} label={code} size="small" variant="outlined" />
                                                ))}
                                                {tax.hsn_codes.length === 0 && (
                                                    <Typography variant="caption" color="text.disabled">None</Typography>
                                                )}
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <Tooltip title={tax.is_active ? "Click to deactivate" : "Click to activate"}>
                                                    <Switch
                                                        checked={tax.is_active}
                                                        onChange={() => handleToggleStatus(tax)}
                                                        color="success"
                                                        size="small"
                                                    />
                                                </Tooltip>
                                                <Typography
                                                    variant="caption"
                                                    fontWeight={700}
                                                    color={tax.is_active ? "success.main" : "text.disabled"}
                                                >
                                                    {tax.is_active ? "Active" : "Inactive"}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenEdit(tax)}
                                                        sx={{ color: "primary.main" }}
                                                    >
                                                        <EditTwoToneIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setItemToDelete(tax);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                        sx={{ color: "error.main" }}
                                                    >
                                                        <DeleteTwoToneIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* Add/Edit Dialog */}
            <Dialog
                open={openDialog}
                onClose={() => !saving && setOpenDialog(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 1,
                        p: 1,
                        boxShadow: "0 24px 48px rgba(0,0,0,0.15)"
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, fontSize: "1.5rem", pb: 1, pt: 3, px: 4 }}>
                    {currentItem.id ? "Edit Tax" : "Add Tax"}
                    <IconButton
                        onClick={() => setOpenDialog(false)}
                        sx={{ position: "absolute", right: 24, top: 24, color: "text.secondary" }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <Divider sx={{ mx: 4, opacity: 0.5 }} />
                <DialogContent sx={{ p: 4, pt: 3 }}>
                    <Stack spacing={3.5}>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                fullWidth
                                label="Tax Name"
                                placeholder="e.g. GST 18%"
                                value={currentItem.name}
                                onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value.slice(0, 50) })}
                                error={!!errors.name}
                                required
                                variant="outlined"
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                            />

                            <TextField
                                fullWidth
                                label="Percentage (%)"
                                type="number"
                                value={currentItem.percentage}
                                onChange={(e) => setCurrentItem({ ...currentItem, percentage: parseFloat(e.target.value) || 0 })}
                                error={!!errors.percentage}
                                helperText={errors.percentage}
                                required
                                sx={{ maxWidth: 160, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                inputProps={{ min: 0, max: 100, step: 0.01 }}
                            />
                        </Stack>

                        <Box>
                            <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ mb: 1, ml: 0.5 }}>
                                HSN Codes Mapping
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                                <TextField
                                    fullWidth
                                    placeholder="Enter 6 or 8 digit HSN"
                                    value={hsnInput}
                                    onChange={(e) => setHsnInput(e.target.value.replace(/\D/g, ""))}
                                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddHsn())}
                                    error={!!errors.hsn}
                                    helperText={errors.hsn || "Press Enter or Click Add"}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleAddHsn}
                                    sx={{
                                        borderRadius: 2,
                                        textTransform: "none",
                                        minWidth: 90,
                                        height: 56, // Match standard TextField height
                                        bgcolor: "text.primary",
                                        "&:hover": { bgcolor: "grey.900" }
                                    }}
                                >
                                    Add
                                </Button>
                            </Stack>

                            <Box sx={{
                                mt: 1.5,
                                minHeight: 64,
                                p: 2,
                                bgcolor: alpha(theme.palette.background.default, 0.5),
                                border: "1px dashed",
                                borderColor: alpha(theme.palette.divider, 0.2),
                                borderRadius: 1,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 1.5,
                                alignItems: "center"
                            }}>
                                {(currentItem.hsn_codes?.length || 0) > 0 ? (
                                    currentItem.hsn_codes?.map((code: string) => (
                                        <Chip
                                            key={code}
                                            label={code}
                                            onDelete={() => handleRemoveHsn(code)}
                                            sx={{
                                                borderRadius: "8px",
                                                fontWeight: 600,
                                                bgcolor: "background.paper",
                                                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                                                "& .MuiChip-deleteIcon": {
                                                    fontSize: "1rem",
                                                    color: "text.secondary"
                                                }
                                            }}
                                        />
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.disabled" sx={{ width: "100%", textAlign: "center", fontStyle: "italic" }}>
                                        No HSN codes linked yet.
                                    </Typography>
                                )}
                            </Box>
                        </Box>

                        <TextField
                            fullWidth
                            label="Description"
                            multiline
                            rows={4}
                            value={currentItem.description}
                            onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value.slice(0, 500) })}
                            placeholder="Detailed description of the tax slab application..."
                            helperText={`${currentItem.description?.length || 0}/500 characters`}
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 4, pt: 1, gap: 1 }}>
                    <Button
                        onClick={() => setOpenDialog(false)}
                        color="inherit"
                        sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving}
                        sx={{
                            borderRadius: 1,
                            px: 4,
                            py: 1.5,
                            fontWeight: 700,
                            textTransform: "none",
                            bgcolor: "text.primary",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                            "&:hover": { bgcolor: "grey.900" }
                        }}
                    >
                        {saving ? <CircularProgress size={24} color="inherit" /> : currentItem.id ? "Update Tax Slab" : "Create Tax Slab"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <Box sx={{ p: 3, textAlign: "center" }}>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: "error.main", width: 64, height: 64, mx: "auto", mb: 2 }}>
                        <WarningAmberIcon fontSize="large" />
                    </Avatar>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                        Delete Tax Slab?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Are you sure you want to delete <strong>{itemToDelete?.name}</strong>? This action cannot be undone.
                    </Typography>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        <Button variant="outlined" color="inherit" onClick={() => setDeleteDialogOpen(false)} fullWidth>
                            Cancel
                        </Button>
                        <Button variant="contained" color="error" onClick={handleDelete} fullWidth>
                            Delete
                        </Button>
                    </Stack>
                </Box>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: "100%", borderRadius: 2 }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
}

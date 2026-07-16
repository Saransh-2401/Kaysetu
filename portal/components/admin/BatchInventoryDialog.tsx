"use client";
import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Stack,
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    InputAdornment,
    Paper,
    Autocomplete,
    CircularProgress,
    useTheme,
    alpha,
    Divider,
} from "@mui/material";
import { SearchIcon, AddIcon, DeleteOutlineIcon, CloseIcon, InventoryIcon } from "@/components/icons";

interface BatchItem {
    id: number;
    code: string;
    name: string;
    uom: string;
    quantity: number;
    rate: number;
    total: number;
}

interface BatchInventoryDialogProps {
    open: boolean;
    onClose: () => void;
    items: any[];
    onSave: (data: {
        supplier: string;
        purchaseAmount: number;
        batchItems: BatchItem[];
    }) => void;
}

export default function BatchInventoryDialog({
    open,
    onClose,
    items,
    onSave,
}: BatchInventoryDialogProps) {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = React.useState("");
    const [supplier, setSupplier] = React.useState("");
    const [purchaseAmount, setPurchaseAmount] = React.useState(0);
    const [batchItems, setBatchItems] = React.useState<BatchItem[]>([]);
    const [saving, setSaving] = React.useState(false);

    const filteredItems = React.useMemo(() => {
        if (!searchQuery) return items;
        return items.filter(
            (item) =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.code.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const handleAddItem = (item: any) => {
        const existing = batchItems.find((b) => b.id === item.id);
        if (existing) {
            return; // Already added
        }

        setBatchItems([
            ...batchItems,
            {
                id: item.id,
                code: item.code,
                name: item.name,
                uom: item.uom,
                quantity: 1,
                rate: item.price || 0,
                total: item.price || 0,
            },
        ]);
        setSearchQuery(""); // Clear search after adding
    };

    const handleRemoveItem = (id: number) => {
        setBatchItems(batchItems.filter((item) => item.id !== id));
    };

    const handleQuantityChange = (id: number, quantity: number) => {
        setBatchItems(
            batchItems.map((item) =>
                item.id === id
                    ? { ...item, quantity, total: quantity * item.rate }
                    : item
            )
        );
    };

    const handleRateChange = (id: number, rate: number) => {
        setBatchItems(
            batchItems.map((item) =>
                item.id === id
                    ? { ...item, rate, total: item.quantity * rate }
                    : item
            )
        );
    };

    const totalAmount = React.useMemo(() => {
        return batchItems.reduce((sum, item) => sum + item.total, 0);
    }, [batchItems]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({
                supplier,
                purchaseAmount,
                batchItems,
            });
            // Reset form
            setSupplier("");
            setPurchaseAmount(0);
            setBatchItems([]);
            setSearchQuery("");
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (!saving) {
            setSupplier("");
            setPurchaseAmount(0);
            setBatchItems([]);
            setSearchQuery("");
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 1,
                    minHeight: "85vh",
                    background: theme.palette.background.paper,
                }
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: 800,
                    fontSize: "1.5rem",
                    pb: 2,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                        }}
                    >
                        <InventoryIcon sx={{ color: "white", fontSize: 28 }} />
                    </Box>
                    <Box>
                        <Typography variant="h5" fontWeight={800}>
                            Create Batch Inventory
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Update inventory quantities from supplier purchase
                        </Typography>
                    </Box>
                </Stack>
                <IconButton
                    onClick={handleClose}
                    size="small"
                    disabled={saving}
                    sx={{
                        bgcolor: alpha(theme.palette.text.primary, 0.05),
                        "&:hover": {
                            bgcolor: alpha(theme.palette.text.primary, 0.1),
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 3, px: 3 }}>
                <Stack spacing={3}>
                    {/* Supplier and Purchase Amount */}
                    <Box>
                        <Typography variant="subtitle2" fontWeight={700} mb={2} color="text.secondary">
                            Purchase Information
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Supplier Name"
                                fullWidth
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                                placeholder="Enter supplier name"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: 2,
                                    },
                                }}
                            />
                            <TextField
                                label="Total Purchase Amount"
                                type="number"
                                fullWidth
                                value={purchaseAmount}
                                onChange={(e) => setPurchaseAmount(parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                inputProps={{ min: 0, step: 0.01 }}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: 2,
                                    },
                                }}
                            />
                        </Stack>
                    </Box>

                    <Divider />

                    {/* Search Bar */}
                    <Box>
                        <Typography variant="subtitle2" fontWeight={700} mb={2} color="text.secondary">
                            Add Items to Batch
                        </Typography>
                        <Autocomplete
                            options={filteredItems}
                            getOptionLabel={(option) => `${option.code} - ${option.name}`}
                            onChange={(e, newValue) => {
                                if (newValue) {
                                    handleAddItem(newValue);
                                }
                            }}
                            renderOption={(props, option) => (
                                <Box component="li" {...props}>
                                    <Stack direction="row" spacing={2} alignItems="center" width="100%">
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 2,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                color: "primary.main",
                                                fontWeight: 800,
                                                fontSize: "0.875rem",
                                            }}
                                        >
                                            {option.code.substring(0, 2)}
                                        </Box>
                                        <Box flex={1}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {option.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {option.code} • {option.uom}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" fontWeight={700} color="primary">
                                            ₹{option.price?.toFixed(2) || "0.00"}
                                        </Typography>
                                    </Stack>
                                </Box>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Search items by name or code..."
                                    InputProps={{
                                        ...params.InputProps,
                                        startAdornment: (
                                            <>
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" sx={{ color: alpha(theme.palette.text.primary, 0.4) }} />
                                                </InputAdornment>
                                                {params.InputProps.startAdornment}
                                            </>
                                        ),
                                    }}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: "50px",
                                            bgcolor: alpha(theme.palette.text.primary, 0.03),
                                            "& fieldset": { border: "none" },
                                            "&:hover": {
                                                bgcolor: alpha(theme.palette.text.primary, 0.05),
                                            },
                                            "&.Mui-focused": {
                                                bgcolor: "transparent",
                                                boxShadow: `0 0 0 2px ${alpha(theme.palette.success.main, 0.2)}`,
                                            },
                                        },
                                    }}
                                />
                            )}
                        />
                    </Box>

                    {/* Batch Items Table */}
                    <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                                Batch Items ({batchItems.length})
                            </Typography>
                            {batchItems.length > 0 && (
                                <Typography variant="h6" fontWeight={800} color="success.main">
                                    Total: ₹{totalAmount.toFixed(2)}
                                </Typography>
                            )}
                        </Stack>

                        {batchItems.length === 0 ? (
                            <Paper
                                sx={{
                                    p: 8,
                                    textAlign: "center",
                                    bgcolor: alpha(theme.palette.background.default, 0.4),
                                    border: `2px dashed ${alpha(theme.palette.divider, 0.2)}`,
                                    borderRadius: 1,
                                }}
                            >
                                <InventoryIcon sx={{ fontSize: 64, color: alpha(theme.palette.text.primary, 0.2), mb: 2 }} />
                                <Typography variant="h6" fontWeight={700} color="text.secondary" mb={1}>
                                    No Items Added Yet
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Search and add items from your inventory above
                                </Typography>
                            </Paper>
                        ) : (
                            <TableContainer
                                component={Paper}
                                sx={{
                                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                    borderRadius: 1,
                                    boxShadow: "0px 4px 20px rgba(0,0,0,0.05)",
                                }}
                            >
                                <Table>
                                    <TableHead>
                                        <TableRow
                                            sx={{
                                                bgcolor: alpha(theme.palette.success.main, 0.05),
                                            }}
                                        >
                                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                                                ITEM CODE
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                                                ITEM NAME
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                                                UNIT
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                                                QUANTITY
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                                                RATE (₹)
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                                                TOTAL (₹)
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.5px", textAlign: "right" }}>
                                                ACTION
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {batchItems.map((item, index) => (
                                            <TableRow
                                                key={item.id}
                                                hover
                                                sx={{
                                                    "&:last-child td": { borderBottom: 0 },
                                                    bgcolor: index % 2 === 0 ? "transparent" : alpha(theme.palette.background.default, 0.3),
                                                }}
                                            >
                                                <TableCell>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={700}
                                                        sx={{
                                                            fontFamily: "monospace",
                                                            color: "primary.main",
                                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                            px: 1.5,
                                                            py: 0.5,
                                                            borderRadius: 1,
                                                            display: "inline-block",
                                                        }}
                                                    >
                                                        {item.code}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {item.name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: "text.secondary",
                                                            bgcolor: alpha(theme.palette.text.primary, 0.05),
                                                            px: 1.5,
                                                            py: 0.5,
                                                            borderRadius: 1,
                                                            display: "inline-block",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {item.uom}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        type="number"
                                                        size="small"
                                                        value={item.quantity}
                                                        onChange={(e) =>
                                                            handleQuantityChange(
                                                                item.id,
                                                                parseFloat(e.target.value) || 0
                                                            )
                                                        }
                                                        inputProps={{ min: 0, step: 0.01 }}
                                                        sx={{
                                                            width: 100,
                                                            "& .MuiOutlinedInput-root": {
                                                                borderRadius: 2,
                                                                fontWeight: 600,
                                                            },
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        type="number"
                                                        size="small"
                                                        value={item.rate}
                                                        onChange={(e) =>
                                                            handleRateChange(
                                                                item.id,
                                                                parseFloat(e.target.value) || 0
                                                            )
                                                        }
                                                        inputProps={{ min: 0, step: 0.01 }}
                                                        sx={{
                                                            width: 120,
                                                            "& .MuiOutlinedInput-root": {
                                                                borderRadius: 2,
                                                                fontWeight: 600,
                                                            },
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={800} color="success.main">
                                                        ₹{item.total.toFixed(2)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow>
                                            <TableCell colSpan={5} align="right">
                                                <Typography variant="h6" fontWeight={800}>
                                                    Grand Total:
                                                </Typography>
                                            </TableCell>
                                            <TableCell colSpan={2}>
                                                <Typography variant="h6" fontWeight={800} color="primary">
                                                    ₹{totalAmount.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Button onClick={handleClose} color="inherit" disabled={saving}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || batchItems.length === 0}
                    sx={{
                        px: 4,
                        borderRadius: 2,
                        minWidth: 140,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    }}
                >
                    {saving ? <CircularProgress size={24} color="inherit" /> : "Save Batch"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

"use client";
import React, { useState, useMemo, useEffect } from "react";
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
  Chip,
  IconButton,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  CircularProgress,
  Grid,
  MenuItem,
  Autocomplete,
  Avatar,
  Card,
  CardContent,
  Tooltip,
  Snackbar,
  Alert,
  Divider,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { SearchIcon, AddIcon, CloseIcon, EditIcon, DeleteIcon, AccountTreeIcon, ScaleIcon, InfoOutlinedIcon, Inventory2OutlinedIcon, ArrowForwardIcon, ScienceIcon, EngineeringIcon, PrecisionManufacturingIcon, PlayArrowIcon, ContentPasteIcon } from "@/components/icons";

import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";
import { productionService, BillOfMaterials, BOMItem, BOMOperation } from "@/lib/production-service";
import { warehouseService, Item, Product } from "@/lib/warehouse-service";
import { authService, UserProfile } from "@/lib/auth-service";
import { formatDRFError } from "@/lib/utils";
import { isRawMaterialCategory } from "@/lib/item-categories";

export default function BOMPage() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<Item[]>([]);
  const [workstations, setWorkstations] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [openDialog, setOpenDialog] = useState(false);
  const [currentBOM, setCurrentBOM] = useState<Partial<BillOfMaterials>>({});
  const [bomItems, setBomItems] = useState<Partial<BOMItem>[]>([]);
  const [bomOperations, setBomOperations] = useState<Partial<BOMOperation>[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: number | null; name: string }>({
    open: false,
    id: null,
    name: "",
  });

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [bomResp, prodResp, itemResp, workstationResp, userResp] = await Promise.all([
        productionService.getBOMs(),
        warehouseService.getProducts({ 
            page_size: "1000",
            is_active: "true",
            status: "active"
        }),
        warehouseService.getItems({ 
            page_size: "1000",
            is_active: "true",
            status: "active"
        }),
        productionService.getWorkstations(),
        authService.getCurrentUser()
      ]);

      setBoms(bomResp.results || []);
      setProducts(prodResp.results || []);
      setRawMaterials(itemResp.results || []);
      setWorkstations(workstationResp.results || []);
      setCurrentUser(userResp);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setSnackbar({ open: true, message: "Failed to load data", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const filteredBOMs = useMemo(() => {
    return boms.filter(b =>
      b.bom_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.item_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [boms, searchQuery]);

  const paginatedBOMs = useMemo(() => {
    return filteredBOMs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredBOMs, page, rowsPerPage]);

  const availableProducts = useMemo(() => {
    const productsWithBOM = new Set(boms.map(b => b.item));
    return products.filter(p => {
      if (currentBOM.id && p.id === currentBOM.item) return true;
      return !productsWithBOM.has(p.id);
    });
  }, [products, boms, currentBOM.id, currentBOM.item]);

  // BOM ingredients must be raw materials / components only — exclude finished goods.
  const selectableRawMaterials = useMemo(
    () => rawMaterials.filter(rm => isRawMaterialCategory(rm.category)),
    [rawMaterials]
  );

  // Pull a fresh item list so newly-added raw materials appear without a page reload.
  const refreshMaterials = async () => {
    try {
      const itemResp = await warehouseService.getItems({ page_size: "1000", is_active: "true", status: "active" });
      setRawMaterials(itemResp.results || []);
    } catch (error) {
      console.error("Failed to refresh materials:", error);
    }
  };

  const handleOpenAdd = () => {
    refreshMaterials();
    setCurrentBOM({
      bom_number: `BOM-${new Date().getTime().toString().slice(-6)}`,
      quantity: undefined, // User must specify batch size
      is_active: true,
      is_default: false,
      description: ""
    });
    setBomItems([]);
    setBomOperations([]);
    setOpenDialog(true);
  };

  const handleOpenEdit = async (bomId: number) => {
    try {
      refreshMaterials();
      const bom = await productionService.getBOM(bomId);
      setCurrentBOM(bom);
      setBomItems(bom.raw_materials || []);
      setBomOperations(bom.operations || []);
      setOpenDialog(true);
    } catch (error) {
      setSnackbar({ open: true, message: "Failed to load BOM details", severity: "error" });
    }
  };

  const handleAddOperation = () => {
    const newOp: Partial<BOMOperation> = {
      operation_name: "",
      time_in_mins: 0,
      operating_cost: 0,
    };
    setBomOperations([...bomOperations, newOp]);
  };

  const updateOperationField = (index: number, field: keyof BOMOperation, value: any) => {
    const updated = [...bomOperations];
    updated[index] = { ...updated[index], [field]: value };
    setBomOperations(updated);
  };

  const handleAddMaterial = (item: Item) => {
    const exists = bomItems.find(mi => mi.raw_material === item.id);
    if (exists) {
      setSnackbar({ open: true, message: "Material already in recipe", severity: "info" });
      return;
    }

    const newItem: Partial<BOMItem> = {
      raw_material: item.id,
      raw_material_name: item.item_name,
      raw_material_code: item.item_code,
      raw_material_unit: item.uom,
      raw_material_role: "",
      ratio_percentage: "0",
      quantity: 0,
      quantity_display: item.uom,
      rate: item.standard_rate || item.valuation_rate || 0,
    };
    setBomItems([...bomItems, newItem]);
  };

  const updateItemField = (index: number, field: keyof BOMItem, value: any) => {
    const updated = [...bomItems];
    const prevItem = updated[index];

    const newItem = { ...prevItem, [field]: value };

    // Validation: Don't allow total ratio > 100
    if (field === 'ratio_percentage') {
      const val = parseFloat(value);
      const newRatio = isNaN(val) ? 0 : val;

      const otherItemsRatio = bomItems.reduce((acc, it, i) => {
        if (i === index) return acc;
        return acc + (parseFloat(it.ratio_percentage || "0") || 0);
      }, 0);

      if (otherItemsRatio + newRatio > 100.01) {
        setSnackbar({ open: true, message: "Total recipe ratio cannot exceed 100%", severity: "warning" });
        return; // Reject change
      }
    }

    // Auto-calculate amount
    const q = parseFloat(newItem.quantity?.toString() || "0");
    const r = parseFloat(newItem.rate?.toString() || "0");
    newItem.amount = isNaN(q * r) ? 0 : Math.round(q * r * 100) / 100;

    updated[index] = newItem;
    setBomItems(updated);
  };

  const totalRatio = useMemo(() => {
    return bomItems.reduce((acc, item) => {
      const ratio = parseFloat(item.ratio_percentage || "0");
      return acc + (isNaN(ratio) ? 0 : ratio);
    }, 0);
  }, [bomItems]);

  const handleSave = async () => {
    if (!currentBOM.item) {
      setSnackbar({ open: true, message: "Please select a product", severity: "warning" });
      return;
    }
    if (!currentBOM.quantity || parseFloat(currentBOM.quantity.toString()) <= 0) {
      setSnackbar({ open: true, message: "Please enter a valid Batch Size (must be greater than 0)", severity: "warning" });
      return;
    }
    if (bomItems.length === 0) {
      setSnackbar({ open: true, message: "Add at least one material", severity: "warning" });
      return;
    }

    // Ingredient validation
    for (let i = 0; i < bomItems.length; i++) {
      const item = bomItems[i];
      if (!item.raw_material_role?.trim()) {
        setSnackbar({ open: true, message: `Role missing for ingredient: ${item.raw_material_name}`, severity: "warning" });
        return;
      }
      if (item.ratio_percentage === undefined || item.ratio_percentage === null) {
        setSnackbar({ open: true, message: `Ratio missing for: ${item.raw_material_name}`, severity: "warning" });
        return;
      }
      if (!item.quantity || parseFloat(item.quantity.toString()) <= 0) {
        setSnackbar({ open: true, message: `Dosing Weight must be greater than 0 for: ${item.raw_material_name}`, severity: "warning" });
        return;
      }
    }

    if (bomOperations.length === 0) {
      setSnackbar({ open: true, message: "Add at least one manufacturing operation", severity: "warning" });
      return;
    }

    // Operation validation
    for (let i = 0; i < bomOperations.length; i++) {
      const op = bomOperations[i];
      if (!op.operation_name?.trim()) {
        setSnackbar({ open: true, message: `Operation Name missing at Seq ${i + 1}`, severity: "warning" });
        return;
      }
      if (!op.time_in_mins || parseFloat(op.time_in_mins.toString()) <= 0) {
        setSnackbar({ open: true, message: `Time must be greater than 0 for operation: ${op.operation_name}`, severity: "warning" });
        return;
      }
      if (!op.operating_cost || parseFloat(op.operating_cost.toString()) <= 0) {
        setSnackbar({ open: true, message: `Op. Cost must be greater than 0 for operation: ${op.operation_name}`, severity: "warning" });
        return;
      }
    }

    if (totalRatio > 100.01) { // Floating point buffer
      setSnackbar({ open: true, message: "Total ratio cannot exceed 100%", severity: "error" });
      return;
    }

    setSaving(true);
    try {
      const materialCost = Math.round(bomItems.reduce((sum, item) => sum + parseFloat(item.amount?.toString() || "0"), 0) * 100) / 100;
      const opCost = Math.round(bomOperations.reduce((sum, op) => sum + parseFloat(op.operating_cost?.toString() || "0"), 0) * 100) / 100;
      const totalCost = Math.round((materialCost + opCost) * 100) / 100;

      const payload = {
        ...currentBOM,
        quantity: parseFloat(currentBOM.quantity?.toString() || "1"),
        raw_materials: bomItems.map(item => ({
          raw_material: item.raw_material!,
          quantity: parseFloat(item.quantity?.toString() || "0"),
          rate: parseFloat(item.rate?.toString() || "0"),
          amount: Math.round(parseFloat(item.amount?.toString() || "0") * 100) / 100,
          raw_material_role: item.raw_material_role || "",
          ratio_percentage: item.ratio_percentage || "0",
          quantity_display: item.quantity_display || "",
          source_warehouse: item.source_warehouse || null
        })) as any[],
        operations: bomOperations.map(op => ({
          operation_name: op.operation_name || "",
          time_in_mins: parseFloat(op.time_in_mins?.toString() || "0"),
          operating_cost: parseFloat(op.operating_cost?.toString() || "0"),
          description: op.description || "",
          workstation: op.workstation || null
        })) as any[],
        total_material_cost: materialCost,
        total_operation_cost: opCost,
        total_cost: totalCost
      };

      if (currentBOM.id) {
        await productionService.updateBOM(currentBOM.id, payload);
        setSnackbar({ open: true, message: "BOM updated successfully", severity: "success" });
      } else {
        await productionService.createBOM(payload);
        setSnackbar({ open: true, message: "BOM created successfully", severity: "success" });
      }
      setOpenDialog(false);
      fetchAllData();
    } catch (error: any) {
      console.error("Save failed:", error);
      const errorData = error.response?.data || error;
      setSnackbar({
        open: true,
        message: formatDRFError(errorData),
        severity: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    setSaving(true);
    try {
      await productionService.deleteBOM(deleteModal.id);
      setSnackbar({ open: true, message: "BOM deleted", severity: "success" });
      setDeleteModal({ open: false, id: null, name: "" });
      fetchAllData();
    } catch (error: any) {
      const errorData = error.response?.data || error;
      setSnackbar({
        open: true,
        message: formatDRFError(errorData),
        severity: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box sx={{ pb: 6 }}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={6}>
            <Box>
              <Typography variant="h2" sx={{ fontFamily: 'Georgia, serif', fontWeight: 400, color: 'text.primary', mb: 1 }}>
                BOM MASTER
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Define product recipes and material requirements
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAdd}
              sx={{
                px: 4, py: 1.5, borderRadius: 1, textTransform: 'none', fontWeight: 700,
                bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }
              }}
            >
              Create Recipe
            </Button>
          </Stack>

          {/* Stats */}
          <Grid container spacing={4} mb={6}>
            {[
              { label: "Active Recipes", value: boms.filter(b => b.is_active).length, icon: <ScienceIcon />, color: theme.palette.success.main },
              { label: "Total BOMs", value: boms.length, icon: <AccountTreeIcon />, color: theme.palette.info.main },
              { label: "Products Covered", value: new Set(boms.map(b => b.item)).size, icon: <Inventory2OutlinedIcon />, color: theme.palette.secondary.main },
            ].map((stat, idx) => (
              <Grid size={{ xs: 12, md: 4 }} key={idx}>
                <Card sx={{ borderRadius: 1, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', borderLeft: `5px solid ${stat.color}` }}>
                  <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Avatar sx={{ bgcolor: alpha(stat.color, 0.1), color: stat.color, width: 56, height: 56 }}>
                      {stat.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="h4" fontWeight={800}>{stat.value}</Typography>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>{stat.label}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Search & Table */}
          <Paper elevation={0} sx={{ p: 4, borderRadius: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <TextField
              placeholder="Search recipes or products..."
              fullWidth
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: 'action.hover' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TableContainer sx={{ borderRadius: 1, border: '1px solid #F1F2F6' }}>
              <Table>
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>BOM ID</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Batch Size</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Materials</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell></TableRow>
                  ) : paginatedBOMs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>No recipes found</TableCell></TableRow>
                  ) : paginatedBOMs.map((bom) => (
                    <TableRow key={bom.id} hover>
                      <TableCell><Typography fontWeight={700}>{bom.bom_number}</Typography></TableCell>
                      <TableCell>{bom.item_name}</TableCell>
                      <TableCell>{bom.quantity} {products.find(p => p.id === bom.item)?.uom || ''}</TableCell>
                      <TableCell>
                        <Tooltip title={bom.raw_materials.map(m => m.raw_material_name).join(', ')}>
                          <Chip label={`${bom.raw_materials.length} Items`} size="small" variant="outlined" />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={bom.is_active ? "Active" : "Inactive"}
                          size="small"
                          color={bom.is_active ? "success" : "default"}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleOpenEdit(bom.id)} color="primary"><EditIcon /></IconButton>
                        <IconButton
                          onClick={() => setDeleteModal({ open: true, id: bom.id, name: bom.bom_number })}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredBOMs.length}
              page={page}
              onPageChange={(e, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Paper>

          {/* Delete Confirmation */}
          <DeleteConfirmModal
            open={deleteModal.open}
            onClose={() => setDeleteModal({ ...deleteModal, open: false })}
            onConfirm={handleDelete}
            title="Delete BOM?"
            message="Are you sure you want to delete this recipe? This will remove all associated material mappings."
            itemName={deleteModal.name}
            loading={saving}
          />

          {/* Upsert Dialog */}
          <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="xl" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
            <DialogTitle>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main }}>
                    <ScienceIcon />
                  </Avatar>
                  <Typography variant="h5" fontWeight={900}>
                    {currentBOM.id ? "Edit Recipe" : "New Recipe Definition"}
                  </Typography>
                </Stack>
                <IconButton onClick={() => setOpenDialog(false)}><CloseIcon /></IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              {availableProducts.length === 0 && !currentBOM.id && (
                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                  All products already have recipes defined. You cannot create a new recipe until a product is added or an existing recipe is deleted.
                </Alert>
              )}
              <Grid container spacing={4} sx={{ mt: 0.5 }}>
                {/* Product Selection, Batch Size, and Recipe ID in one row */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Autocomplete
                    options={availableProducts}
                    getOptionLabel={(option) => `${option.product_name}`}
                    value={products.find(p => p.id === currentBOM.item) || null}
                    noOptionsText="No products available (Already have recipes)"
                    onChange={(e, val) => setCurrentBOM({ ...currentBOM, item: val?.id, bom_number: `BOM-${val?.sku || 'NEW'}-${new Date().getTime().toString().slice(-4)}` })}
                    renderInput={(params) => <TextField {...params} label="Select Product" variant="outlined" required />}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Batch Size (Production Quantity)"
                    fullWidth
                    required
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                    value={currentBOM.quantity || ''}
                    onChange={(e) => {
                      const val = e.target.value.split('.')[0].replace(/[^0-9]/g, '').slice(0, 8);
                      setCurrentBOM({ ...currentBOM, quantity: val === '' ? undefined : parseInt(val, 10) });
                    }}
                    onKeyDown={(e) => {
                      if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    variant="outlined"
                    placeholder="Enter batch size"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{products.find(p => p.id === currentBOM.item)?.uom || 'Units'}</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="Recipe ID"
                    fullWidth
                    value={currentBOM.bom_number}
                    slotProps={{
                      input: { readOnly: true },
                    }}
                    variant="outlined"
                    sx={{
                      '& .MuiInputBase-root': { bgcolor: alpha(theme.palette.action.disabledBackground, 0.05), fontWeight: 700 }
                    }}
                  />
                </Grid>

                {/* Material Search */}
                <Grid size={{ xs: 12 }}>
                  <Autocomplete
                    options={selectableRawMaterials}
                    getOptionLabel={(option) => `${option.item_name} (${option.item_code})`}
                    onChange={(e, val) => val && handleAddMaterial(val)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Search & Add Ingredients"
                        variant="outlined"
                        placeholder="Type item name or code..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start"><AddIcon color="primary" /></InputAdornment>
                          )
                        }}
                      />
                    )}
                  />
                </Grid>

                {/* Guidance Note */}
                <Grid size={{ xs: 12 }}>
                  <Alert
                    severity="info"
                    icon={<InfoOutlinedIcon />}
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.info.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      <strong>Recipe Formulation Guide:</strong> Enter the dosing weight and ratio percentage for each ingredient based on the <strong>Batch Size ({currentBOM.quantity || '___'} {products.find(p => p.id === currentBOM.item)?.uom || 'Units'})</strong> you specified above. The total ratio must equal 100%.
                    </Typography>
                  </Alert>
                </Grid>

                {/* Recipe Table */}
                <Grid size={{ xs: 12 }}>
                  <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Ingredient</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Role</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Standard Rate</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Ratio (%)</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>
                            Dosing Weight
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800 }}>Remove</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bomItems.length === 0 ? (
                          <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, fontStyle: 'italic', color: 'text.secondary' }}>No ingredients added yet</TableCell></TableRow>
                        ) : bomItems.map((item, index) => (
                          <TableRow key={index} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}>
                            <TableCell>
                              <Typography fontWeight={700}>{item.raw_material_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.raw_material_code}</Typography>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" variant="standard" fullWidth placeholder="e.g. Solvent"
                                value={item.raw_material_role}
                                onChange={(e) => updateItemField(index, "raw_material_role", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" variant="standard" fullWidth
                                type="number"
                                value={item.rate}
                                onChange={(e) => updateItemField(index, "rate", e.target.value)}
                                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" variant="standard" fullWidth
                                value={item.ratio_percentage}
                                onChange={(e) => updateItemField(index, "ratio_percentage", e.target.value)}
                                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                  size="small" variant="standard" sx={{ width: 100 }}
                                  value={item.quantity}
                                  onChange={(e) => updateItemField(index, "quantity", e.target.value)}
                                />
                                <Typography variant="body2" color="primary.main" fontWeight={900}>
                                  {item.quantity_display}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <IconButton size="small" color="error" onClick={() => setBomItems(bomItems.filter((_, i) => i !== index))}>
                                <CloseIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Operations Section */}
                <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" fontWeight={800} display="flex" alignItems="center" gap={1}>
                      <EngineeringIcon /> MANUFACTURING OPERATIONS & ROUTING
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddOperation}
                      variant="outlined"
                      sx={{ borderRadius: 2 }}
                    >
                      Add Operation
                    </Button>
                  </Stack>

                  <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Seq</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Operation Name</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Time (min)</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Op. Cost</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800 }}>Remove</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bomOperations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 4, fontStyle: 'italic', color: 'text.secondary' }}>
                              No operations added. At least one operation is required for a valid BOM.
                            </TableCell>
                          </TableRow>
                        ) : bomOperations.map((op, index) => (
                          <TableRow key={index} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <TextField
                                size="small" variant="standard" fullWidth placeholder="e.g. Cutting"
                                value={op.operation_name}
                                onChange={(e) => updateOperationField(index, "operation_name", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" variant="standard" fullWidth
                                type="number"
                                value={op.time_in_mins}
                                onChange={(e) => updateOperationField(index, "time_in_mins", parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small" variant="standard" fullWidth
                                type="number"
                                value={op.operating_cost}
                                onChange={(e) => updateOperationField(index, "operating_cost", parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton size="small" color="error" onClick={() => setBomOperations(bomOperations.filter((_, i) => i !== index))}>
                                <CloseIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Workstation Routing Preview */}
                {bomOperations.length > 0 && (
                  <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                    <Box sx={{ p: 3, bgcolor: '#F5F5F0', borderRadius: 1, border: '1px solid #E0E0DB' }}>
                      <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', mb: 2, display: 'block', letterSpacing: 1 }}>
                        WORKSTATION ROUTING PREVIEW
                      </Typography>
                      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                        {bomOperations.map((op, idx) => (
                          <React.Fragment key={idx}>
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                  bgcolor: '#DEDCD1',
                                  p: '10px 20px',
                                  borderRadius: '50px',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                  border: '1px solid rgba(0,0,0,0.1)'
                                }}
                              >
                                <EngineeringIcon sx={{ fontSize: 22, color: 'text.primary' }} />
                                <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                                  {idx + 1}. {op.operation_name || 'Process'}
                                </Typography>
                              </Box>
                            </motion.div>
                            {idx < bomOperations.length - 1 && (
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box sx={{ width: 24, height: 2, bgcolor: '#B2BEC3', borderRadius: 1 }} />
                              </Box>
                            )}
                          </React.Fragment>
                        ))}
                      </Stack>
                    </Box>
                  </Grid>
                )}
                <Grid size={{ xs: 12, md: 7 }}>
                  <TextField
                    label="Recipe Description / Process Notes"
                    multiline
                    rows={6}
                    fullWidth
                    value={currentBOM.description}
                    onChange={(e) => setCurrentBOM({ ...currentBOM, description: e.target.value })}
                    placeholder="Add detailed manufacturing steps or quality parameters..."
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.02), height: '100%' }}>
                    <CardContent>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Total Ratio:</Typography>
                          <Typography variant="body1" fontWeight={900} color={totalRatio > 100 ? "error.main" : "primary.main"}>
                            {totalRatio.toFixed(2)}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Total Materials:</Typography>
                          <Typography variant="body1" fontWeight={700}>{bomItems.length}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">Total Op. Cost:</Typography>
                          <Typography variant="body1" fontWeight={700}>
                            ₹{bomOperations.reduce((sum, op) => sum + (parseFloat(op.operating_cost?.toString() || "0") || 0), 0).toLocaleString()}
                          </Typography>
                        </Box>
                        <Divider />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body1" fontWeight={800}>Total Cost:</Typography>
                          <Typography variant="h6" fontWeight={900} color="primary.main">
                            ₹{(
                              bomItems.reduce((sum, item) => sum + (parseFloat(item.amount?.toString() || "0") || 0), 0) +
                              bomOperations.reduce((sum, op) => sum + (parseFloat(op.operating_cost?.toString() || "0") || 0), 0)
                            ).toLocaleString()}
                          </Typography>
                        </Box>
                        <Divider />
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          <InfoOutlinedIcon fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            Ensure the total ratio equates to 100% for a valid recipe definition.
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 4, justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h5" fontWeight={900} color="primary.main">
                  Average Cost: ₹{(
                    bomItems.reduce((sum, item) => sum + (parseFloat(item.amount?.toString() || "0") || 0), 0) +
                    bomOperations.reduce((sum, op) => sum + (parseFloat(op.operating_cost?.toString() || "0") || 0), 0)
                  ).toLocaleString()}
                </Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Button onClick={() => setOpenDialog(false)} color="inherit" sx={{ fontWeight: 700 }}>Cancel</Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving || (availableProducts.length === 0 && !currentBOM.id)}
                  startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <ScienceIcon />}
                  sx={{
                    px: 6, py: 1.5, borderRadius: 1, fontWeight: 900,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    bgcolor: `${theme.palette.primary.main} !important`,
                    color: `${theme.palette.primary.contrastText} !important`,
                    '&:hover': { bgcolor: `${theme.palette.primary.dark} !important` },
                    '&.Mui-disabled': {
                      bgcolor: `${theme.palette.action.disabledBackground} !important`,
                      color: `${theme.palette.action.disabled} !important`,
                      boxShadow: 'none !important'
                    }
                  }}
                >
                  {currentBOM.id ? "Update Recipe" : "Save Recipe"}
                </Button>
              </Stack>
            </DialogActions>
          </Dialog>

          <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 1 }}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </motion.div>
      </Box>
    </>
  );
}

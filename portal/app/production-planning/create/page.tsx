"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Divider,
  useTheme,
  alpha,
  Autocomplete,
  Snackbar,
  Alert,
  CircularProgress,
  Tooltip,
  Chip,
} from "@mui/material";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

// Services
import { productionService, ProductionPlanItem, MaterialCheckResult } from "@/lib/production-service";
import { warehouseService, Item } from "@/lib/warehouse-service";
import { salesService, SalesOrder } from "@/lib/sales-service";
import { purchaseService, Supplier, MaterialRequest } from "@/lib/purchase-service";
import { authService, UserProfile } from "@/lib/auth-service";
import MaterialRequisitionModal from "@/components/shared/MaterialRequisitionModal";

import { SaveIcon, ArrowBackIcon, CheckCircleOutlineIcon, HighlightOffIcon, PlaylistAddIcon, DeleteIcon, InventoryIcon, ErrorOutlineIcon, ShoppingCartIcon } from "@/components/icons";

interface PlanTableItem {
  item_id: number;
  item_name: string;
  item_code: string;
  quantity: number;
  bom_id?: number | string;
  bom_name?: string;
  priority: 'low' | 'medium' | 'high';
  sales_orders?: string[]; // IDs of orders if aggregated
}

export default function CreatePlanPage() {
  const theme = useTheme();
  const router = useRouter();

  // State
  const [source, setSource] = useState<"manual" | "sales_order">("manual");
  const [products, setProducts] = useState<any[]>([]);
  const [backorderedOrders, setBackorderedOrders] = useState<SalesOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<SalesOrder[]>([]);
  const [planItems, setPlanItems] = useState<PlanTableItem[]>([]);

  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityResults, setAvailabilityResults] = useState<MaterialCheckResult[] | null>(null);
  const [creatingMR, setCreatingMR] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" as "success" | "error" | "info" | "warning" });

  // Material Request Modal State
  const [mrModalOpen, setMrModalOpen] = useState(false);
  const [rawMaterials, setRawMaterials] = useState<Item[]>([]);
  const [mrSuppliers, setMrSuppliers] = useState<Supplier[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [mrRequestPayload, setMrRequestPayload] = useState<Partial<MaterialRequest> | null>(null);

  const searchParams = useSearchParams();

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [prodRes, boRes, matRes, supRes, userRes] = await Promise.all([
          warehouseService.getProducts(),
          salesService.getBackorderedOrders(),
          warehouseService.getItems({ category: "Raw Material" }),
          purchaseService.getSuppliers(),
          authService.getCurrentUser()
        ]);

        const productsList = prodRes.results || [];
        const backordersList = Array.isArray(boRes) ? boRes : [];

        setProducts(productsList);
        setBackorderedOrders(backordersList);
        setRawMaterials(matRes.results || []);
        setMrSuppliers(supRes.results || []);
        setCurrentUser(userRes);

        // Handle pre-selected orders from query params (Unified Flow)
        const preselect = searchParams.get('preselect');
        if (preselect && backordersList.length > 0) {
          const ids = preselect.split(',').map(idStr => parseInt(idStr));
          const selected = backordersList.filter(o => ids.includes(o.id));
          if (selected.length > 0) {
            setSource("sales_order");
            setSelectedOrders(selected);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchParams]);

  // Sync selection to plan items whenever selectedOrders changes (covers preselect too)
  useEffect(() => {
    if (selectedOrders.length > 0) {
      handleOrderChange(selectedOrders);
    }
  }, [selectedOrders]);

  // Invalidate stock check if plan items or quantities are modified
  useEffect(() => {
    setAvailabilityResults(null);
  }, [planItems]);

  // Handle Order Selection Change (Aggregation)
  const handleOrderChange = (orders: SalesOrder[] | null) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    setSelectedOrders(safeOrders);

    // Aggregate items from selected orders
    const aggregation: Record<number, PlanTableItem> = {};

    // Keep manual entries that were already in planItems
    planItems.forEach(pi => {
      if (!pi.sales_orders || pi.sales_orders.length === 0) {
        aggregation[pi.item_id] = { ...pi };
      }
    });

    safeOrders.forEach(order => {
      if (!order || !order.items) return;

      order.items.forEach(orderItem => {
        const itemId = (orderItem as any).product_id || orderItem.item;
        if (!itemId) return;

        // BOM GUARD: Check if item has a BOM
        const hasBom = (orderItem as any).default_bom || (orderItem as any).boms?.length > 0;
        if (!hasBom) {
          setSnackbar({ open: true, message: `BOM not available for ${orderItem.item_name}. Please add BOM and try again.`, severity: "error" });
          return;
        }

        if (!aggregation[itemId]) {
          aggregation[itemId] = {
            item_id: itemId,
            item_name: orderItem.item_name || "Unknown",
            item_code: orderItem.item_code || "",
            quantity: 0,
            priority: 'medium',
            bom_id: (orderItem as any).default_bom || (orderItem as any).boms?.[0]?.bom_number || "No BOM Found",
            sales_orders: []
          };
        }

        const qty = parseFloat((orderItem.quantity || 0).toString());
        aggregation[itemId].quantity += qty;

        if (order.order_number && !aggregation[itemId].sales_orders?.includes(order.order_number)) {
          aggregation[itemId].sales_orders?.push(order.order_number);
        }
      });
    });

    setPlanItems(Object.values(aggregation));
  };

  // Add Product (Manual)
  const handleAddProduct = (product: any) => {
    if (!product || !product.id) return;

    // BOM GUARD
    const hasBom = product.default_bom || (product.boms && product.boms.length > 0);
    if (!hasBom) {
      setSnackbar({ open: true, message: "BOM not available please add BOM and then add again", severity: "error" });
      return;
    }

    if (planItems.find(p => p.item_id === product.id)) {
      setSnackbar({ open: true, message: "Item already added", severity: "warning" });
      return;
    }
    const newItem: PlanTableItem = {
      item_id: product.id,
      item_name: product.product_name || product.item_name,
      item_code: product.sku || product.item_code,
      quantity: 1,
      priority: 'medium',
      bom_id: product.default_bom || (product.boms && product.boms[0]?.bom_number) || "No BOM Found"
    };
    setPlanItems([...planItems, newItem]);
  };

  const updateItem = (index: number, field: keyof PlanTableItem, value: any) => {
    const updated = [...planItems];
    updated[index] = { ...updated[index], [field]: value };
    setPlanItems(updated);
  };

  const removeItem = (index: number) => {
    setPlanItems(planItems.filter((_, i) => i !== index));
  };

  const checkAvailability = async () => {
    if (planItems.length === 0) {
      setSnackbar({ open: true, message: "No items to check", severity: "warning" });
      return;
    }

    const hasInvalidQty = planItems.some(p => !p.quantity || Number(p.quantity) < 1);
    if (hasInvalidQty) {
      setSnackbar({ open: true, message: "Please enter a valid quantity (1 or more) for all items", severity: "warning" });
      return;
    }
    setCheckingAvailability(true);
    try {
      const itemsToCheck = planItems.map(p => ({
        item_id: p.item_id,
        quantity: p.quantity
      }));
      const results = await productionService.checkMaterialAvailability(itemsToCheck);
      setAvailabilityResults(results);
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to check availability", severity: "error" });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async (status: string = 'draft', stock_status: string = 'pending') => {
    // Date validation
    if (new Date(endDate) < new Date(startDate)) {
      setSnackbar({ open: true, message: "Planned end date cannot be before the start date", severity: "error" });
      return;
    }

    if (planItems.length === 0) {
      setSnackbar({ open: true, message: "Please add at least one product to the plan", severity: "warning" });
      return;
    }

    // Quantity validation
    const hasInvalidQty = planItems.some(p => !p.quantity || Number(p.quantity) < 1);
    if (hasInvalidQty) {
      setSnackbar({ open: true, message: "Quantity must be 1 or greater for all products", severity: "error" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        from_date: startDate,
        to_date: endDate,
        status: status,
        stock_status: stock_status,
        source: source === 'manual' ? 'Manual' : 'Sales Order',
        sales_order_ids: selectedOrders.map(o => o.id), // Send the order IDs for M2M link
        items: planItems.map(p => ({
          item: p.item_id,
          planned_qty: p.quantity,
          priority: p.priority,
        }))
      };
      const res = await productionService.createProductionPlan(payload);
      setSnackbar({
        open: true,
        message: `Production Plan ${status === 'draft' ? 'drafted' : 'confirmed'} with stock status ${stock_status} successfully`,
        severity: "success"
      });
      return res;
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || "Failed to create plan", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMR = () => {
    if (!availabilityResults) return;
    const shortages = availabilityResults.filter(r => !r.is_available);
    if (shortages.length === 0) return;

    const mrItems = shortages.map(s => {
      // Find full item details to get UOM
      const fullItem = rawMaterials.find(rm => rm.id === s.item_id);
      return {
        item: s.item_id,
        item_name: s.item_name,
        item_code: s.item_code,
        quantity: Math.ceil(Number(s.shortage)),
        uom: fullItem?.uom || 'Unit',
        estimated_rate: Number(fullItem?.standard_rate) || Number(fullItem?.valuation_rate) || 0,
      };
    });

    setMrRequestPayload({
      department: "Production",
      purpose: `Shortage for Production Plan (${startDate})`,
      items: mrItems as any
    });
    setMrModalOpen(true);
  };

  const handleSaveMR = async (data: any) => {
    setCreatingMR(true);
    try {
      // Logic requirement: whenever Submit Material Request, Production Plan should save as Draft with stock status Requested
      const plan = await handleSubmit('draft', 'requested');

      if (plan && plan.id) {
        data.production_plan = plan.id;
      }

      await purchaseService.createMaterialRequest(data);
      setMrModalOpen(false);
      setTimeout(() => router.push("/production-planning"), 1000);
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || "Failed to create MR", severity: "error" });
    } finally {
      setCreatingMR(false);
    }
  };

  // Logic: hasShortages is only true if a check was performed AND actual shortages were found
  const hasShortages = useMemo(() => {
    if (availabilityResults === null) return false;
    return availabilityResults.some(r => !r.is_available);
  }, [availabilityResults]);

  // Logic: canConfirm requires a check to be done AND zero shortages
  const canConfirm = useMemo(() => {
    return availabilityResults !== null && !hasShortages && planItems.length > 0;
  }, [availabilityResults, hasShortages, planItems.length]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* HEADER ACTIONS */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
          <Button startIcon={<ArrowBackIcon />} color="inherit" href="/production-planning" sx={{ fontWeight: 700 }}>
            Back to Plans
          </Button>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={async () => {
                const res = await handleSubmit('draft', 'pending');
                if (res) router.push("/production-planning");
              }}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Save Draft
            </Button>
            <Tooltip title={!availabilityResults ? "Please check material availability before confirming" : hasShortages ? "Cannot confirm with material shortages" : ""}>
              <span>
                <Button
                  variant="contained"
                  disabled={loading || planItems.length === 0 || !canConfirm}
                  onClick={async () => {
                    const res = await handleSubmit('draft', 'ready');
                    if (res) router.push("/production-planning");
                  }}
                  startIcon={loading ? <CircularProgress size={20} /> : <PlaylistAddIcon />}
                  sx={{
                    borderRadius: 2,
                    px: 4,
                    fontWeight: 900,
                    bgcolor: "primary.main",
                    "&:hover": { bgcolor: "primary.dark" },
                    "&.Mui-disabled": {
                      bgcolor: "action.disabledBackground",
                      color: "action.disabled",
                    },
                  }}
                >
                  Confirm Production Plan
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Grid container spacing={3}>
          {/* LEFT: PLAN CONFIGURATION */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Paper elevation={0} sx={{ p: 4, mb: 3, borderRadius: 1 }}>
              <Typography variant="h6" fontWeight={900} mb={3}>
                Create Production Plan
              </Typography>

              <Grid container spacing={3} mb={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Source Management"
                    select
                    fullWidth
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value as any);
                      setPlanItems([]);
                      setSelectedOrders([]);
                    }}
                  >
                    <MenuItem value="manual">Manual Entry & Search</MenuItem>
                    <MenuItem value="sales_order">From Pending Requirements</MenuItem>
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  {source === "manual" ? (
                    <Autocomplete
                      key="manual-autocomplete"
                      options={products}
                      getOptionLabel={(option) => `${option.product_name || option.item_name} (${option.sku || option.item_code})`}
                      onChange={(e, val) => val && handleAddProduct(val)}
                      renderInput={(params) => (
                        <TextField {...params} label="Search & Add Tools/Products" placeholder="Search product..." />
                      )}
                    />
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Autocomplete
                        key="multiple-autocomplete"
                        multiple
                        fullWidth
                        options={backorderedOrders}
                        getOptionLabel={(option) => `[${(option as any).source_type || "Order"}] ${option.order_number} - ${option.customer_name}`}
                        value={selectedOrders}
                        onChange={(e, val) => handleOrderChange(val)}
                        renderInput={(params) => (
                          <TextField {...params} label="Select Backordered Orders" placeholder="Search orders..." />
                        )}
                        renderTags={(value, getTagProps) =>
                          (value || []).map((option, index) => (
                            <Chip label={option.order_number} size="small" {...getTagProps({ index })} key={option.id} />
                          ))
                        }
                      />
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => handleOrderChange(backorderedOrders)}
                        sx={{ whiteSpace: 'nowrap', borderRadius: 2, px: 2 }}
                      >
                        Add All
                      </Button>
                    </Stack>
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Planned Start Date"
                    type="date"
                    fullWidth
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Planned End Date"
                    type="date"
                    fullWidth
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: startDate }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />

              <Typography variant="subtitle1" fontWeight={800} mb={2}>
                Items to Produce {planItems.length > 0 && `(${planItems.length})`}
              </Typography>

              <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Item</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>Qty</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>BOM</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Priority</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {planItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary', fontStyle: 'italic' }}>
                          No products selected. Add from above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      planItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>{item.item_name}</Typography>
                            {item.sales_orders && item.sales_orders.length > 0 && (
                              <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                                Orders: {item.sales_orders.join(', ')}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                updateItem(index, 'quantity', val === '' ? 0 : parseInt(val, 10));
                              }}
                              onKeyDown={(e) => {
                                if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              sx={{ width: 80 }}
                              variant="standard"
                              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', style: { textAlign: 'center', fontWeight: 700 } }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{
                              bgcolor: item.bom_id === "No BOM Found" ? alpha(theme.palette.error.main, 0.1) : theme.palette.action.hover,
                              px: 1, py: 0.5, borderRadius: 1,
                              color: item.bom_id === "No BOM Found" ? theme.palette.error.main : theme.palette.text.secondary,
                              fontWeight: 700
                            }}>
                              {item.bom_id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <TextField
                              select
                              size="small"
                              variant="standard"
                              value={item.priority}
                              onChange={(e) => updateItem(index, 'priority', e.target.value)}
                              fullWidth
                            >
                              <MenuItem value="low">Low</MenuItem>
                              <MenuItem value="medium">Medium</MenuItem>
                              <MenuItem value="high">High</MenuItem>
                            </TextField>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => removeItem(index)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* RIGHT: MATERIAL AVAILABILITY */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper elevation={0} sx={{ p: 4, borderRadius: 1, position: 'sticky', top: 24 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={900}>
                  Stock Check
                </Typography>
                <IconButton color="primary" disabled={checkingAvailability} onClick={checkAvailability}>
                  <InventoryIcon />
                </IconButton>
              </Stack>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Verify if you have enough raw materials to fulfill this production plan.
              </Typography>

              <Button
                fullWidth
                variant="outlined"
                onClick={checkAvailability}
                disabled={checkingAvailability || planItems.length === 0}
                sx={{ mb: 4, borderRadius: 2, py: 1, fontWeight: 700, borderWidth: 2 }}
                startIcon={checkingAvailability ? <CircularProgress size={16} /> : <CheckCircleOutlineIcon />}
              >
                {checkingAvailability ? "Analyzing Recipes..." : "Check Material Availability"}
              </Button>

              <Box sx={{ flex: 1, overflowY: 'auto', pr: 1, maxHeight: 'calc(100vh - 400px)' }}>
                {!availabilityResults ? (
                  <Box sx={{ py: 6, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1, border: '2px dashed', borderColor: 'divider' }}>
                    <InventoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Analysis results will appear here
                    </Typography>
                  </Box>
                ) : availabilityResults.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" align="center">
                    No raw materials required.
                  </Typography>
                ) : (
                  <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Material</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>Short</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {availabilityResults.map((mat, i) => (
                          <TableRow key={i} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                            <TableCell>
                              <Typography variant="caption" fontWeight={700} display="block">
                                {mat.item_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Need: {mat.qty_needed.toFixed(3)} | Has: {mat.available_qty.toFixed(3)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {mat.shortage > 0 ? (
                                <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 900 }}>
                                  {mat.shortage.toFixed(3)}
                                </Typography>
                              ) : '-'}
                            </TableCell>
                            <TableCell align="right">
                              {mat.is_available ?
                                <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 16 }} /> :
                                <ErrorOutlineIcon sx={{ color: 'error.main', fontSize: 16 }} />
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

              {hasShortages && (
                <Box sx={{ mt: 3 }}>
                  <Alert
                    severity="error"
                    variant="outlined"
                    sx={{ borderRadius: 2, mb: 2, py: 0.5 }}
                    icon={<ErrorOutlineIcon fontSize="small" />}
                  >
                    <Typography variant="caption" fontWeight={700} sx={{ display: 'block' }}>
                      Material Shortage detected
                    </Typography>
                  </Alert>

                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleCreateMR}
                    disabled={creatingMR}
                    startIcon={creatingMR ? <CircularProgress size={16} /> : <ShoppingCartIcon />}
                    sx={{ borderRadius: 2, fontWeight: 800 }}
                  >
                    {creatingMR ? "Creating Request..." : "Create Material Request"}
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </motion.div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>

      <MaterialRequisitionModal
        open={mrModalOpen}
        onClose={() => setMrModalOpen(false)}
        onSave={handleSaveMR}
        request={mrRequestPayload}
        currentUser={currentUser}
        rawMaterials={rawMaterials}
        suppliers={mrSuppliers}
        saving={creatingMR}
      />
    </>
  );
}

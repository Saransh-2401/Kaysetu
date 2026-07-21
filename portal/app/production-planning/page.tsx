"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  useTheme,
  alpha,
  TextField,
  InputAdornment,
  LinearProgress,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  Checkbox,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
// Services
import { productionService, ProductionPlan, ProductionPlanItem } from "@/lib/production-service";
import { distributorService } from "@/lib/distributor-service";
import { authService, UserProfile } from "@/lib/auth-service";
import { warehouseService, Item } from "@/lib/warehouse-service";
import { purchaseService, Supplier, MaterialRequest } from "@/lib/purchase-service";

// Icons
import { AddBoxIcon, SearchIcon, FilterListIcon, MoreVertIcon, PlayCircleOutlineIcon, PlaylistAddIcon, CheckCircleIcon, WarningAmberIcon, VisibilityIcon, CloseIcon, CalendarMonthIcon, RefreshIcon, FactoryIcon, PlayArrowIcon, StopIcon, EditIcon, SaveIcon, DeleteIcon, ExpandMoreIcon, ListAltIcon, ShoppingBagIcon, HistoryIcon, SettingsSuggestIcon } from "@/components/icons";
import MaterialRequisitionModal from "@/components/shared/MaterialRequisitionModal";
import { Snackbar, Alert } from "@mui/material";


export default function ProductionPlanningPage() {
  const theme = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [shortages, setShortages] = useState<any[]>([]);
  const [selectedShortages, setSelectedShortages] = useState<number[]>([]);
  const [productionPlans, setProductionPlans] = useState<ProductionPlan[]>([]);
  const [loadingShortages, setLoadingShortages] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" as "success" | "error" | "info" | "warning" });

  // MR Modal states
  const [mrModalOpen, setMrModalOpen] = useState(false);
  const [mrRequestPayload, setMrRequestPayload] = useState<Partial<MaterialRequest> | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // Required data for MR Modal
  const [user, setUser] = useState<UserProfile | null>(null);

  // Helper Functions
  const isPlanDelayed = (plan: ProductionPlan) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromDate = new Date(plan.from_date);
    const toDate = new Date(plan.to_date);

    // Case 1: Start date passed but not started
    if ((plan.status === 'draft' || plan.status === 'confirmed') && today > fromDate) {
      return true;
    }
    // Case 2: In progress but end date passed
    if (plan.status === 'in_progress' && today > toDate) {
      return true;
    }
    return false;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "info";
      case "in_progress":
      case "in_production":
        return "primary";
      case "scheduled":
      case "submitted":
        return "secondary";
      case "draft":
        return "warning";
      case "cancelled":
        return "error";
      case "delayed":
        return "error";
      default:
        return "default";
    }
  };

  const getStockStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ready":
        return "success";
      case "requested":
        return "warning";
      case "pending":
        return "info";
      case "rejected":
        return "error";
      default:
        return "default";
    }
  };

  // Statistics Calculation
  const generalStats = {
    total: productionPlans.length,
    inProgress: productionPlans.filter(p => p.status === 'in_progress').length,
    completed: productionPlans.filter(p => p.status === 'completed').length,
    delayed: productionPlans.filter(p => isPlanDelayed(p)).length,
  };

  const shortageStatsData = {
    totalItems: shortages.length,
    totalQty: shortages.reduce((sum, s) => sum + (Number(s.shortage_quantity) || 0), 0),
    uniqueRequests: new Set(shortages.map(s => s.stock_request)).size,
    pendingItems: shortages.filter(s => s.status === 'pending').length,
  };

  // Group Shortages by Stock Request
  const groupedShortages = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    if (!Array.isArray(shortages)) return groups;

    shortages.forEach(s => {
      const key = s.stock_request_number || `SR-${s.stock_request}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [shortages]);
  const [rawMaterials, setRawMaterials] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [savingMR, setSavingMR] = useState(false);

  // Warning Dialog states
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [pendingMrPayload, setPendingMrPayload] = useState<Partial<MaterialRequest> | null>(null);

  // View Modal states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedViewPlan, setSelectedViewPlan] = useState<ProductionPlan | null>(null);

  // Edit Modal states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchProductionPlans = async () => {
    setLoadingPlans(true);
    try {
      const res = await productionService.getProductionPlans();
      setProductionPlans(res.results || []);
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchShortages = async () => {
    // Shortages are raised by the distributor channel (DIST). A PROD-only
    // tenant has none, so don't call the endpoint (it would 403).
    if (!authService.hasModule("DIST")) {
      setShortages([]);
      return;
    }
    setLoadingShortages(true);
    try {
      const data: any = await distributorService.getShortages();
      // Handle paginated or direct array responses
      const shortagesList = Array.isArray(data) ? data : (data?.results || []);
      setShortages(shortagesList);
    } catch (error) {
      console.error("Failed to fetch shortages:", error);
      setShortages([]);
    } finally {
      setLoadingShortages(false);
    }
  };

  const fetchData = async () => {
    fetchShortages();
    fetchProductionPlans();

    // Fetch MR dependencies
    try {
      // Suppliers belong to PURCH; skip when the tenant hasn't bought it.
      const [userRes, materialsRes, suppliersRes] = await Promise.all([
        authService.getCurrentUser(),
        warehouseService.getItems({ category: "Raw Material" }),
        authService.hasModule("PURCH") ? purchaseService.getSuppliers() : Promise.resolve({ results: [] as Supplier[] })
      ]);
      setUser(userRes);
      setRawMaterials(materialsRes.results || []);
      setSuppliers(suppliersRes.results || []);
    } catch (err) {
      console.error("Error fetching dependencies:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartProduction = async (id: number) => {
    try {
      await distributorService.startShortageProduction(id);
      fetchShortages();
    } catch (error) {
      console.error("Failed to start production:", error);
    }
  };

  const handleCompleteProduction = async (id: number) => {
    try {
      await distributorService.completeShortageProduction(id);
      fetchShortages();
    } catch (error) {
      console.error("Failed to complete production:", error);
    }
  };

  const handleStartProductionPlan = async (id: number) => {
    try {
      const response = await productionService.startProduction(id);
      setSnackbar({ open: true, message: response.message || "Production started and stock deducted!", severity: "success" });
      fetchProductionPlans();
      fetchShortages();
    } catch (error: any) {
      const details = error.details;
      if (details?.shortages) {
        // Material Status: Not Available - Open MR Modal
        const shortages = details.shortages;
        setSnackbar({ open: true, message: "Material Status: Not Available. Pre-filling Material Request...", severity: "warning" });

        // Prepare MR Payload
        const mrPayload: Partial<MaterialRequest> = {
          purpose: `Auto-generated for Production Plan #${id}`,
          department: 'Production',
          production_plan: id,
          items: shortages.map((s: any) => ({
            item: s.item_id,
            item_name: s.item_name,
            quantity: s.shortage,
            estimated_rate: 0
          }))
        };

        setMrRequestPayload(mrPayload);
        setSelectedPlanId(id);

        // Check if plan already has MRs to warn user
        const plan = productionPlans.find(p => p.id === id);
        if (plan && (plan as any).has_material_requests) {
          setPendingMrPayload(mrPayload);
          setWarningDialogOpen(true);
        } else {
          setMrRequestPayload(mrPayload);
          setTimeout(() => setMrModalOpen(true), 500);
        }
      } else {
        setSnackbar({ open: true, message: error.message || "Failed to start production", severity: "error" });
      }
    }
  };

  const handleStopProductionPlan = async (id: number) => {
    try {
      const response = await productionService.stopProduction(id);
      setSnackbar({ open: true, message: "Production stopped and reverted to Plan Created state.", severity: "info" });
      fetchProductionPlans();
      fetchShortages();
    } catch (error: any) {
      setSnackbar({ open: true, message: "Failed to stop production", severity: "error" });
    }
  };

  const handleSaveMR = async (data: any) => {
    try {
      setSavingMR(true);
      await purchaseService.createMaterialRequest(data);
      handleMrSuccess();
    } catch (error: any) {
      setSnackbar({ open: true, message: "Failed to create material request", severity: "error" });
    } finally {
      setSavingMR(false);
    }
  };

  const handleMrSuccess = async () => {
    setMrModalOpen(false);
    if (selectedPlanId) {
      await productionService.updatePlan(selectedPlanId, { status: 'draft', stock_status: 'requested' });
      setSelectedPlanId(null);
    }
    setSnackbar({ open: true, message: "Material Request Created! Status: Requested.", severity: "success" });
    fetchProductionPlans();
  };

  const handleEditClick = (plan: ProductionPlan) => {
    setEditingPlan({ ...plan });
    setEditDialogOpen(true);
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan || !editingPlan.id) return;

    // Validation: End date should not be before start date
    if (new Date(editingPlan.to_date) < new Date(editingPlan.from_date)) {
      setSnackbar({ open: true, message: "Planned end date cannot be before the start date", severity: "error" });
      return;
    }

    // Validation: Ensure there is at least one item
    if (!editingPlan.items || editingPlan.items.length === 0) {
      setSnackbar({ open: true, message: "Production plan must have at least one item", severity: "error" });
      return;
    }

    // Validation: Check if any quantity is 0 or less
    const hasInvalidQty = editingPlan.items?.some(item => !item.planned_qty || Number(item.planned_qty) < 1);
    if (hasInvalidQty) {
      setSnackbar({ open: true, message: "Quantity must be 1 or greater for all items", severity: "error" });
      return;
    }

    setSavingPlan(true);
    try {
      const payload = {
        from_date: editingPlan.from_date,
        to_date: editingPlan.to_date,
        items: editingPlan.items?.map(item => ({
          item: (item as any).item, // Product ID
          planned_qty: item.planned_qty,
          priority: item.priority,
          sales_order: item.sales_order
        }))
      };

      await productionService.updatePlan(editingPlan.id, payload);
      setSnackbar({ open: true, message: "Production plan updated successfully!", severity: "success" });
      setEditDialogOpen(false);
      fetchProductionPlans();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || "Failed to update plan", severity: "error" });
    } finally {
      setSavingPlan(false);
    }
  };

  const handleUpdateEditingItem = (index: number, field: string, value: any) => {
    if (!editingPlan || !editingPlan.items) return;
    const items = [...editingPlan.items];

    if (field === 'planned_qty') {
      items[index] = { ...items[index], [field]: value };
    } else {
      items[index] = { ...items[index], [field as keyof ProductionPlanItem]: value };
    }

    setEditingPlan({ ...editingPlan, items });
  };

  const handleRemoveEditingItem = (index: number) => {
    if (!editingPlan || !editingPlan.items) return;
    const items = editingPlan.items.filter((_, i) => i !== index);
    setEditingPlan({ ...editingPlan, items });
  };

  const handleSelectShortage = (id: number) => {
    setSelectedShortages(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllShortages = () => {
    const pendingShortages = shortages.filter(s => s.status === 'pending');
    if (selectedShortages.length === pendingShortages.length && pendingShortages.length > 0) {
      setSelectedShortages([]);
    } else {
      setSelectedShortages(pendingShortages.map(s => s.id));
    }
  };

  const handleCreateUnifiedPlan = () => {
    // Get unique stock_request IDs from selected shortages
    const selectedSRs = shortages
      .filter(s => selectedShortages.includes(s.id))
      .map(s => s.stock_request);

    const uniqueSRs = Array.from(new Set(selectedSRs));

    // We can use a trick: stock requests are represented as id + 1,000,000 in our unified view
    const unifiedIds = uniqueSRs.map(id => id + 1000000);

    router.push(`/production-planning/create?preselect=${unifiedIds.join(',')}`);
  };



  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* HEADER */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems="center"
          mb={4}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ letterSpacing: "-0.02em" }}
            >
              Production Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track and fulfill manufacturing requirements from distributor orders.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchShortages}
              sx={{ borderRadius: 2 }}
            >
              Refresh Data
            </Button>
            <Button
              variant="contained"
              startIcon={<AddBoxIcon />}
              href="/production-planning/create"
              sx={{
                borderRadius: "12px",
                px: 3,
                background: `linear-gradient(135deg, #E65100, #BF360C)`,
              }}
            >
              Create New Plan
            </Button>
          </Box>
        </Stack>

        {/* STATISTICS DASHBOARD */}
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.1),
                background: alpha(theme.palette.primary.main, 0.02),
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    display: 'flex'
                  }}
                >
                  <FactoryIcon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" fontWeight={800}>General Production</Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">TOTAL</Typography>
                  <Typography variant="h5" fontWeight={900}>{generalStats.total}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">IN PROGRESS</Typography>
                  <Typography variant="h5" fontWeight={900} color="info.main">{generalStats.inProgress}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">COMPLETED</Typography>
                  <Typography variant="h5" fontWeight={900} color="success.main">{generalStats.completed}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">DELAYED</Typography>
                  <Typography variant="h5" fontWeight={900} color="error.main">{generalStats.delayed}</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: alpha(theme.palette.secondary.main, 0.1),
                background: alpha(theme.palette.secondary.main, 0.02),
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    color: theme.palette.secondary.main,
                    display: 'flex'
                  }}
                >
                  <ShoppingBagIcon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" fontWeight={800}>Shortage From Orders</Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">ITEMS</Typography>
                  <Typography variant="h5" fontWeight={900}>{shortageStatsData.totalItems}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">TOTAL QTY</Typography>
                  <Typography variant="h5" fontWeight={900} color="error.main">{Math.round(shortageStatsData.totalQty)}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">REQUESTS</Typography>
                  <Typography variant="h5" fontWeight={900} color="warning.main">{shortageStatsData.uniqueRequests}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">PENDING</Typography>
                  <Typography variant="h5" fontWeight={900} color="error.main">{shortageStatsData.pendingItems}</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab
              label="General Production Plans"
              icon={<CalendarMonthIcon />}
              iconPosition="start"
            />
            <Tab
              label={`Shortages from Orders (${Array.isArray(shortages) ? shortages.filter(s => s.status !== 'completed').length : 0})`}
              icon={<WarningAmberIcon />}
              iconPosition="start"
              sx={{
                color: (Array.isArray(shortages) && shortages.some(s => s.status === 'pending')) ? 'error.main' : 'inherit',
                fontWeight: (Array.isArray(shortages) && shortages.some(s => s.status === 'pending')) ? 700 : 400
              }}
            />
          </Tabs>
        </Box>

        <AnimatePresence mode="wait">
          {activeTab === 0 ? (
            <motion.div
              key="plans"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <Paper
                elevation={0}
                sx={{
                  overflow: "hidden",
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                }}
              >
                <Box sx={{ p: 3, display: "flex", gap: 2 }}>
                  <TextField
                    placeholder="Search Plan ID or Item..."
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ minWidth: 350 }}
                  />
                </Box>

                <TableContainer>
                  {loadingPlans ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}>
                      <CircularProgress size={40} />
                      <Typography sx={{ mt: 2 }} color="text.secondary">Loading production plans...</Typography>
                    </Box>
                  ) : (
                    <Table>
                      <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>PLAN ID</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>BATCH NO</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>SOURCE</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>PROGRESS</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>STOCK STATUS</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>ACTIONS</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {productionPlans.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                              <Typography color="text.secondary">No production plans found.</Typography>
                            </TableCell>
                          </TableRow>
                        ) : productionPlans.map((plan) => (
                          <TableRow key={plan.id} hover>
                            <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{plan.plan_number}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{plan.batch_no}</TableCell>
                            <TableCell>{plan.source}</TableCell>
                            <TableCell sx={{ width: 180 }}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Number(plan.progress) || 0}
                                  sx={{ flexGrow: 1, height: 6, borderRadius: 1 }}
                                />
                                <Typography variant="caption" fontWeight={700}>
                                  {Math.round(Number(plan.progress) || 0)}%
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <Chip
                                  label={plan.status?.toUpperCase()?.replace("_", " ")}
                                  size="small"
                                  color={getStatusColor(plan.status || '') as any}
                                  sx={{ fontWeight: 700 }}
                                />
                                {isPlanDelayed(plan) && (
                                  <Chip
                                    label="DELAYED"
                                    size="small"
                                    color="error"
                                    sx={{ fontWeight: 700 }}
                                  />
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={plan.stock_status?.toUpperCase()}
                                size="small"
                                color={getStockStatusColor(plan.stock_status || '') as any}
                                variant="outlined"
                                sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                {plan.status !== 'in_progress' && plan.status !== 'completed' && (
                                  <Tooltip title="Edit Production Plan">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => handleEditClick(plan)}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {(plan.status === 'confirmed' || plan.status === 'draft') ? (
                                  <Tooltip title="Start Production">
                                    <IconButton
                                      color="primary"
                                      size="small"
                                      onClick={() => plan.id && handleStartProductionPlan(plan.id)}
                                      sx={{
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                                      }}
                                    >
                                      <PlayArrowIcon />
                                    </IconButton>
                                  </Tooltip>
                                ) : plan.status === 'in_progress' ? (
                                  <Tooltip title="Stop/Pause Production">
                                    <IconButton
                                      color="error"
                                      size="small"
                                      onClick={() => plan.id && handleStopProductionPlan(plan.id)}
                                      sx={{
                                        bgcolor: alpha(theme.palette.error.main, 0.1),
                                        '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) }
                                      }}
                                    >
                                      <StopIcon />
                                    </IconButton>
                                  </Tooltip>
                                ) : null}
                                <Tooltip title="View Details">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setSelectedViewPlan(plan);
                                      setViewDialogOpen(true);
                                    }}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TableContainer>
              </Paper>
            </motion.div>
          ) : (
            <motion.div
              key="shortages"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Paper
                elevation={0}
                sx={{
                  overflow: "hidden",
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                }}
              >
                {loadingShortages ? (
                  <Box sx={{ p: 8, textAlign: 'center' }}>
                    <CircularProgress size={40} />
                    <Typography sx={{ mt: 2 }} color="text.secondary">Synchronizing order shortages...</Typography>
                  </Box>
                ) : (
                  <Box>
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: alpha(theme.palette.error.main, 0.02), borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Checkbox
                          size="small"
                          checked={shortages.filter(s => s.status === 'pending').length > 0 && selectedShortages.length === shortages.filter(s => s.status === 'pending').length}
                          indeterminate={selectedShortages.length > 0 && selectedShortages.length < shortages.filter(s => s.status === 'pending').length}
                          onChange={handleSelectAllShortages}
                        />
                        <Typography variant="subtitle2" fontWeight={700}>
                          {selectedShortages.length} Shortages Selected
                        </Typography>
                      </Stack>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={selectedShortages.length === 0}
                        startIcon={<PlaylistAddIcon />}
                        onClick={handleCreateUnifiedPlan}
                        sx={{ borderRadius: 2, fontWeight: 800, px: 3, bgcolor: theme.palette.error.main, '&:hover': { bgcolor: theme.palette.error.dark } }}
                      >
                        Create Unified Plan
                      </Button>
                    </Box>

                    <Box sx={{ p: 2 }}>
                      {Object.keys(groupedShortages).length === 0 ? (
                        <Box sx={{ py: 6, textAlign: 'center' }}>
                          <FactoryIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.2, mb: 1 }} />
                          <Typography variant="h6" color="text.secondary">All clear!</Typography>
                          <Typography variant="body2" color="text.disabled">No pending shortages from distributor orders.</Typography>
                        </Box>
                      ) : (
                        Object.entries(groupedShortages).map(([srNumber, items]) => (
                          <Accordion
                            key={srNumber}
                            defaultExpanded={true}
                            sx={{
                              mb: 2,
                              borderRadius: 1,
                              overflow: 'hidden',
                              '&:before': { display: 'none' },
                              boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<ExpandMoreIcon />}
                              sx={{ bgcolor: alpha(theme.palette.background.paper, 0.5) }}
                            >
                              <Stack direction="row" alignItems="center" spacing={2} width="100%">
                                {items.some(i => i.status === 'pending') && (
                                  <Checkbox
                                    size="small"
                                    checked={items.filter(i => i.status === 'pending').every(i => selectedShortages.includes(i.id))}
                                    indeterminate={items.some(i => i.status === 'pending' && selectedShortages.includes(i.id)) && !items.filter(i => i.status === 'pending').every(i => selectedShortages.includes(i.id))}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const pendingItemIds = items.filter(i => i.status === 'pending').map(i => i.id);
                                      if (e.target.checked) {
                                        setSelectedShortages(prev => Array.from(new Set([...prev, ...pendingItemIds])));
                                      } else {
                                        setSelectedShortages(prev => prev.filter(id => !pendingItemIds.includes(id)));
                                      }
                                    }}
                                  />
                                )}
                                <Typography variant="h6" fontWeight={800}>
                                  Stock Request: {srNumber}
                                </Typography>
                                <Chip
                                  label={`${items.length} Items`}
                                  size="small"
                                  sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main' }}
                                />
                                <Box flexGrow={1} />
                              </Stack>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                              <TableContainer>
                                <Table size="small">
                                  <TableHead sx={{ bgcolor: alpha(theme.palette.error.main, 0.02) }}>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 700, pl: 3 }}>PRODUCT</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }} align="center">SHORTAGE QTY</TableCell>
                                      <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                                      <TableCell sx={{ fontWeight: 700, pr: 3 }}>DATE</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {items.map((s) => (
                                      <TableRow key={s.id} hover selected={selectedShortages.includes(s.id)}>
                                        <TableCell sx={{ pl: 3 }}>
                                          <Typography variant="subtitle2" fontWeight={700}>{s.product_name}</Typography>
                                          <Typography variant="caption" color="text.secondary">{s.sku}</Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 800 }}>
                                            {s.shortage_quantity}
                                          </Typography>
                                        </TableCell>
                                        <TableCell>
                                          <Chip
                                            label={s.status.replace('_', ' ').toUpperCase()}
                                            size="small"
                                            color={getStatusColor(s.status) as any}
                                            variant={s.status === 'pending' ? 'filled' : 'outlined'}
                                            sx={{ fontWeight: 700, height: 24 }}
                                          />
                                        </TableCell>
                                        <TableCell sx={{ pr: 3 }}>
                                          <Typography variant="caption">
                                            {new Date(s.created_at).toLocaleDateString()}
                                          </Typography>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </AccordionDetails>
                          </Accordion>
                        ))
                      )}
                    </Box>
                  </Box>
                )}
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* FEEDBACK & MODALS */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2, fontWeight: 600 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <MaterialRequisitionModal
        open={mrModalOpen}
        onClose={() => setMrModalOpen(false)}
        onSave={handleSaveMR}
        request={mrRequestPayload}
        currentUser={user}
        rawMaterials={rawMaterials}
        suppliers={suppliers}
        saving={savingMR}
      />

      {/* DUPLICATE MR WARNING DIALOG */}
      <Dialog
        open={warningDialogOpen}
        onClose={() => setWarningDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 1, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, color: 'warning.main' }}>
          <WarningAmberIcon /> Material Already Requested
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" fontWeight={500} sx={{ mb: 2 }}>
            A Material Request has already been linked to this Production Plan.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generating another request might lead to duplicate procurement. If the previously requested stock was used elsewhere or is insufficient, you may proceed by agreeing.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setWarningDialogOpen(false)}
            color="inherit"
            sx={{ fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setWarningDialogOpen(false);
              if (pendingMrPayload) {
                setMrRequestPayload(pendingMrPayload);
                setMrModalOpen(true);
              }
            }}
            variant="contained"
            color="warning"
            sx={{ fontWeight: 900, borderRadius: 2 }}
          >
            I Agree, Proceed
          </Button>
        </DialogActions>
      </Dialog>

      {/* PRODUCTION PLAN DETAIL DIALOG */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 1 } }}
      >
        {selectedViewPlan && (
          <>
            <DialogTitle sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5" fontWeight={900} component="span">
                Production Plan Details
              </Typography>
              <IconButton onClick={() => setViewDialogOpen(false)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 4 }}>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Plan ID</Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ fontFamily: 'monospace' }}>{selectedViewPlan.plan_number}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Batch Number</Typography>
                      <Typography variant="h6" fontWeight={800}>{selectedViewPlan.batch_no}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Progress</Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <LinearProgress
                          variant="determinate"
                          value={Number(selectedViewPlan.progress) || 0}
                          sx={{ flexGrow: 1, height: 10, borderRadius: 5 }}
                        />
                        <Typography variant="h6" fontWeight={800}>{Math.round(Number(selectedViewPlan.progress) || 0)}%</Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Status</Typography>
                      <div>
                        <Stack direction="row" spacing={1}>
                          <Chip
                            label={selectedViewPlan.status?.toUpperCase().replace('_', ' ')}
                            color={getStatusColor(selectedViewPlan.status || '') as any}
                            sx={{ fontWeight: 800 }}
                          />
                          {isPlanDelayed(selectedViewPlan) && (
                            <Chip
                              label="DELAYED"
                              color="error"
                              sx={{ fontWeight: 800 }}
                            />
                          )}
                        </Stack>
                      </div>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Stock Status</Typography>
                      <div>
                        <Chip
                          label={selectedViewPlan.stock_status?.toUpperCase()}
                          color={getStockStatusColor(selectedViewPlan.stock_status || '') as any}
                          variant="outlined"
                          sx={{ fontWeight: 800 }}
                        />
                      </div>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Timeline</Typography>
                      <Typography variant="body1" fontWeight={700}>
                        {new Date(selectedViewPlan.from_date).toLocaleDateString()} - {new Date(selectedViewPlan.to_date).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Linked Source Orders</Typography>
                      <Box sx={{ mt: 0.5 }}>
                        {selectedViewPlan.sales_order_numbers && selectedViewPlan.sales_order_numbers.length > 0 ? (
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {selectedViewPlan.sales_order_numbers.map((no) => (
                              <Chip key={no} label={no} size="small" variant="filled" sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                            ))}
                          </Stack>
                        ) : selectedViewPlan.stock_request_numbers && selectedViewPlan.stock_request_numbers.length > 0 ? (
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {selectedViewPlan.stock_request_numbers.map((no) => (
                              <Chip key={no} label={no} size="small" variant="filled" sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main' }} />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary" fontWeight={600}>Manual Entry / Mixed Source</Typography>
                        )}
                      </Box>
                    </Box>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6" fontWeight={900} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FactoryIcon color="primary" /> Produced Items
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Item Name</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="center">Planned Qty</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Execution Progress</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedViewPlan.items?.map((item, idx) => {
                          const progress = item.work_order_progress || 0;
                          return (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontWeight: 600 }}>{item.item_name}</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 700 }}>{item.planned_qty}</TableCell>
                              <TableCell sx={{ minWidth: 150 }}>
                                <Stack spacing={0.5}>
                                  <Typography variant="caption" fontWeight={700}>
                                    {progress}%
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    color={progress >= 100 ? "success" : "primary"}
                                    sx={{ height: 6, borderRadius: 1 }}
                                  />
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Chip size="small" label={item.priority.toUpperCase()} color={item.priority === 'high' ? 'error' : item.priority === 'medium' ? 'warning' : 'info'} sx={{ fontWeight: 700, height: 20 }} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* ACTIVITY LOGS TIMELINE */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HistoryIcon color="primary" /> Recent Activity & Execution Logs
                  </Typography>
                  <Paper variant="outlined" sx={{ borderRadius: 1, p: 0, overflow: 'hidden', bgcolor: alpha(theme.palette.background.paper, 0.4) }}>
                    {selectedViewPlan.execution_logs && selectedViewPlan.execution_logs.length > 0 ? (
                      <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 3 }}>
                        <Stack spacing={3} sx={{ position: 'relative', pl: 4 }}>
                          {/* Vertical Progress Line */}
                          <Box sx={{
                            position: 'absolute',
                            left: 15,
                            top: 8,
                            bottom: 8,
                            width: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            zIndex: 0
                          }} />

                          {selectedViewPlan.execution_logs.map((log) => (
                            <Box key={log.id} sx={{ position: 'relative', zIndex: 1 }}>
                              {/* Glowing Marker */}
                              <Box sx={{
                                position: 'absolute',
                                left: -25,
                                top: 4,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: log.item_type === 'work_order' ? theme.palette.success.main : theme.palette.primary.main,
                                border: `3px solid ${theme.palette.background.paper}`,
                                boxShadow: log.item_type === 'work_order'
                                  ? `0 0 10px ${alpha(theme.palette.success.main, 0.4)}`
                                  : `0 0 10px ${alpha(theme.palette.primary.main, 0.4)}`
                              }} />

                              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                                    {log.description}
                                  </Typography>
                                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                    <Chip
                                      label={log.item_type.replace('_', ' ').toUpperCase()}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        height: 18,
                                        fontSize: '0.6rem',
                                        fontWeight: 900,
                                        borderColor: log.item_type === 'work_order' ? alpha(theme.palette.success.main, 0.3) : alpha(theme.palette.primary.main, 0.3),
                                        color: log.item_type === 'work_order' ? 'success.main' : 'primary.main',
                                        bgcolor: log.item_type === 'work_order' ? alpha(theme.palette.success.main, 0.05) : alpha(theme.palette.primary.main, 0.05)
                                      }}
                                    />
                                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                                      REF: {log.reference_no}
                                    </Typography>
                                  </Stack>
                                </Box>
                                <Typography variant="caption" color="text.disabled" fontWeight={800} sx={{ mt: { xs: 1, sm: 0 } }}>
                                  {new Date(log.timestamp).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Typography>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    ) : (
                      <Box sx={{ p: 6, textAlign: 'center', opacity: 0.6 }}>
                        <ListAltIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1, opacity: 0.3 }} />
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>No activity logs recorded yet.</Typography>
                        <Typography variant="caption" color="text.disabled">Completion of operations and work orders will appear here automatically.</Typography>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setViewDialogOpen(false)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* EDIT PRODUCTION PLAN DIALOG */}
      <Dialog
        open={editDialogOpen}
        onClose={() => !savingPlan && setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 1 } }}
      >
        <DialogTitle sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" fontWeight={900} component="span">
            Edit Production Plan
          </Typography>
          <IconButton onClick={() => setEditDialogOpen(false)} disabled={savingPlan}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 4 }}>
          {editingPlan && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Planned Start Date"
                  type="date"
                  fullWidth
                  value={editingPlan.from_date}
                  onChange={(e) => setEditingPlan({ ...editingPlan, from_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Planned End Date"
                  type="date"
                  fullWidth
                  value={editingPlan.to_date}
                  onChange={(e) => setEditingPlan({ ...editingPlan, to_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: editingPlan.from_date }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1" fontWeight={800} mb={2}>
                  Production Items
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Item Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Quantity</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {editingPlan.items?.map((item, index) => {
                        const isManual = !editingPlan.sales_order_numbers?.length && !editingPlan.stock_request_numbers?.length;
                        return (
                          <TableRow key={index}>
                            <TableCell sx={{ fontWeight: 600 }}>{item.item_name}</TableCell>
                            <TableCell align="center">
                              <TextField
                                type="number"
                                size="small"
                                value={item.planned_qty || ''}
                                onChange={(e) => handleUpdateEditingItem(index, 'planned_qty', e.target.value)}
                                sx={{ width: 100 }}
                                inputProps={{ style: { fontWeight: 700, textAlign: 'center' } }}
                                variant="standard"
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                select
                                size="small"
                                value={item.priority}
                                onChange={(e) => handleUpdateEditingItem(index, 'priority', e.target.value)}
                                fullWidth
                                variant="standard"
                              >
                                <MenuItem value="low">Low</MenuItem>
                                <MenuItem value="medium">Medium</MenuItem>
                                <MenuItem value="high">High</MenuItem>
                              </TextField>
                            </TableCell>
                            <TableCell align="center">
                              {isManual ? (
                                <IconButton size="small" color="error" onClick={() => handleRemoveEditingItem(index)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              ) : (
                                <Tooltip title="Items from orders cannot be removed">
                                  <span>
                                    <IconButton size="small" disabled>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => setEditDialogOpen(false)}
            variant="outlined"
            disabled={savingPlan}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdatePlan}
            variant="contained"
            disabled={savingPlan}
            startIcon={savingPlan ? <CircularProgress size={20} /> : <SaveIcon />}
            sx={{
              borderRadius: 2,
              fontWeight: 900,
              px: 4,
              bgcolor: theme.palette.text.primary,
              "&:hover": { bgcolor: theme.palette.common.black }
            }}
          >
            {savingPlan ? 'Updating...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

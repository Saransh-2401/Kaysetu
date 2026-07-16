"use client";
import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Can from "@/components/auth/Can";
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
  IconButton,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  LinearProgress,
  Rating,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Tooltip,
  Snackbar,
  Alert,
  Autocomplete,
  SelectChangeEvent,
  TableSortLabel,
} from "@mui/material";
import { motion } from "framer-motion";

import { SearchIcon, AddIcon, EditTwoToneIcon, DeleteTwoToneIcon, LocalShippingIcon, WarningAmberIcon, CloseIcon, RefreshIcon, PhoneIcon, EmailIcon, WhatsAppIcon, StickyNote2OutlinedIcon, VisibilityIcon, FilterAltOffIcon } from "@/components/icons";
import { purchaseService, Supplier, PurchaseOrder, SupplierPriceHistoryItem } from "@/lib/purchase-service";
import { warehouseService, Item } from "@/lib/warehouse-service";

// Supplier category options — mirror backend Supplier.SUPPLIER_GROUP_CHOICES.
const SUPPLIER_GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'local', label: 'Local' },
  { value: 'international', label: 'International' },
  { value: 'services', label: 'Services' },
];
const groupLabel = (g?: string | null) =>
  SUPPLIER_GROUP_OPTIONS.find((o) => o.value === g)?.label || '—';

export default function SupplierMasterPage() {
  const theme = useTheme();
  const searchParams = useSearchParams();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState<string>('supplier_name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const [openDialog, setOpenDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<Supplier>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState(3);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const [rawMaterials, setRawMaterials] = useState<Item[]>([]);
  const [rawMaterialFilter, setRawMaterialFilter] = useState<Item[]>([]);

  // View Details Dialog
  const [viewDialog, setViewDialog] = useState<{ open: boolean; supplier: Supplier | null }>({
    open: false,
    supplier: null,
  });

  // Purchase-order history for the supplier shown in the View Details dialog
  const [supplierPOs, setSupplierPOs] = useState<PurchaseOrder[]>([]);
  const [posLoading, setPosLoading] = useState(false);

  // Per-item price history for the supplier shown in the View Details dialog
  const [priceHistory, setPriceHistory] = useState<SupplierPriceHistoryItem[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);

  // Item options for the "Supplied Items" picker. Always includes the items
  // already assigned to the supplier being edited (from supplied_items_details),
  // so an assignment is never silently dropped if its item is inactive/archived
  // or outside the fetched page.
  const itemOptions = useMemo(() => {
    const map = new Map<number, Item>();
    rawMaterials.forEach((rm) => map.set(rm.id, rm));
    (currentItem.supplied_items_details || []).forEach((it: any) => {
      if (it && it.id != null && !map.has(it.id)) map.set(it.id, it as Item);
    });
    return Array.from(map.values());
  }, [rawMaterials, currentItem.supplied_items_details]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await purchaseService.getSuppliers({ page_size: "1000" });
      setSuppliers(response.results || []);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch suppliers",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRawMaterials = async () => {
    try {
      // Mirror the Item Master (/items) list exactly: every item created via the
      // New Item modal, regardless of category or status. (Previously this filtered
      // to status=active/is_active=true, which hid items that appear in Item Master.)
      const resp = await warehouseService.getItems({ page_size: "1000" });
      setRawMaterials(resp.results || []);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchRawMaterials();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, statusFilter, categoryFilter, rawMaterialFilter]);

  // Load purchase-order history + per-item price history for the supplier in the
  // View Details dialog.
  useEffect(() => {
    if (!viewDialog.open || !viewDialog.supplier) {
      setSupplierPOs([]);
      setPriceHistory([]);
      return;
    }
    let active = true;
    const supplierId = viewDialog.supplier.id;
    (async () => {
      try {
        setPosLoading(true);
        const res = await purchaseService.getPurchaseOrders({
          supplier: String(supplierId),
          ordering: "-order_date",
          page_size: "10",
        });
        if (active) setSupplierPOs(res.results || []);
      } catch (error) {
        console.error("Failed to fetch supplier purchase orders:", error);
        if (active) setSupplierPOs([]);
      } finally {
        if (active) setPosLoading(false);
      }
    })();
    (async () => {
      try {
        setPriceLoading(true);
        const res = await purchaseService.getSupplierPriceHistory(supplierId);
        if (active) setPriceHistory(res.results || []);
      } catch (error) {
        console.error("Failed to fetch supplier price history:", error);
        if (active) setPriceHistory([]);
      } finally {
        if (active) setPriceLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [viewDialog.open, viewDialog.supplier]);

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) setStatusFilter(urlStatus);
  }, [searchParams]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (deleteDialogOpen && deleteTimer > 0)
      interval = setInterval(() => setDeleteTimer((p: number) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [deleteDialogOpen, deleteTimer]);

  const filtered = useMemo(
    () =>
      suppliers.filter((s: Supplier) => {
        const matchesSearch =
          s.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.business_name && s.business_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          s.supplier_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.email?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && s.is_active) ||
          (statusFilter === 'inactive' && !s.is_active);
        const matchesCategory =
          categoryFilter === 'all' || s.supplier_group === categoryFilter;
        const matchesRawMaterial =
          rawMaterialFilter.length === 0 ||
          rawMaterialFilter.some(rm => (s.supplied_items || []).includes(rm.id));
        return matchesSearch && matchesStatus && matchesCategory && matchesRawMaterial;
      }),
    [suppliers, searchQuery, statusFilter, categoryFilter, rawMaterialFilter]
  );

  const sortedFiltered = useMemo(() => {
    const sorted = [...filtered].sort((a: any, b: any) => {
      let valA = a[orderBy];
      let valB = b[orderBy];

      if (orderBy === 'contact_details') {
        valA = a.phone || a.email || '';
        valB = b.phone || b.email || '';
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filtered, order, orderBy]);

  const paginated = useMemo(() => {
    return sortedFiltered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedFiltered, page, rowsPerPage]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!currentItem.supplier_name) newErrors.supplier_name = "Name is required";

    if (currentItem.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(currentItem.email)) {
        newErrors.email = "Invalid email format";
      }
    }

    if (!currentItem.phone) {
      newErrors.phone = "Phone number is required";
    } else {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(currentItem.phone)) {
        newErrors.phone = "Phone must be exactly 10 digits";
      }
    }

    if (!currentItem.billing_address) {
      newErrors.billing_address = "Billing address is required";
    } else if (currentItem.billing_address.length > 150) {
      newErrors.billing_address = "Billing address cannot exceed 150 characters";
    }

    if (currentItem.tax_id) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (currentItem.tax_id.length > 15) {
        newErrors.tax_id = "Tax ID cannot exceed 15 characters";
      } else if (!gstinRegex.test(currentItem.tax_id)) {
        newErrors.tax_id = "Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)";
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setSnackbar({
        open: true,
        message: "Please fix the validation errors",
        severity: "warning",
      });
      return false;
    }

    return true;
  };

  const handleOpenAdd = () => {
    setCurrentItem({
      supplier_name: "",
      business_name: "",
      email: "",
      phone: "",
      is_active: true,
      supplied_items: [],
      billing_address: "",
    });
    setErrors({});
    setOpenDialog(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setCurrentItem({ ...supplier });
    setErrors({});
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!validate() || saving) return;

    setSaving(true);
    try {
      if (currentItem.id) {
        await purchaseService.updateSupplier(currentItem.id, currentItem);
        setSnackbar({
          open: true,
          message: "Supplier updated successfully",
          severity: "success",
        });
      } else {
        await purchaseService.createSupplier(currentItem);
        setSnackbar({
          open: true,
          message: "Supplier created successfully",
          severity: "success",
        });
      }
      setOpenDialog(false);
      fetchSuppliers();
    } catch (error: any) {
      console.error("Failed to save supplier:", error);
      setSnackbar({
        open: true,
        message: error.message || "Failed to save supplier",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!supplierToDelete || saving) return;
    setSaving(true);
    try {
      await purchaseService.deleteSupplier(supplierToDelete.id);
      setSnackbar({
        open: true,
        message: "Supplier deleted successfully",
        severity: "success",
      });
      setDeleteDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      console.error("Failed to delete supplier:", error);
      setSnackbar({
        open: true,
        message: error.message || "Failed to delete supplier",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Stack
            direction="row"
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
                Supplier Master
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage your raw material and service providers
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => { setPage(0); setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); setRawMaterialFilter([]); fetchSuppliers(); }}
                sx={{ borderRadius: 2 }}
                data-testid="supplier-refresh-btn"
              >
                Refresh
              </Button>
              <Can module="suppliers" action="create">
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleOpenAdd}
                  data-testid="supplier-add-btn"
                  sx={{
                    px: 3,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
                  }}
                >
                  Add Supplier
                </Button>
              </Can>
            </Stack>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 1,
              boxShadow: "0px 4px 30px rgba(0,0,0,0.02)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, mr: 2 }}>
                <TextField
                  placeholder="Search suppliers by name, code or email..."
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: alpha(theme.palette.text.primary, 0.4) }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 350,
                    maxWidth: 700,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.text.primary, 0.05),
                      "& fieldset": { border: 'none' },
                      "&:hover": {
                        bgcolor: alpha(theme.palette.text.primary, 0.08),
                      },
                      "&.Mui-focused": {
                        bgcolor: alpha(theme.palette.text.primary, 0.02),
                        boxShadow: `0 0 0 2px ${alpha(theme.palette.secondary.main, 0.2)}`,
                      }
                    },
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
                    data-testid="supplier-status-filter"
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="active">Active Only</MenuItem>
                    <MenuItem value="inactive">Inactive Only</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={categoryFilter}
                    label="Category"
                    onChange={(e: SelectChangeEvent) => setCategoryFilter(e.target.value)}
                    data-testid="supplier-category-filter"
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {SUPPLIER_GROUP_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Autocomplete
                  multiple
                  size="small"
                  options={rawMaterials}
                  getOptionLabel={(option) => `${option.item_name} (${option.item_code})`}
                  value={rawMaterialFilter}
                  onChange={(_, newValue) => setRawMaterialFilter(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} label="Filter by Item" placeholder={rawMaterialFilter.length === 0 ? "Select items..." : ""} />
                  )}
                  renderTags={(value, getTagProps) => {
                    if (value.length === 0) return null;
                    return (
                      <Typography variant="body2" sx={{ ml: 1, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {value.map(v => v.item_name).join(', ')}
                      </Typography>
                    );
                  }}
                  sx={{ minWidth: 280 }}
                />

              </Stack>

              {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || rawMaterialFilter.length > 0) && (
                <Tooltip title="Clear Filters">
                  <IconButton
                    data-testid="supplier-clear-filters-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setCategoryFilter('all');
                      setRawMaterialFilter([]);
                      setPage(0);
                    }}
                    sx={{
                      bgcolor: alpha(theme.palette.error.main, 0.05),
                      color: theme.palette.error.main,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.error.main, 0.1),
                      }
                    }}
                  >
                    <FilterAltOffIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.02) }}
                  >
                    <TableCell sx={{ fontWeight: 700, pl: 4 }}>
                      <TableSortLabel
                        active={orderBy === 'supplier_name'}
                        direction={orderBy === 'supplier_name' ? order : 'asc'}
                        onClick={() => handleRequestSort('supplier_name')}
                        sx={{ "&.Mui-active": { color: "secondary.main" }, "& .MuiTableSortLabel-icon": { color: "secondary.main !important" } }}
                      >
                        SUPPLIER INFO
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <TableSortLabel
                        active={orderBy === 'contact_details'}
                        direction={orderBy === 'contact_details' ? order : 'asc'}
                        onClick={() => handleRequestSort('contact_details')}
                        sx={{ "&.Mui-active": { color: "secondary.main" }, "& .MuiTableSortLabel-icon": { color: "secondary.main !important" } }}
                      >
                        CONTACT DETAILS
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <TableSortLabel
                        active={orderBy === 'is_active'}
                        direction={orderBy === 'is_active' ? order : 'asc'}
                        onClick={() => handleRequestSort('is_active')}
                        sx={{ "&.Mui-active": { color: "secondary.main" }, "& .MuiTableSortLabel-icon": { color: "secondary.main !important" } }}
                      >
                        STATUS
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <TableSortLabel
                        active={orderBy === 'po_count'}
                        direction={orderBy === 'po_count' ? order : 'asc'}
                        onClick={() => handleRequestSort('po_count')}
                        sx={{ "&.Mui-active": { color: "secondary.main" }, "& .MuiTableSortLabel-icon": { color: "secondary.main !important" } }}
                      >
                        PURCHASES
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      <TableSortLabel
                        active={orderBy === 'last_po_date'}
                        direction={orderBy === 'last_po_date' ? order : 'asc'}
                        onClick={() => handleRequestSort('last_po_date')}
                        sx={{ "&.Mui-active": { color: "secondary.main" }, "& .MuiTableSortLabel-icon": { color: "secondary.main !important" } }}
                      >
                        LAST PO
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 700, textAlign: "right", pr: 4 }}
                    >
                      ACTIONS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 10, textAlign: "center" }}>
                        <CircularProgress size={40} thickness={4} color="secondary" />
                        <Typography variant="body2" color="text.secondary" mt={2}>
                          Loading suppliers...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 10, textAlign: "center" }}>
                        <Box sx={{ opacity: 0.5, mb: 2 }}>
                          <LocalShippingIcon sx={{ fontSize: 60 }} />
                        </Box>
                        <Typography variant="h6" fontWeight={700}>
                          No Suppliers Found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {searchQuery ? "No results match your search criteria" : "Start by adding your first supplier"}
                        </Typography>
                        {!searchQuery && (
                          <Button
                            variant="text"
                            startIcon={<AddIcon />}
                            onClick={handleOpenAdd}
                            sx={{ mt: 2 }}
                          >
                            Add Your First Supplier
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {paginated.map((row) => (
                        <TableRow
                          key={row.id}
                          hover
                          sx={{ "&:last-child td": { border: 0 } }}
                        >
                          <TableCell sx={{ pl: 4 }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Avatar
                                sx={{
                                  bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                  color: "secondary.main",
                                  width: 40,
                                  height: 40,
                                  fontWeight: 800,
                                  fontSize: '0.9rem'
                                }}
                              >
                                {row.supplier_name.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700} title={row.supplier_name.length > 40 ? row.supplier_name : undefined}>
                                  {row.supplier_name.length > 40 ? `${row.supplier_name.slice(0, 40)}…` : row.supplier_name}
                                </Typography>
                                {row.business_name && (
                                  <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontWeight: 600 }} title={row.business_name.length > 40 ? row.business_name : undefined}>
                                    {row.business_name.length > 40 ? `${row.business_name.slice(0, 40)}…` : row.business_name}
                                  </Typography>
                                )}
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                                  {row.supplier_code}
                                </Typography>
                                {row.supplied_items_details && row.supplied_items_details.length > 0 && (
                                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {row.supplied_items_details.slice(0, 3).map((item) => (
                                      <Chip
                                        key={item.id}
                                        label={item.item_name}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          fontSize: '0.65rem',
                                          height: 20,
                                          borderColor: alpha(theme.palette.secondary.main, 0.3),
                                          bgcolor: alpha(theme.palette.secondary.main, 0.02)
                                        }}
                                      />
                                    ))}
                                    {row.supplied_items_details.length > 3 && (
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', alignSelf: 'center' }}>
                                        +{row.supplied_items_details.length - 3} more
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <Typography variant="body2" fontWeight={500}>{row.phone || "---"}</Typography>
                              <Typography variant="caption" color="text.secondary">{row.email || "---"}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                label={row.is_active ? "Active" : "Inactive"}
                                size="small"
                                color={row.is_active ? "success" : "default"}
                                sx={{ fontWeight: 600 }}
                              />
                              {row.notes && (
                                <Tooltip title={row.notes}>
                                  <StickyNote2OutlinedIcon fontSize="small" sx={{ color: 'warning.main' }} />
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {row.po_count ?? 0} {(row.po_count ?? 0) === 1 ? 'PO' : 'POs'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ₹{Number(row.total_spent || 0).toLocaleString('en-IN')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color={row.last_po_date ? "text.primary" : "text.secondary"} fontWeight={600}>
                              {row.last_po_date ? new Date(row.last_po_date).toLocaleDateString() : "Never"}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ pr: 4 }}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => setViewDialog({ open: true, supplier: row })}
                                sx={{ color: "secondary.main", mr: 1 }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Call">
                              <IconButton
                                size="small"
                                href={`tel:${row.phone}`}
                                data-testid={`supplier-call-btn-${row.id}`}
                                sx={{ color: "success.main", mr: 1 }}
                              >
                                <PhoneIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="WhatsApp">
                              <span>
                                <IconButton
                                  size="small"
                                  component="a"
                                  href={row.phone ? `https://wa.me/${row.phone.replace(/\D/g, '').length === 10 ? '91' : ''}${row.phone.replace(/\D/g, '')}` : undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  disabled={!row.phone}
                                  data-testid={`supplier-whatsapp-btn-${row.id}`}
                                  sx={{ color: "#25D366", mr: 1 }}
                                >
                                  <WhatsAppIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Email">
                              <IconButton
                                size="small"
                                href={`mailto:${row.email}`}
                                data-testid={`supplier-email-btn-${row.id}`}
                                sx={{ color: "info.main", mr: 1 }}
                              >
                                <EmailIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Can module="suppliers" action="edit">
                              <Tooltip title="Edit Supplier">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenEdit(row)}
                                  sx={{ color: "primary.main", mr: 1 }}
                                >
                                  <EditTwoToneIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Can>
                            <Can module="suppliers" action="delete">
                              <Tooltip title="Delete Supplier">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSupplierToDelete(row);
                                    setDeleteTimer(3);
                                    setDeleteDialogOpen(true);
                                  }}
                                  sx={{ color: "error.main" }}
                                >
                                  <DeleteTwoToneIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Can>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(e, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </Paper>

          {/* --- VIEW DETAILS DIALOG --- */}
          <Dialog
            open={viewDialog.open}
            onClose={() => setViewDialog({ open: false, supplier: null })}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 1 } }}
          >
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 800,
              }}
            >
              Supplier Details
              <IconButton onClick={() => setViewDialog({ open: false, supplier: null })} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {viewDialog.supplier && (
                <Box sx={{ py: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                    <Avatar
                      sx={{
                        width: 56,
                        height: 56,
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        color: theme.palette.secondary.main,
                        fontWeight: 800,
                        fontSize: '1.5rem',
                      }}
                    >
                      {viewDialog.supplier.supplier_name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight={800}>
                        {viewDialog.supplier.supplier_name}
                      </Typography>
                      {viewDialog.supplier.business_name && (
                        <Typography variant="body2" color="text.secondary">
                          {viewDialog.supplier.business_name}
                        </Typography>
                      )}
                      <Chip
                        label={viewDialog.supplier.is_active ? "Active" : "Inactive"}
                        size="small"
                        color={viewDialog.supplier.is_active ? "success" : "default"}
                        sx={{ fontWeight: 600, mt: 0.5 }}
                      />
                    </Box>
                  </Stack>

                  <Grid container spacing={2.5}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>SUPPLIER CODE</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                        {viewDialog.supplier.supplier_code}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>CATEGORY</Typography>
                      <Typography variant="body2" fontWeight={600}>{groupLabel(viewDialog.supplier.supplier_group)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>CONTACT PERSON</Typography>
                      <Typography variant="body2" fontWeight={600}>{viewDialog.supplier.contact_person || '---'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>PHONE</Typography>
                      <Typography variant="body2" fontWeight={600}>{viewDialog.supplier.phone || '---'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>EMAIL</Typography>
                      <Typography variant="body2" fontWeight={600}>{viewDialog.supplier.email || '---'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>TAX ID</Typography>
                      <Typography variant="body2" fontWeight={600}>{viewDialog.supplier.tax_id || '---'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL SPENT</Typography>
                      <Typography variant="body2" fontWeight={800} color="secondary.main">
                        ₹{Number(viewDialog.supplier.total_spent || 0).toLocaleString('en-IN')}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontWeight: 600 }}>
                          ({viewDialog.supplier.po_count ?? 0} {((viewDialog.supplier.po_count ?? 0) === 1) ? 'PO' : 'POs'})
                        </Typography>
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>OUTSTANDING</Typography>
                      <Typography variant="body2" fontWeight={800} color={Number(viewDialog.supplier.outstanding_balance || 0) > 0 ? "error.main" : "success.main"}>
                        ₹{Number(viewDialog.supplier.outstanding_balance || 0).toLocaleString('en-IN')}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>PAYMENT TERMS</Typography>
                      <Typography variant="body2" fontWeight={600}>{viewDialog.supplier.payment_terms || '---'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>BILLING ADDRESS</Typography>
                      <Typography variant="body2" fontWeight={600}>{viewDialog.supplier.billing_address || '---'}</Typography>
                    </Grid>
                    {(() => {
                      const bd = viewDialog.supplier?.bank_details || {};
                      const rows = [
                        ['Account Holder', bd.account_name],
                        ['Account Number', bd.account_number],
                        ['Bank', bd.bank_name],
                        ['IFSC', bd.ifsc],
                        ['UPI', bd.upi],
                      ].filter(([, v]) => !!v);
                      if (rows.length === 0) return null;
                      return (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700} gutterBottom sx={{ display: 'block' }}>
                            BANK & PAYMENT DETAILS
                          </Typography>
                          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.secondary.main, 0.04), border: `1px solid ${alpha(theme.palette.divider, 0.15)}` }}>
                            <Grid container spacing={1.5}>
                              {rows.map(([label, value]) => (
                                <Grid size={{ xs: 6 }} key={label as string}>
                                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                                  <Typography variant="body2" fontWeight={600} sx={{ fontFamily: label === 'Account Number' || label === 'IFSC' ? 'monospace' : 'inherit' }}>
                                    {value}
                                  </Typography>
                                </Grid>
                              ))}
                            </Grid>
                          </Box>
                        </Grid>
                      );
                    })()}
                    {viewDialog.supplier.notes && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>NOTES / SPECIAL INSTRUCTIONS</Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'pre-wrap' }}>{viewDialog.supplier.notes}</Typography>
                      </Grid>
                    )}
                  </Grid>

                  {viewDialog.supplier.supplied_items_details && viewDialog.supplier.supplied_items_details.length > 0 && (
                    <Box mt={3}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} gutterBottom>
                        SUPPLIED ITEMS ({viewDialog.supplier.supplied_items_details.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                        {viewDialog.supplier.supplied_items_details.map((item) => (
                          <Chip
                            key={item.id}
                            label={`${item.item_name} (${item.item_code})`}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontWeight: 600,
                              borderColor: alpha(theme.palette.secondary.main, 0.3),
                              bgcolor: alpha(theme.palette.secondary.main, 0.04)
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* PURCHASE ORDER HISTORY */}
                  <Box mt={3}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} gutterBottom>
                      PURCHASE ORDER HISTORY
                    </Typography>
                    {posLoading ? (
                      <Stack alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size={22} />
                      </Stack>
                    ) : supplierPOs.length === 0 ? (
                      <Typography variant="body2" color="text.disabled" sx={{ mt: 1, fontStyle: 'italic' }}>
                        No purchase orders raised for this supplier yet.
                      </Typography>
                    ) : (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        {supplierPOs.map((po) => (
                          <Stack
                            key={po.id}
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{
                              p: 1.2,
                              borderRadius: 1,
                              border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                              bgcolor: alpha(theme.palette.primary.main, 0.02),
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                                {po.po_number}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {po.order_date ? new Date(po.order_date).toLocaleDateString('en-IN') : '--'}
                              </Typography>
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="body2" fontWeight={700}>
                                ₹{Number(po.total || 0).toLocaleString('en-IN')}
                              </Typography>
                              <Chip
                                label={(po.status || '').replace(/_/g, ' ')}
                                size="small"
                                color={po.status === 'approved' ? 'success' : po.status === 'cancelled' || po.status === 'rejected' ? 'error' : 'default'}
                                sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                              />
                            </Stack>
                          </Stack>
                        ))}
                        <Button
                          size="small"
                          onClick={() => {
                            const sid = viewDialog.supplier?.id;
                            setViewDialog({ open: false, supplier: null });
                            if (sid) window.location.assign(`/purchase-orders?supplier=${sid}`);
                          }}
                          sx={{ alignSelf: 'flex-end', textTransform: 'none' }}
                        >
                          View all in Purchase Orders →
                        </Button>
                      </Stack>
                    )}
                  </Box>

                  {/* PRICE HISTORY (per supplied item) */}
                  <Box mt={3}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} gutterBottom>
                      PRICE HISTORY (PER ITEM)
                    </Typography>
                    {priceLoading ? (
                      <Stack alignItems="center" sx={{ py: 2 }}>
                        <CircularProgress size={22} />
                      </Stack>
                    ) : priceHistory.length === 0 ? (
                      <Typography variant="body2" color="text.disabled" sx={{ mt: 1, fontStyle: 'italic' }}>
                        No purchase-order pricing recorded for this supplier yet.
                      </Typography>
                    ) : (
                      <Stack spacing={0.75} sx={{ mt: 1, maxHeight: 240, overflowY: 'auto' }}>
                        {priceHistory.map((ph) => (
                          <Tooltip
                            key={ph.item_id}
                            arrow
                            placement="left"
                            title={
                              <Box sx={{ py: 0.5 }}>
                                <Typography variant="caption" fontWeight={800} display="block" sx={{ mb: 0.5 }}>
                                  Recent rates ({ph.item_code})
                                </Typography>
                                {ph.history.map((h, i) => (
                                  <Typography key={i} variant="caption" display="block">
                                    {h.po_number} · {h.order_date ? new Date(h.order_date).toLocaleDateString('en-IN') : '--'} · ₹{Number(h.rate).toLocaleString('en-IN')}
                                  </Typography>
                                ))}
                              </Box>
                            }
                          >
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              data-testid={`supplier-price-${ph.item_id}`}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                                bgcolor: alpha(theme.palette.secondary.main, 0.02),
                                cursor: 'help',
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={700} noWrap title={ph.item_name}>{ph.item_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {ph.po_count} {ph.po_count === 1 ? 'PO' : 'POs'}
                                  {ph.min_rate !== ph.max_rate ? ` · ₹${Number(ph.min_rate).toLocaleString('en-IN')}–₹${Number(ph.max_rate).toLocaleString('en-IN')}` : ''}
                                </Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                                <Typography variant="body2" fontWeight={800} color="secondary.main">
                                  ₹{Number(ph.last_rate).toLocaleString('en-IN')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  last{ph.last_order_date ? ` · ${new Date(ph.last_order_date).toLocaleDateString('en-IN')}` : ''}
                                </Typography>
                              </Box>
                            </Stack>
                          </Tooltip>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => { window.location.assign('/material-requests'); }}
                sx={{ borderRadius: 2, mr: 'auto' }}
                data-testid="supplier-create-mr-btn"
              >
                Create Material Request
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setViewDialog({ open: false, supplier: null });
                  if (viewDialog.supplier) handleOpenEdit(viewDialog.supplier);
                }}
                sx={{ borderRadius: 2 }}
              >
                Edit Supplier
              </Button>
              <Button
                onClick={() => setViewDialog({ open: false, supplier: null })}
                color="inherit"
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>

          {/* --- ADD / EDIT DIALOG --- */}
          <Dialog
            open={openDialog}
            onClose={() => setOpenDialog(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 1 } }}
          >
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 800,
              }}
            >
              {currentItem.id ? "Edit Supplier" : "Add New Supplier"}
              <IconButton onClick={() => setOpenDialog(false)} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Supplier Name"
                    fullWidth
                    required
                    error={!!errors.supplier_name}
                    helperText={errors.supplier_name}
                    value={currentItem.supplier_name || ""}
                    onChange={(e) => {
                      setCurrentItem({ ...currentItem, supplier_name: e.target.value });
                      if (errors.supplier_name) setErrors({ ...errors, supplier_name: "" });
                    }}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Business Name"
                    fullWidth
                    value={currentItem.business_name || ""}
                    onChange={(e) => setCurrentItem({ ...currentItem, business_name: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Contact Person"
                    fullWidth
                    placeholder="e.g. Rajesh Kumar"
                    value={currentItem.contact_person || ""}
                    onChange={(e) => setCurrentItem({ ...currentItem, contact_person: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 150, "data-testid": "supplier-contact-person-input" } as any }}
                  />
                </Grid>
                {currentItem.id && (
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Supplier Code"
                      fullWidth
                      disabled
                      value={currentItem.supplier_code || ""}
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Email Address"
                    type="email"
                    fullWidth
                    error={!!errors.email}
                    helperText={errors.email}
                    value={currentItem.email || ""}
                    onChange={(e) => {
                      setCurrentItem({ ...currentItem, email: e.target.value });
                      if (errors.email) setErrors({ ...errors, email: "" });
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Phone Number"
                    fullWidth
                    required
                    error={!!errors.phone}
                    helperText={errors.phone}
                    value={currentItem.phone || ""}
                    onChange={(e) => {
                      setCurrentItem({ ...currentItem, phone: e.target.value });
                      if (errors.phone) setErrors({ ...errors, phone: "" });
                    }}
                    slotProps={{ htmlInput: { maxLength: 10 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Tax ID (GST/VAT/TAX)"
                    fullWidth
                    error={!!errors.tax_id}
                    helperText={errors.tax_id}
                    value={currentItem.tax_id || ""}
                    onChange={(e) => {
                      setCurrentItem({ ...currentItem, tax_id: e.target.value.toUpperCase() });
                      if (errors.tax_id) setErrors({ ...errors, tax_id: "" });
                    }}
                    slotProps={{ htmlInput: { maxLength: 15 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Supplier Category</InputLabel>
                    <Select
                      value={currentItem.supplier_group || ""}
                      label="Supplier Category"
                      displayEmpty
                      onChange={(e) => setCurrentItem({ ...currentItem, supplier_group: e.target.value })}
                      data-testid="supplier-category-input"
                    >
                      <MenuItem value=""><em>Unspecified</em></MenuItem>
                      {SUPPLIER_GROUP_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={currentItem.is_active ? "active" : "inactive"}
                      label="Status"
                      onChange={(e) => setCurrentItem({ ...currentItem, is_active: e.target.value === "active" })}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Billing Address"
                    fullWidth
                    required
                    multiline
                    rows={2}
                    error={!!errors.billing_address}
                    helperText={errors.billing_address}
                    value={currentItem.billing_address || ""}
                    onChange={(e) => {
                      setCurrentItem({ ...currentItem, billing_address: e.target.value });
                      if (errors.billing_address) setErrors({ ...errors, billing_address: "" });
                    }}
                    slotProps={{ htmlInput: { maxLength: 150 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Notes / Special Instructions"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Payment terms, delivery conditions, or any special instructions…"
                    value={currentItem.notes || ""}
                    onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 1000, "data-testid": "supplier-notes-input" } as any }}
                  />
                </Grid>

                {/* Bank & payment details (stored in the supplier's bank_details JSON) */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>
                    Bank & Payment Details
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Payment Terms"
                    fullWidth
                    placeholder="e.g. Net 30"
                    value={currentItem.payment_terms || ""}
                    onChange={(e) => setCurrentItem({ ...currentItem, payment_terms: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 100, "data-testid": "supplier-payment-terms-input" } as any }}
                  />
                </Grid>
                {[
                  { key: "account_name", label: "Account Holder Name", md: 6 },
                  { key: "account_number", label: "Account Number", md: 6 },
                  { key: "bank_name", label: "Bank Name", md: 6 },
                  { key: "ifsc", label: "IFSC Code", md: 6, upper: true },
                  { key: "upi", label: "UPI ID", md: 6 },
                ].map((f) => (
                  <Grid size={{ xs: 12, md: f.md as 6 }} key={f.key}>
                    <TextField
                      label={f.label}
                      fullWidth
                      value={currentItem.bank_details?.[f.key] || ""}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          bank_details: {
                            ...(currentItem.bank_details || {}),
                            [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value,
                          },
                        })
                      }
                      slotProps={{ htmlInput: { maxLength: 100, "data-testid": `supplier-bank-${f.key}-input` } as any }}
                    />
                  </Grid>
                ))}
                <Grid size={{ xs: 12 }}>
                  <Autocomplete
                    multiple
                    options={itemOptions}
                    getOptionLabel={(option) => `${option.item_name} (${option.item_code})`}
                    isOptionEqualToValue={(option, val) => option.id === val.id}
                    value={itemOptions.filter(rm => (currentItem.supplied_items || []).includes(rm.id))}
                    onChange={(event, newValue) => {
                      setCurrentItem({
                        ...currentItem,
                        supplied_items: newValue.map(v => v.id)
                      });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Supplied Items"
                        placeholder="Search items..."
                        helperText="Assign one or more items (materials/products) to this supplier"
                      />
                    )}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.secondary.main, 0.02)
                      }
                    }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setOpenDialog(false)} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                sx={{
                  px: 4,
                  borderRadius: 2,
                  minWidth: 140,
                  background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
                }}
              >
                {saving ? <CircularProgress size={24} color="inherit" /> : "Save Supplier"}
              </Button>
            </DialogActions>
          </Dialog>

          {/* --- DELETE DIALOG --- */}
          <Dialog
            open={deleteDialogOpen}
            onClose={() => {
              if (deleteTimer === 0 && !saving) setDeleteDialogOpen(false);
            }}
            PaperProps={{ sx: { p: 2, borderRadius: 1, minWidth: 350 } }}
          >
            <Box textAlign="center" pt={1}>
              <WarningAmberIcon
                sx={{ fontSize: 60, color: "error.main", mb: 2, opacity: 0.8 }}
              />
              <Typography variant="h5" fontWeight={800}>Delete Supplier?</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                Are you sure you want to remove <b>{supplierToDelete?.supplier_name}</b>?
                <br />
                This action cannot be undone.
              </Typography>
              {deleteTimer > 0 ? (
                <Stack spacing={1} alignItems="center">
                  <Typography variant="caption" color="error.main" fontWeight={700}>
                    SECURITY LOCK: {deleteTimer}s
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(3 - deleteTimer) * 33.33}
                    color="error"
                    sx={{ width: '100%', height: 6, borderRadius: 1 }}
                  />
                </Stack>
              ) : (
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled={saving}
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Keep It
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    disabled={saving}
                    onClick={handleDelete}
                    sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
                  >
                    {saving ? <CircularProgress size={24} color="inherit" /> : "Confirm Delete"}
                  </Button>
                </Stack>
              )}
            </Box>
          </Dialog>

          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert
              onClose={() => setSnackbar({ ...snackbar, open: false })}
              severity={snackbar.severity}
              sx={{ width: '100%', borderRadius: 1, fontWeight: 600 }}
              variant="filled"
              elevation={6}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </motion.div>
      </Box>
    </>
  );
}

"use client";
import React, { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  useTheme,
  alpha,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Badge,
  Snackbar,
  Alert,
  TableSortLabel,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { ClearIcon, SearchIcon, RefreshIcon, AddIcon, EditTwoToneIcon, DeleteTwoToneIcon, FilterListIcon, Inventory2Icon, CategoryIcon, MonetizationOnIcon, WarningAmberIcon, CloseIcon, CompareArrowsIcon } from "@/components/icons";

// Icons
import StockAdjustmentModal from "@/components/warehouse/StockAdjustmentModal";
import { apiClient, API_BASE_URL } from "@/lib/api-client";

// --- MOCK DATA ---
interface Item {
  id: number;
  code: string;
  name: string;
  codeName?: string;
  hsnSac?: string;
  category: any; // Can be ID or Name depending on context
  category_name?: string;
  stock: number;
  uom: string;
  price: number;
  cost: number;
  status: string; // Used for stock status
  reorderLevel: number;
  image?: string;
}

const DEFAULT_CATEGORIES = [
  "Finished",
  "Finished and Unpacked Item",
  "Packing Material",
  "Raw Material",
  "Spare parts",
];


// --- STAT CARD ---
// Quantities without noisy trailing decimals (157.000 -> 157, 1.5 -> 1.5).
const fmtQty = (n: any) => {
  const v = Number(n) || 0;
  return Number.isInteger(v)
    ? v.toLocaleString("en-IN")
    : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

const StatCard = ({ title, value, icon, color, alert, onClick, testId }: any) => (
  <Paper
    data-animate-group
    onClick={onClick}
    data-testid={testId}
    elevation={0}
    sx={{
      p: 2.5,

      bgcolor: "background.paper",
      display: "flex",
      alignItems: "center",
      gap: 2,
      border: "none",
      boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
      transition: "transform 0.2s",
      cursor: onClick ? 'pointer' : 'default',
      "&:hover": { transform: "translateY(-3px)", boxShadow: onClick ? "0px 4px 20px rgba(0,0,0,0.05)" : "0px 4px 20px rgba(0,0,0,0.02)" },
    }}
  >
    <Avatar
      variant="rounded"
      sx={{
        bgcolor: alpha(color, 0.1),
        color: color,
        width: 54,
        height: 54,
        borderRadius: 1,
      }}
    >
      {icon}
    </Avatar>
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Typography
        variant="h5"
        fontWeight={800}
        sx={{
          color: "text.primary",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          width: "100%",
        }}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" fontWeight={600}>
        {title}
      </Typography>
    </Box>
    {alert && (
      <Chip
        label={alert}
        size="small"
        color="error"
        sx={{
          borderRadius: 1,
          fontWeight: 700,
          height: 20,
          fontSize: "0.7rem",
        }}
      />
    )}
  </Paper>
);

export default function ItemMasterPage() {
  const theme = useTheme();

  // --- STATE ---
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modal State
  const [openDialog, setOpenDialog] = useState(false);
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [openUomDialog, setOpenUomDialog] = useState(false);
  const [openManageCategoryDialog, setOpenManageCategoryDialog] = useState(false);
  const [openManageUomDialog, setOpenManageUomDialog] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [uomSearchQuery, setUomSearchQuery] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newUomName, setNewUomName] = useState("");
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [uoms, setUoms] = useState<string[]>(["Unit", "Kilogram", "Liter", "Meter", "Box", "Pieces", "Nos"]);
  const [currentItem, setCurrentItem] = useState<Partial<Item>>({});
  const [dialogTab, setDialogTab] = useState(0); // 0: General, 1: Pricing, 2: Inventory

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

  // Adjustment Modal State
  const [openAdjustmentDialog, setOpenAdjustmentDialog] = useState(false);
  const [adjustmentTarget, setAdjustmentTarget] = useState<Item | null>(null);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" as "success" | "error" | "warning" | "info" });

  const API_BASE = `${API_BASE_URL}/warehouse`;

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const itemsData = await apiClient.get<any>(`/warehouse/items/`, { page_size: "1000" });
      const catsData = await apiClient.get<any>(`/warehouse/items/categories/`);
      const uomsData = await apiClient.get<any>(`/warehouse/items/uoms/`);

      // Categories and UOMs are now returned as simple string arrays
      setCategories(Array.isArray(catsData) ? catsData : []);
      setUoms(Array.isArray(uomsData) ? uomsData : []);

      const itemsArray = Array.isArray(itemsData) ? itemsData : (itemsData.results || []);

      // Map backend to frontend
      const statusMap: { [key: string]: string } = {
        "in_stock": "In Stock",
        "out_of_stock": "Out of Stock"
      };

      const mappedItems = itemsArray.map((item: any) => ({
        id: item.id,
        code: item.item_code,
        name: item.item_name,
        codeName: item.code_name,
        hsnSac: item.hsn_code,
        category: item.category,
        category_name: item.category, // Same as category now
        stock: parseFloat(item.current_stock) || 0,
        uom: item.uom,
        price: parseFloat(item.standard_rate) || 0,
        cost: parseFloat(item.valuation_rate) || 0,
        status: item.status || "active",
        reorderLevel: parseFloat(item.reorder_level) || 0,
      }));
      setItems(mappedItems);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const [stockStatusFilter, setStockStatusFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("All");
    setStockStatusFilter("All");
    setStatusFilter("All");
    setSortConfig(null);
    setPage(0);
  };

  React.useEffect(() => {
    setPage(0);
  }, [searchQuery, categoryFilter, stockStatusFilter, statusFilter, sortConfig]);

  // --- LOGIC ---
  const filteredItems = useMemo(() => {
    let filtered = items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.codeName ? item.codeName.toLowerCase().includes(searchQuery.toLowerCase()) : false);
      const matchesCategory =
        categoryFilter === "All" || item.category_name === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    if (stockStatusFilter !== "All") {
      if (stockStatusFilter === "In Stock") {
        filtered = filtered.filter(i => i.stock > i.reorderLevel);
      } else if (stockStatusFilter === "Low Stock") {
        filtered = filtered.filter(i => i.stock > 0 && i.stock <= i.reorderLevel);
      } else if (stockStatusFilter === "Out of Stock") {
        filtered = filtered.filter(i => i.stock <= 0);
      }
    }

    if (statusFilter !== "All") {
      filtered = filtered.filter(i => i.status.toLowerCase() === statusFilter.toLowerCase());
    } else {
      filtered = filtered.filter(i => i.status.toLowerCase() !== "archived");
    }

    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof Item];
        let bVal: any = b[sortConfig.key as keyof Item];

        if (sortConfig.key === 'price') {
          aVal = Number(a.price) || 0;
          bVal = Number(b.price) || 0;
        } else if (sortConfig.key === 'stock') {
          aVal = Number(a.stock) || 0;
          bVal = Number(b.stock) || 0;
        } else if (sortConfig.key === 'name') {
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [items, searchQuery, categoryFilter, stockStatusFilter, statusFilter, sortConfig]);

  const paginatedItems = filteredItems.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const lowStockCount = items.filter(
    (i) => i.category_name !== "Service" && i.stock <= i.reorderLevel
  ).length;
  const totalStockValue = items.reduce(
    (acc, curr) => acc + curr.stock * (curr.cost || 0),
    0
  );

  // --- HANDLERS ---
  const handleOpenAdd = () => {
    setCurrentItem({
      status: "active",
      uom: "",
      category: "",
      stock: 0,
      price: 0,
      cost: 0,
      reorderLevel: 0,
    });
    setDialogTab(0);
    setOpenDialog(true);
  };

  const handleOpenAdjustment = (item: Item) => {
    setAdjustmentTarget(item);
    setOpenAdjustmentDialog(true);
  };

  const handleOpenEdit = (item: Item) => {
    setCurrentItem({ ...item });
    setDialogTab(0);
    setOpenDialog(true);
  };

  const generateAutoCode = (name: string, isCodeName: boolean = false) => {
    if (!name) return "";

    // Sanitize: Alphanumeric and spaces only, then uppercase
    const clean = name.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
    const words = clean.split(/\s+/).filter(w => w.length > 0);

    let base = "";
    if (words.length >= 2) {
      // Take first 3 of first word and first 2 of second word
      base = words[0].substring(0, 3) + words[1].substring(0, 2);
    } else if (words.length === 1) {
      base = words[0].substring(0, 5);
    }

    if (!base) return "";

    // For Code Name, we can be more descriptive
    if (isCodeName) {
      const baseName = words.join("-");
      let uniqueName = baseName;
      let counter = 1;
      while (items.some(item => item.codeName === uniqueName && item.id !== currentItem.id)) {
        uniqueName = `${baseName}-${counter}`;
        counter++;
      }
      return uniqueName;
    }

    // Uniqueness check for Item Code
    let finalCode = base;
    let counter = 1;
    while (items.some(item => item.code === finalCode && item.id !== currentItem.id)) {
      finalCode = `${base}${counter}`;
      counter++;
    }
    return finalCode;
  };

  const handleSave = async () => {
    // Validate required fields
    if (!currentItem.code?.trim()) {
      setToast({
        open: true,
        message: "Item Code is required",
        severity: "error"
      });
      return;
    }

    if (!currentItem.name?.trim()) {
      setToast({
        open: true,
        message: "Item Name is required",
        severity: "error"
      });
      return;
    }

    // Validate HSN Code length (either 6 or 8 digits)
    const hsn = currentItem.hsnSac?.trim() || "";
    if (hsn && !/^\d{6}$|^\d{8}$/.test(hsn)) {
      setToast({
        open: true,
        message: "HSN/SAC code must be either 6 or 8 digits",
        severity: "error"
      });
      return;
    }

    // Uniqueness check for Item Code and Code Name (Front-end precaution)
    const isCodeDuplicate = items.some(i => i.code === currentItem.code && i.id !== currentItem.id);
    const isCodeNameDuplicate = items.some(i => i.codeName === currentItem.codeName && i.id !== currentItem.id);

    if (isCodeDuplicate) {
      setToast({ open: true, message: "Item Code already exists!", severity: "error" });
      return;
    }
    if (isCodeNameDuplicate) {
      setToast({ open: true, message: "Code Name already exists!", severity: "error" });
      return;
    }

    // Convert frontend status to backend format
    const stockStatusMap: { [key: string]: string } = {
      "In Stock": "in_stock",
      "Out of Stock": "out_of_stock"
    };

    const payload = {
      item_code: currentItem.code.trim(),
      item_name: currentItem.name.trim(),
      code_name: currentItem.codeName?.trim() || "",
      hsn_code: currentItem.hsnSac?.trim() || "",
      category: currentItem.category?.trim() || "",
      uom: currentItem.uom || "unit",
      stock_status: (currentItem.stock || 0) > 0 ? "in_stock" : "out_of_stock",
      standard_rate: currentItem.price || 0,
      valuation_rate: currentItem.cost || 0,
      reorder_level: currentItem.reorderLevel || 0,
      status: currentItem.status || "active",
      is_active: currentItem.status === "active",
    };

    try {
      let response;
      if (currentItem.id) {
        response = await apiClient.put<any>(`/warehouse/items/${currentItem.id}/`, payload);
      } else {
        response = await apiClient.post<any>(`/warehouse/items/`, payload);
      }

      if (response) {
        fetchData();
        setOpenDialog(false);
        setToast({
          open: true,
          message: currentItem.id ? "Item updated successfully!" : "Item created successfully!",
          severity: "success"
        });
      } else {
        // apiClient throws on error, so this part handles cases where it might return null
      }
    } catch (error: any) {
      console.error("Save failed - Full error:", error);
      console.error("Save failed - Payload sent:", payload);

      // Extract error message from APIError details
      let errorMessage = error.message || "Failed to save item.";

      if (error.details) {
        const details = error.details;
        if (details.item_code) {
          errorMessage = `Item code: ${Array.isArray(details.item_code) ? details.item_code[0] : details.item_code}`;
        } else if (details.item_name) {
          errorMessage = `Item name: ${Array.isArray(details.item_name) ? details.item_name[0] : details.item_name}`;
        } else if (details.detail) {
          errorMessage = details.detail;
        } else if (typeof details === 'object') {
          // Get all error messages
          const errors = Object.entries(details).map(([field, msgs]: [string, any]) => {
            const message = Array.isArray(msgs) ? msgs[0] : msgs;
            return `${field}: ${message}`;
          });
          errorMessage = errors.join(", ");
        }
      }

      setToast({
        open: true,
        message: errorMessage,
        severity: "error"
      });
    }
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;

    // Check for duplicate (case-insensitive)
    const categoryExists = categories.some(
      cat => cat.toLowerCase() === newCategoryName.trim().toLowerCase()
    );

    if (categoryExists) {
      setToast({
        open: true,
        message: "Category already exists!",
        severity: "error"
      });
      return;
    }

    // Add new category to the list
    const updatedCategories = [...categories, newCategoryName.trim()].sort();
    setCategories(updatedCategories);

    setCurrentItem({ ...currentItem, category: newCategoryName.trim() });
    setNewCategoryName("");
    setOpenCategoryDialog(false);

    setToast({
      open: true,
      message: "Category created successfully!",
      severity: "success"
    });
  };

  const handleCreateUom = () => {
    if (!newUomName.trim()) return;

    // Check for duplicate (case-insensitive)
    const uomExists = uoms.some(
      u => u.toLowerCase() === newUomName.trim().toLowerCase()
    );

    if (uomExists) {
      setToast({
        open: true,
        message: "UOM already exists!",
        severity: "error"
      });
      return;
    }

    // Add new UOM to the list
    const updatedUoms = [...uoms, newUomName.trim()].sort();
    setUoms(updatedUoms);

    setCurrentItem({ ...currentItem, uom: newUomName.trim() });
    setNewUomName("");
    setOpenUomDialog(false);

    setToast({
      open: true,
      message: "UOM created successfully!",
      severity: "success"
    });
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
    // Check if any item is using this category
    const isInUse = items.some(item => item.category === categoryToDelete);

    if (isInUse) {
      setToast({
        open: true,
        message: "Cannot delete category - it is being used by one or more items!",
        severity: "error"
      });
      return;
    }

    // Remove category from list
    const updatedCategories = categories.filter(cat => cat !== categoryToDelete);
    setCategories(updatedCategories);

    setToast({
      open: true,
      message: "Category deleted successfully!",
      severity: "success"
    });
  };

  const handleDeleteUom = (uomToDelete: string) => {
    // Check if any item is using this UOM
    const isInUse = items.some(item => item.uom === uomToDelete);

    if (isInUse) {
      setToast({
        open: true,
        message: "Cannot delete UOM - it is being used by one or more items!",
        severity: "error"
      });
      return;
    }

    // Remove UOM from list
    const updatedUoms = uoms.filter(u => u !== uomToDelete);
    setUoms(updatedUoms);

    setToast({
      open: true,
      message: "UOM deleted successfully!",
      severity: "success"
    });
  };

  const handleDeleteClick = (item: Item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await apiClient.delete(`/warehouse/items/${itemToDelete.id}/`);
      setToast({
        open: true,
        message: "Item deleted successfully!",
        severity: "success",
      });
      fetchData();
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      console.error("Error deleting item:", error);
      setToast({
        open: true,
        message: error.message || "Failed to delete item. It might be in use.",
        severity: "error",
      });
    }
  };

  const getStockStatus = (stock: number, reorder: number, category: string) => {
    if (category === "Service") return { label: "N/A", color: "default" };
    if (stock <= 0) return { label: "Out of Stock", color: "error" };
    // Severity tier within low stock: at/under 25% of reorder is Critical.
    if (reorder > 0 && stock <= reorder * 0.25) return { label: "Critical", color: "error" };
    if (stock <= reorder) return { label: "Low Stock", color: "warning" };
    return { label: "In Stock", color: "success" };
  };

  return (
    <>
      <Box>
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
                Raw Materials
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Raw Material Inventory and Management
                </Typography>
              </Stack>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={fetchData}
                disabled={loading}
                sx={{
                  borderRadius: "12px",
                  px: 3,
                  borderColor: alpha(theme.palette.divider, 0.2),
                }}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>

          {/* STATS */}
          <Grid container spacing={3} mb={4}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Total Items"
                value={items.length}
                icon={<Inventory2Icon />}
                color={theme.palette.primary.main}
                onClick={handleClearFilters}
                testId="rm-kpi-total"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Low Stock Items"
                value={lowStockCount}
                icon={<WarningAmberIcon />}
                color={theme.palette.warning.main}
                alert={lowStockCount > 0 ? "Action Needed" : null}
                onClick={() => { handleClearFilters(); setStockStatusFilter('Low Stock'); }}
                testId="rm-kpi-lowstock"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Categories"
                value={categories.length}
                icon={<CategoryIcon />}
                color={theme.palette.info.main}
                testId="rm-kpi-categories"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Total Value"
                value={`₹${Math.round(totalStockValue).toLocaleString("en-IN")}`}
                icon={<MonetizationOnIcon />}
                color={theme.palette.success.main}
                testId="rm-kpi-totalvalue"
              />
            </Grid>
          </Grid>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.background.paper, 0.5),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <TextField
                sx={{ flexGrow: 1 }}
                size="small"
                placeholder="Search items by name, code, or code name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2 }
                }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  label="Category"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="All">All Categories</MenuItem>
                  {categories.map((cat, index) => (
                    <MenuItem key={index} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Stock Status</InputLabel>
                <Select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value)}
                  label="Stock Status"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="All">All Statuses</MenuItem>
                  <MenuItem value="In Stock">In Stock</MenuItem>
                  <MenuItem value="Low Stock">Low Stock</MenuItem>
                  <MenuItem value="Out of Stock">Out of Stock</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="All">All Types</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
              <Button
                color="error"
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                sx={{ borderRadius: 2, whiteSpace: "nowrap", height: 40 }}
              >
                Clear
              </Button>
            </Stack>
          </Paper>

          {/* QUICK STATUS FILTER CHIPS */}
          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap data-testid="rm-quick-filters">
            {["All", "In Stock", "Low Stock", "Out of Stock"].map((s) => (
              <Chip
                key={s}
                label={s}
                clickable
                size="small"
                data-testid={`rm-filter-chip-${s.toLowerCase().replace(/ /g, "-")}`}
                color={stockStatusFilter === s ? "primary" : "default"}
                variant={stockStatusFilter === s ? "filled" : "outlined"}
                onClick={() => setStockStatusFilter(s)}
                sx={{ fontWeight: 700 }}
              />
            ))}
          </Stack>

          {/* TABLE PAPER */}
          <Paper
            elevation={0}
            sx={{
              border: "none",
              bgcolor: "background.paper",
              boxShadow: "0px 4px 30px rgba(0,0,0,0.02)",
              overflow: "hidden",
            }}
          >
            {/* TABLE */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}
                  >
                    <TableCell
                      sx={{
                        borderBottom: "none",
                        fontWeight: 700,
                        pl: 4,
                        color: "text.secondary",
                      }}
                    >
                      <TableSortLabel
                        active={sortConfig?.key === 'name'}
                        direction={sortConfig?.key === 'name' ? sortConfig.direction : 'asc'}
                        onClick={() => handleSort('name')}
                      >
                        ITEM DETAILS
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: "none",
                        fontWeight: 700,
                        color: "text.secondary",
                      }}
                    >
                      CATEGORY
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: "none",
                        fontWeight: 700,
                        color: "text.secondary",
                      }}
                    >
                      <TableSortLabel
                        active={sortConfig?.key === 'stock'}
                        direction={sortConfig?.key === 'stock' ? sortConfig.direction : 'asc'}
                        onClick={() => handleSort('stock')}
                      >
                        STOCK LEVEL
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: "none",
                        fontWeight: 700,
                        color: "text.secondary",
                      }}
                    >
                      <TableSortLabel
                        active={sortConfig?.key === 'price'}
                        direction={sortConfig?.key === 'price' ? sortConfig.direction : 'asc'}
                        onClick={() => handleSort('price')}
                      >
                        PRICE
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: "none",
                        fontWeight: 700,
                        color: "text.secondary",
                      }}
                    >
                      STOCK STATUS
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: "none",
                        fontWeight: 700,
                        color: "text.secondary",
                      }}
                    >
                      STATUS
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: "none",
                        fontWeight: 700,
                        textAlign: "right",
                        pr: 4,
                        color: "text.secondary",
                      }}
                    >
                      ACTIONS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <AnimatePresence>
                    {loading ? (
                      [...Array(5)].map((_, index) => (
                        <TableRow key={`skeleton-${index}`}>
                          <TableCell colSpan={7} sx={{ py: 3, px: 4 }}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: alpha(theme.palette.divider, 0.1) }} className="animate-pulse" />
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ width: '40%', height: 14, mb: 1, borderRadius: 1, bgcolor: alpha(theme.palette.divider, 0.1) }} className="animate-pulse" />
                                <Box sx={{ width: '20%', height: 10, borderRadius: 1, bgcolor: alpha(theme.palette.divider, 0.1) }} className="animate-pulse" />
                              </Box>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ py: 10, textAlign: 'center' }}>
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Box sx={{ mb: 3, opacity: 0.5 }}>
                              <Inventory2Icon sx={{ fontSize: 80, color: 'text.disabled' }} />
                            </Box>
                            <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={700}>
                              No Items Found
                            </Typography>
                            <Typography variant="body2" color="text.disabled" sx={{ mb: 4 }}>
                              {searchQuery || categoryFilter !== 'All'
                                ? "Try adjusting your filters or search terms"
                                : "Start by adding your first product to the catalog"}
                            </Typography>
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((item) => {
                        const stockStatus = getStockStatus(
                          item.stock,
                          item.reorderLevel,
                          item.category_name || ""
                        );
                        return (
                          <TableRow
                            key={item.id}
                            hover
                            data-testid={`rm-row-${item.id}`}
                            sx={{
                              "&:last-child td": { borderBottom: 0 },
                              transition: "all 0.2s",
                            }}
                          >
                            <TableCell
                              sx={{
                                borderBottom: `1px solid ${alpha(
                                  theme.palette.divider,
                                  0.05
                                )}`,
                                pl: 4,
                                py: 2,
                              }}
                            >
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={2}
                              >
                                <Avatar
                                  variant="rounded"
                                  sx={{
                                    width: 48,
                                    height: 48,
                                    bgcolor: alpha(
                                      theme.palette.primary.main,
                                      0.05
                                    ),
                                    color: "primary.main",
                                  }}
                                >
                                  {/* Placeholder for item image */}
                                  <CategoryIcon />
                                </Avatar>
                                <Box>
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={700}
                                    color="text.primary"
                                  >
                                    {item.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    fontFamily="monospace"
                                    sx={{
                                      bgcolor: alpha(theme.palette.divider, 0.1),
                                      px: 0.5,
                                      borderRadius: 0.5,
                                    }}
                                  >
                                    {item.codeName || item.code}
                                  </Typography>
                                </Box>
                              </Stack>
                            </TableCell>

                            <TableCell
                              sx={{
                                borderBottom: `1px solid ${alpha(
                                  theme.palette.divider,
                                  0.05
                                )}`,
                              }}
                            >
                              <Typography variant="body2">
                                {item.category_name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                UOM: {item.uom}
                              </Typography>
                            </TableCell>

                            <TableCell
                              sx={{
                                borderBottom: `1px solid ${alpha(
                                  theme.palette.divider,
                                  0.05
                                )}`,
                              }}
                            >
                              <Box>
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>
                                    {fmtQty(item.stock)} {item.uom}
                                  </Typography>
                                </Box>
                                {item.category_name !== "Service" && (
                                  item.reorderLevel > 0 ? (
                                    <Typography variant="caption" color="text.secondary">
                                      Reorder: {fmtQty(item.reorderLevel)}
                                    </Typography>
                                  ) : (
                                    <Tooltip title="No reorder level configured — low-stock alerts can't trigger for this item">
                                      <Typography variant="caption" color="warning.main" fontWeight={700}>
                                        Reorder: not set
                                      </Typography>
                                    </Tooltip>
                                  )
                                )}
                              </Box>
                            </TableCell>

                            <TableCell
                              sx={{
                                borderBottom: `1px solid ${alpha(
                                  theme.palette.divider,
                                  0.05
                                )}`,
                              }}
                            >
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography variant="body2" fontWeight={600}>
                                  ₹{item.price.toFixed(2)}
                                </Typography>
                                {(!item.price || item.price <= 0) && (
                                  <Tooltip title="No price set — affects inventory valuation & procurement decisions">
                                    <WarningAmberIcon sx={{ fontSize: 16, color: "warning.main" }} />
                                  </Tooltip>
                                )}
                              </Stack>
                            </TableCell>

                            <TableCell
                              sx={{
                                borderBottom: `1px solid ${alpha(
                                  theme.palette.divider,
                                  0.05
                                )}`,
                              }}
                            >
                              <Chip
                                label={stockStatus.label}
                                size="small"
                                color={stockStatus.color as any}
                                sx={{
                                  height: 24,
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                }}
                              />
                            </TableCell>

                            <TableCell
                              sx={{
                                borderBottom: `1px solid ${alpha(
                                  theme.palette.divider,
                                  0.05
                                )}`,
                              }}
                            >
                              <Chip
                                label={item.status === 'active' ? "ACTIVE" : (item.status === 'archived' ? "ARCHIVED" : "INACTIVE")}
                                size="small"
                                variant="outlined"
                                color={item.status === 'active' ? 'primary' : (item.status === 'archived' ? 'error' : 'default')}
                                sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                              />
                            </TableCell>

                            <TableCell
                              sx={{
                                borderBottom: `1px solid ${alpha(
                                  theme.palette.divider,
                                  0.05
                                )}`,
                                textAlign: "right",
                                pr: 4,
                              }}
                            >
                              <Stack
                                direction="row"
                                justifyContent="flex-end"
                                spacing={1}
                              >
                                <Tooltip title="Adjust Stock">
                                  <IconButton
                                    size="small"
                                    data-testid={`rm-adjust-btn-${item.id}`}
                                    onClick={() => handleOpenAdjustment(item)}
                                    sx={{
                                      color: "info.main",
                                      "&:hover": {
                                        bgcolor: alpha(
                                          theme.palette.info.main,
                                          0.1
                                        ),
                                      },
                                    }}
                                  >
                                    <CompareArrowsIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={filteredItems.length}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              sx={{ borderTop: "none" }}
            />
          </Paper>
        </motion.div>

        <StockAdjustmentModal
          open={openAdjustmentDialog}
          onClose={() => setOpenAdjustmentDialog(false)}
          targetItem={adjustmentTarget}
          targetType="item"
          onSuccess={() => {
            fetchData();
            setToast({ open: true, message: "Stock adjustment successful.", severity: "success" });
          }}
        />

        {/* --- ADD / EDIT ITEM DIALOG --- */}
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { minHeight: 500 } }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              pb: 0,
              fontWeight: 700,
            }}
          >
            {currentItem.id ? "Edit Item" : "Create New Item"}
            <IconButton onClick={() => setOpenDialog(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
            <Tabs value={dialogTab} onChange={(e, v) => setDialogTab(v)}>
              <Tab label="General Info" />
              <Tab label="Inventory & Stock" />
            </Tabs>
          </Box>

          <DialogContent sx={{ pt: 3 }}>
            {/* TAB 1: GENERAL */}
            {dialogTab === 0 && (
              <Stack spacing={3}>
                <TextField
                  label="Item Name"
                  fullWidth
                  value={currentItem.name || ""}
                  inputProps={{ maxLength: 100 }}
                  helperText={`${(currentItem.name || "").length}/100`}
                  onChange={(e) => {
                    const name = e.target.value;
                    const updates: any = { name };

                    // Auto-generate code if it's a new item or code is empty
                    if (!currentItem.id) {
                      updates.code = generateAutoCode(name);
                    }

                    setCurrentItem({ ...currentItem, ...updates });
                  }}
                />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Item Code"
                      fullWidth
                      value={currentItem.code || ""}
                      inputProps={{ maxLength: 8 }}
                      helperText={`${(currentItem.code || "").length}/8 (Auto-generated)`}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                        setCurrentItem({
                          ...currentItem,
                          code: val,
                        });
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { bgcolor: !currentItem.id ? alpha(theme.palette.action.disabledBackground, 0.05) : 'transparent', borderRadius: 1 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Code Name"
                      fullWidth
                      value={currentItem.codeName || ""}
                      inputProps={{ maxLength: 50 }}
                      helperText={`${(currentItem.codeName || "").length}/50`}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          codeName: e.target.value,
                        })
                      }
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="HSN/SAC"
                      fullWidth
                      value={currentItem.hsnSac || ""}
                      inputProps={{ maxLength: 20 }}
                      helperText={`${(currentItem.hsnSac || "").length}/20`}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          hsnSac: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <FormControl fullWidth>
                        <InputLabel>Unit of Measure (UOM)</InputLabel>
                        <Select
                          value={currentItem.uom || ""}
                          onChange={(e) =>
                            setCurrentItem({
                              ...currentItem,
                              uom: e.target.value,
                            })
                          }
                          input={<OutlinedInput label="Unit of Measure (UOM)" />}
                        >
                          {uoms.map((uom, index) => (
                            <MenuItem key={index} value={uom}>
                              {uom}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Tooltip title="Create New UOM">
                        <IconButton
                          onClick={() => setOpenUomDialog(true)}
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                            borderRadius: 2,
                            width: 56,
                            height: 56,
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                          }}
                        >
                          <AddIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={currentItem.status || 'active'}
                        onChange={(e) => setCurrentItem({ ...currentItem, status: e.target.value as any })}
                        input={<OutlinedInput label="Status" />}
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                        <MenuItem value="archived">Archived</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={currentItem.category || ""}
                        onChange={(e) =>
                          setCurrentItem({
                            ...currentItem,
                            category: e.target.value,
                          })
                        }
                        input={<OutlinedInput label="Category" />}
                      >
                        {categories.map((cat, index) => (
                          <MenuItem key={index} value={cat}>
                            {cat}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Stack>
            )}

            {/* TAB 2: INVENTORY */}
            {dialogTab === 1 && (
              <Stack spacing={3} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Current Stock"
                    fullWidth
                    type="number"
                    value={currentItem.stock || 0}
                    disabled // Usually stock is updated via transactions, not direct edit
                    helperText="Stock is updated via Purchase Receipts / Stock Entries"
                  />
                  <TextField
                    label="Re-order Level"
                    fullWidth
                    type="number"
                    value={currentItem.reorderLevel || 0}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        reorderLevel: parseFloat(e.target.value),
                      })
                    }
                    helperText="System will alert when stock falls below this"
                  />
                </Stack>

                <Box
                  sx={{
                    p: 2,
                    bgcolor: alpha(theme.palette.info.main, 0.05),
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="info.main"
                    gutterBottom
                  >
                    Warehouse Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Default Warehouse: <b>Main Store</b>
                  </Typography>
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              onClick={() => setOpenDialog(false)}
              color="inherit"
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              sx={{
                borderRadius: 2,
                px: 4,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              }}
            >
              Save Item
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- CREATE NEW CATEGORY DIALOG --- */}
        <Dialog
          open={openCategoryDialog}
          onClose={() => setOpenCategoryDialog(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Create New Item Type</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Item Type Name"
              type="text"
              fullWidth
              variant="outlined"
              value={newCategoryName}
              onChange={(e) => {
                // Allow only alphanumeric and spaces
                const value = e.target.value.replace(/[^a-zA-Z0-9 ]/g, '');
                setNewCategoryName(value);
              }}
              inputProps={{ maxLength: 50 }}
              helperText={`${newCategoryName.length}/50 characters (alphanumeric only)`}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
            <Button onClick={() => {
              setOpenCategoryDialog(false);
              setOpenManageCategoryDialog(true);
            }} color="error" startIcon={<DeleteTwoToneIcon />}>
              Manage Categories
            </Button>
            <Box>
              <Button onClick={() => setOpenCategoryDialog(false)} color="inherit" sx={{ mr: 1 }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateCategory}
                sx={{ borderRadius: 2 }}
              >
                Create
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        {/* --- CREATE NEW UOM DIALOG --- */}
        <Dialog
          open={openUomDialog}
          onClose={() => setOpenUomDialog(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Create New UOM</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="UOM Name"
              type="text"
              fullWidth
              variant="outlined"
              value={newUomName}
              onChange={(e) => {
                // Allow only alphanumeric and spaces
                const value = e.target.value.replace(/[^a-zA-Z0-9 ]/g, '');
                setNewUomName(value);
              }}
              inputProps={{ maxLength: 20 }}
              helperText={`${newUomName.length}/20 characters (alphanumeric only)`}
              sx={{ mt: 1 }}
              placeholder="e.g. Nos, Dozen, Ton"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
            <Button onClick={() => {
              setOpenUomDialog(false);
              setOpenManageUomDialog(true);
            }} color="error" startIcon={<DeleteTwoToneIcon />}>
              Manage UOMs
            </Button>
            <Box>
              <Button onClick={() => setOpenUomDialog(false)} color="inherit" sx={{ mr: 1 }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateUom}
                sx={{ borderRadius: 2 }}
              >
                Create
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        {/* --- MANAGE CATEGORIES DIALOG --- */}
        <Dialog
          open={openManageCategoryDialog}
          onClose={() => {
            setOpenManageCategoryDialog(false);
            setCategorySearchQuery("");
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Manage Categories</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              placeholder="Search categories..."
              value={categorySearchQuery}
              onChange={(e) => setCategorySearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
              {categories
                .filter(cat => cat.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                .length > 0 ? (
                <Box>
                  {categories
                    .filter(cat => cat.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                    .map((cat, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          py: 1.5,
                          px: 2,
                          mb: 1,
                          borderRadius: 2,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                        }}
                      >
                        <Typography variant="body1">{cat}</Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteCategory(cat)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteTwoToneIcon />
                        </IconButton>
                      </Box>
                    ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                  {categorySearchQuery ? "No categories found" : "No categories available"}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => {
              setOpenManageCategoryDialog(false);
              setCategorySearchQuery("");
            }} variant="contained" sx={{ borderRadius: 2 }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- MANAGE UOMs DIALOG --- */}
        <Dialog
          open={openManageUomDialog}
          onClose={() => {
            setOpenManageUomDialog(false);
            setUomSearchQuery("");
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Manage UOMs</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              placeholder="Search UOMs..."
              value={uomSearchQuery}
              onChange={(e) => setUomSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
              {uoms
                .filter(uom => uom.toLowerCase().includes(uomSearchQuery.toLowerCase()))
                .length > 0 ? (
                <Box>
                  {uoms
                    .filter(uom => uom.toLowerCase().includes(uomSearchQuery.toLowerCase()))
                    .map((uom, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          py: 1.5,
                          px: 2,
                          mb: 1,
                          borderRadius: 2,
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                        }}
                      >
                        <Typography variant="body1">{uom}</Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteUom(uom)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteTwoToneIcon />
                        </IconButton>
                      </Box>
                    ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                  {uomSearchQuery ? "No UOMs found" : "No UOMs available"}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => {
              setOpenManageUomDialog(false);
              setUomSearchQuery("");
            }} variant="contained" sx={{ borderRadius: 2 }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          PaperProps={{ sx: { borderRadius: 1, p: 1 } }}
        >
          <Box sx={{ p: 3, textAlign: "center", maxWidth: 400 }}>
            <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: "error.main", width: 64, height: 64, mx: "auto", mb: 2 }}>
              <WarningAmberIcon fontSize="large" />
            </Avatar>
            <Typography variant="h6" fontWeight={800} gutterBottom>
              Delete Item?
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={4}>
              Are you sure you want to delete <strong>{itemToDelete?.name}</strong>? This action cannot be undone.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => setDeleteDialogOpen(false)}
                fullWidth
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleConfirmDelete}
                fullWidth
                sx={{ borderRadius: 2, fontWeight: 700, bgcolor: 'error.main' }}
              >
                Delete Item
              </Button>
            </Stack>
          </Box>
        </Dialog>

        {/* Toast Notification */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast({ ...toast, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setToast({ ...toast, open: false })}
            severity={toast.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>


      </Box>
    </>
  );
}

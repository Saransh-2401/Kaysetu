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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Autocomplete,
  TablePagination,
  TableSortLabel,
  InputAdornment,
  Tooltip,
  Snackbar,
  Alert,
  Avatar
} from "@mui/material";
import { motion } from "framer-motion";
import { warehouseService, StockEntry, Item, Product, Warehouse } from "@/lib/warehouse-service";
import { format } from "date-fns";

// Icons
import { ReportProblemIcon, AddIcon, RemoveIcon, WarningAmberIcon, RefreshIcon, SearchIcon, FilterAltOffIcon } from "@/components/icons";

export default function StockAdjustmentPage() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState<StockEntry[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Global Toast State
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" as "success" | "info" | "warning" | "error" });

  // Pagination states
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter states
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // RM vs FG
  const [actionFilter, setActionFilter] = useState("all"); // Increase vs Decrease
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Sorting states
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<string>('created_at');

  // Form states
  const [targetType, setTargetType] = useState<"item" | "product">("item");
  const [items, setItems] = useState<Item[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [itemSearchText, setItemSearchText] = useState("");
  const [productSearchText, setProductSearchText] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<"Increase" | "Decrease">("Increase");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState("Audit");
  const [remarks, setRemarks] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const params: any = {
        entry_type: "stock_adjustment",
        limit: rowsPerPage.toString(),
        offset: (page * rowsPerPage).toString(),
        search: search,
        ordering: (order === 'desc' ? '-' : '') + orderBy,
      };

      if (typeFilter !== "all") params.item_category = typeFilter;
      if (actionFilter !== "all") params.action = actionFilter;
      if (fromDate) params.entry_date_after = fromDate;
      if (toDate) params.entry_date_before = toDate;

      const adjRes = await warehouseService.getStockEntries(params);
      setAdjustments(adjRes.results);
      setTotalCount(adjRes.count || 0);
    } catch (error) {
      console.error("Error fetching adjustments:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      const whRes = await warehouseService.getWarehouses();
      setWarehouses(whRes.results);
      if (whRes.results.length > 0) {
        setWarehouseId(whRes.results[0].id);
      }
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    fetchAdjustments();
  }, [page, rowsPerPage, search, typeFilter, actionFilter, fromDate, toDate, order, orderBy]);

  useEffect(() => {
    setPage(0);
  }, [search, typeFilter, actionFilter, fromDate, toDate, order, orderBy]);

  useEffect(() => {
    if (!openDialog) {
      setSelectedItem(null);
      setSelectedProduct(null);
      setAdjType("Increase");
      setQuantity("");
      setReason("Audit");
      setRemarks("");
      setItemSearchText("");
      setProductSearchText("");
    }
  }, [openDialog]);

  useEffect(() => {
    if (!openDialog || targetType !== "item") return;
    const fetchDebouncedItems = async () => {
      setLoadingItems(true);
      try {
        const res = await warehouseService.getItems({ search: itemSearchText, limit: "10" });
        setItems(res.results || []);
      } catch (error) {
        console.error("Error fetching items:", error);
      } finally {
        setLoadingItems(false);
      }
    };
    const handler = setTimeout(fetchDebouncedItems, 500);
    return () => clearTimeout(handler);
  }, [itemSearchText, openDialog, targetType]);

  useEffect(() => {
    if (!openDialog || targetType !== "product") return;
    const fetchDebouncedProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await warehouseService.getProducts({ search: productSearchText, limit: "10" });
        setProducts(res.results || []);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoadingProducts(false);
      }
    };
    const handler = setTimeout(fetchDebouncedProducts, 500);
    return () => clearTimeout(handler);
  }, [productSearchText, openDialog, targetType]);

  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    setPage(0);
  };

  const handlePostAdjustment = async () => {
    if (!warehouseId || (!selectedItem && !selectedProduct) || !quantity) return;

    setSubmitting(true);
    try {
      const qtyNum = Number(quantity);
      if (qtyNum <= 0) {
        setSnackbar({ open: true, message: `Quantity must be greater than 0`, severity: "error" });
        setSubmitting(false);
        return;
      }
      const signedQty = adjType === "Increase" ? qtyNum : -qtyNum;

      let finalRate = 0;
      let currentQty = 0;

      if (targetType === "product" && selectedProduct) {
        finalRate = Number(selectedProduct.selling_price) || 0;
        currentQty = Number(selectedProduct.quantity || 0);
      } else if (targetType === "item" && selectedItem) {
        finalRate = Number(selectedItem.valuation_rate || selectedItem.standard_rate || 0);
        currentQty = Number((selectedItem as any).current_stock || 0);
      }

      if (adjType === "Decrease" && currentQty < qtyNum) {
        setSnackbar({ open: true, message: `Cannot decrease stock below zero. Current stock is ${currentQty}.`, severity: "error" });
        setSubmitting(false);
        return;
      }

      const itemData: any = {
        quantity: signedQty,
        rate: finalRate,
        amount: signedQty * finalRate,
      };

      if (targetType === "product") {
        itemData.product = selectedProduct!.id;
      } else {
        itemData.item = selectedItem!.id;
      }

      // 1. Create Stock Entry to maintain Log History
      const entry = await warehouseService.createStockEntry({
        entry_type: "stock_adjustment",
        stock_type: targetType,
        entry_date: format(new Date(), "yyyy-MM-dd"),
        target_warehouse: Number(warehouseId),
        remarks: remarks || `Manual Adjustment: ${reason}`,
        items: [itemData]
      });

      // 2. Submit Stock Entry (This will auto-update the Product Quantity in backend)
      await warehouseService.submitStockEntry(entry.id);

      setOpenDialog(false);
      resetForm();
      fetchAdjustments();
    } catch (error) {
      console.error("Error posting adjustment:", error);
      setSnackbar({ open: true, message: "Failed to post adjustment. Please try again.", severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setSelectedProduct(null);
    setQuantity("");
    setRemarks("");
    setReason("Audit");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
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
              Stock Adjustment
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Correct inventory discrepancies manually for Items and Products.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                setPage(0);
                fetchAdjustments();
              }}
              disabled={loading}
              sx={{ borderRadius: 1 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<ReportProblemIcon />}
              onClick={() => setOpenDialog(true)}
              sx={{
                borderRadius: "12px",
                px: 3,
                background: `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
              }}
            >
              New Adjustment
            </Button>
          </Stack>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            background: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(10px)'
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search entry number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Adj. Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="Raw Material">Raw Material</MenuItem>
                <MenuItem value="Finished Goods">Finished Goods</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Action"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              >
                <MenuItem value="all">All Actions</MenuItem>
                <MenuItem value="increase">Increase (+)</MenuItem>
                <MenuItem value="decrease">Decrease (-)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From Date"
                InputLabelProps={{ shrink: true }}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To Date"
                InputLabelProps={{ shrink: true }}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 1 }}>
              <Tooltip title="Reset Filters">
                <IconButton
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setActionFilter("all");
                    setFromDate("");
                    setToDate("");
                  }}
                  sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}
                >
                  <FilterAltOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: "0px 10px 40px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            bgcolor: 'background.paper',
            mb: 4
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10, flexGrow: 1 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ bgcolor: "action.hover" }}
                    >
                      <TableCell sx={{ fontWeight: 700, pl: 4 }}>
                        <TableSortLabel
                          active={orderBy === 'entry_number'}
                          direction={orderBy === 'entry_number' ? order : 'asc'}
                          onClick={() => handleSort('entry_number')}
                        >
                          ENTRY NO
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel
                          active={orderBy === 'created_at'}
                          direction={orderBy === 'created_at' ? order : 'asc'}
                          onClick={() => handleSort('created_at')}
                        >
                          DATE
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>CREATED BY</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>ITEM(S)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>REMARKS</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>PREV</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>NEW</TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, textAlign: "right", pr: 4 }}
                      >
                        QTY IMPACT
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "center", pr: 4 }}>UNIT</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {adjustments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 10 }}>
                          <Typography color="text.secondary">No stock adjustments found.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : adjustments.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell
                          sx={{ pl: 4, fontFamily: "monospace", fontWeight: 600 }}
                        >
                          {row.entry_number}
                        </TableCell>
                        <TableCell>{row.entry_date}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: 'secondary.main', color: 'white' }}>
                              {row.created_by_name ? row.created_by_name.charAt(0).toUpperCase() : 'U'}
                            </Avatar>
                            <Typography variant="body2" fontWeight={600}>
                              {row.created_by_name || 'System User'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Tooltip title={row.items?.map(i => i.product_name || i.item_name).join(", ") || "N/A"}>
                            <Box component="span">{row.items?.map(i => i.product_name || i.item_name).join(", ") || "N/A"}</Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Tooltip title={row.remarks || "-"}>
                            <Box component="span">{row.remarks || "-"}</Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {row.items?.map(i => i.previous_stock).join(", ") || "0"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {row.items?.map(i => i.new_stock).join(", ") || "0"}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            pr: 4,
                            fontWeight: 700,
                            color: (row.items?.reduce((sum, i) => sum + Number(i.quantity), 0) || 0) > 0 ? "success.main" : "error.main"
                          }}
                        >
                          {(() => {
                            const qty = row.items?.reduce((sum, i) => sum + Number(i.quantity), 0) || 0;
                            return qty > 0 ? `+${qty}` : qty;
                          })()}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary', pr: 4 }}>
                          {row.items?.[0]?.uom || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                sx={{
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  px: 2,
                  '& .MuiTablePagination-toolbar': {
                    minHeight: '60px',
                  },
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'text.secondary',
                    mt: 0.5
                  }
                }}
              />
            </>
          )}
        </Paper>

        <Dialog
          open={openDialog}
          onClose={(e, reason) => {
            if (reason === 'backdropClick') return;
            if (!submitting) setOpenDialog(false);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { p: 1, borderRadius: '16px' } }}
        >
          <DialogTitle
            fontWeight={700}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <WarningAmberIcon color="error" /> Reconcile Stock
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} mt={1}>
              <TextField
                label="Adjustment Type"
                select
                fullWidth
                value={targetType}
                onChange={(e) => {
                  setTargetType(e.target.value as any);
                  setSelectedItem(null);
                  setSelectedProduct(null);
                }}
              >
                <MenuItem value="item">Adjust Item Master (Raw Material / Parts)</MenuItem>
                <MenuItem value="product">Adjust Product Master (Finished Goods)</MenuItem>
              </TextField>

              {/* Warehouse dropdown removed as per user request (single warehouse) */}

              {targetType === "item" ? (
                <Autocomplete
                  options={items}
                  getOptionLabel={(option) => `${option.item_code} - ${option.item_name}`}
                  loading={loadingItems}
                  onInputChange={(e, newInputValue, reason) => {
                    if (reason === 'input' || reason === 'clear') {
                      setItemSearchText(newInputValue);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Item"
                      required
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <React.Fragment>
                            {loadingItems ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </React.Fragment>
                        ),
                      }}
                    />
                  )}
                  value={selectedItem}
                  onChange={(_, newVal) => setSelectedItem(newVal)}
                  filterOptions={(x) => x}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                />
              ) : (
                <Autocomplete
                  options={products}
                  getOptionLabel={(option) => `${option.sku} - ${option.product_name}`}
                  loading={loadingProducts}
                  onInputChange={(e, newInputValue, reason) => {
                    if (reason === 'input' || reason === 'clear') {
                      setProductSearchText(newInputValue);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Product"
                      required
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <React.Fragment>
                            {loadingProducts ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </React.Fragment>
                        ),
                      }}
                    />
                  )}
                  value={selectedProduct}
                  onChange={(_, newVal) => setSelectedProduct(newVal)}
                  filterOptions={(x) => x}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                />
              )}

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Action"
                  select
                  fullWidth
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as any)}
                >
                  <MenuItem value="Increase">Increase Stock (+)</MenuItem>
                  <MenuItem value="Decrease">Decrease Stock (-)</MenuItem>
                </TextField>
                <TextField
                  label="Quantity"
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                  fullWidth
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                    setQuantity(val);
                  }}
                  onKeyDown={(e) => {
                    if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  required
                />
              </Stack>
              <TextField
                label="Reason Code"
                select
                fullWidth
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <MenuItem value="Damaged">Damaged / Expired</MenuItem>
                <MenuItem value="Theft">Theft / Loss</MenuItem>
                <MenuItem value="Audit">Audit Correction</MenuItem>
                <MenuItem value="Found">Found during inventory count</MenuItem>
              </TextField>
              <TextField
                label="Remarks"
                fullWidth
                multiline
                rows={2}
                placeholder="Explain the discrepancy..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                required
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpenDialog(false)} disabled={submitting}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handlePostAdjustment}
              disabled={
                submitting ||
                (targetType === "item" && !selectedItem) ||
                (targetType === "product" && !selectedProduct) ||
                !quantity ||
                !warehouseId ||
                !remarks.trim()
              }
              startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {submitting ? "Posting..." : "Post Adjustment"}
            </Button>
          </DialogActions>
        </Dialog>
      </motion.div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity as any} variant="filled" sx={{ width: "100%", borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

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
import { format } from "date-fns";

// Icons
import { ReportProblemIcon, RefreshIcon, SearchIcon, FilterAltOffIcon, WarningAmberIcon } from "@/components/icons";

// Services
import { distributorService, Product } from "@/lib/distributor-service";
import { coreService, User as APIUser } from "@/lib/core-service";
import { authService, UserProfile } from "@/lib/auth-service";

export default function DistributorAdjustmentPage() {
  const theme = useTheme();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" as "success" | "info" | "warning" | "error" });

  // Pagination states
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter states
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Sorting
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<string>('created_at');

  // Form
  const [distributorSearchText, setDistributorSearchText] = useState("");
  const [distributors, setDistributors] = useState<APIUser[]>([]);
  const [loadingDistributors, setLoadingDistributors] = useState(false);

  const [productSearchText, setProductSearchText] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [selectedDistributor, setSelectedDistributor] = useState<APIUser | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<"Increase" | "Decrease">("Increase");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState("Damaged");
  const [remarks, setRemarks] = useState("");

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: rowsPerPage.toString(),
        offset: (page * rowsPerPage).toString(),
        search: search,
        ordering: (order === 'desc' ? '-' : '') + orderBy,
      };

      if (actionFilter !== "all") params.adjustment_type = actionFilter;
      if (fromDate) params.created_at__gte = fromDate;
      if (toDate) params.created_at__lte = toDate + "T23:59:59";

      const res = await distributorService.getAdjustments(params);
      setAdjustments(res.data?.results || res.results || []);
      setTotalCount(res.data?.count || res.count || 0);
    } catch (error) {
      console.error("Error fetching adjustments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
      } catch (err) {
        console.error("Failed to fetch user", err);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    fetchAdjustments();
  }, [page, rowsPerPage, search, actionFilter, fromDate, toDate, order, orderBy]);

  useEffect(() => {
    setPage(0);
  }, [search, actionFilter, fromDate, toDate, order, orderBy]);

  useEffect(() => {
    if (!openDialog) {
      resetForm();
    } else {
      // Auto-select if user is distributor
      if (currentUser?.role === 'distributor') {
        setSelectedDistributor({
          id: currentUser.id,
          full_name: currentUser.full_name || currentUser.username,
          role: 'distributor'
        } as APIUser);
      }
    }
  }, [openDialog, currentUser]);

  useEffect(() => {
    if (!openDialog || currentUser?.role === 'distributor') return;
    const fetchDebouncedDistributors = async () => {
      setLoadingDistributors(true);
      try {
        const res = await coreService.getUsers({ role: 'distributor', search: distributorSearchText, limit: "15" });
        setDistributors((res as any).results || res);
      } catch (error) {
        console.error("Error fetching distributors:", error);
      } finally {
        setLoadingDistributors(false);
      }
    };
    const handler = setTimeout(fetchDebouncedDistributors, 500);
    return () => clearTimeout(handler);
  }, [distributorSearchText, openDialog, currentUser?.id]);

  useEffect(() => {
    if (!openDialog || !selectedDistributor) return;
    const fetchDebouncedProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await distributorService.getProductMaster(selectedDistributor.id);
        let products = Array.isArray(res) ? res : ((res as any).data || (res as any).results || []);
        // Client side filter
        if (productSearchText) {
          products = products.filter((p: Product) => 
            p.product_name.toLowerCase().includes(productSearchText.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearchText.toLowerCase())
          );
        }
        setProducts(products.slice(0, 20)); // Keep it manageable
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoadingProducts(false);
      }
    };
    const handler = setTimeout(fetchDebouncedProducts, 500);
    return () => clearTimeout(handler);
  }, [productSearchText, openDialog, selectedDistributor]);

  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    setPage(0);
  };

  const handlePostAdjustment = async () => {
    if (!selectedDistributor || !selectedProduct || !quantity) return;

    setSubmitting(true);
    try {
      const qtyNum = Number(quantity);
      if (qtyNum <= 0) {
        setSnackbar({ open: true, message: `Quantity must be greater than 0`, severity: "error" });
        setSubmitting(false);
        return;
      }

      const currentQty = Number(selectedProduct.distributor_stock || 0);

      if (adjType === "Decrease" && currentQty < qtyNum) {
        setSnackbar({ open: true, message: `Cannot decrease stock below zero. Current stock is ${currentQty}.`, severity: "error" });
        setSubmitting(false);
        return;
      }

      await distributorService.createAdjustment({
        distributor: selectedDistributor.id,
        product: selectedProduct.id,
        adjustment_type: adjType,
        quantity: qtyNum,
        reason: reason,
        remarks: remarks
      });

      setOpenDialog(false);
      setSnackbar({ open: true, message: `Adjustment successful`, severity: "success" });
      fetchAdjustments();
    } catch (error: any) {
      console.error("Error posting adjustment:", error);
      const msg = error.response?.data?.non_field_errors?.[0] || 
                  error.response?.data?.detail || 
                  "Failed to post adjustment. Please try again.";
      setSnackbar({ open: true, message: msg, severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setActionFilter("all");
    setFromDate("");
    setToDate("");
  };

  const resetForm = () => {
    setSelectedDistributor(null);
    setSelectedProduct(null);
    setQuantity("");
    setRemarks("");
    setReason("Damaged");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
              Distributor Stock Adjustment
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Correct distributor inventory discrepancies.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => { setPage(0); fetchAdjustments(); }}
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
                background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
              }}
            >
              New Adjustment
            </Button>
          </Stack>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: 2, mb: 3, borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            background: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(10px)'
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth size="small" placeholder="Search entries..."
                value={search} onChange={(e) => setSearch(e.target.value)}
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
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select fullWidth size="small" label="Action"
                value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              >
                <MenuItem value="all">All Actions</MenuItem>
                <MenuItem value="Increase">Increase (+)</MenuItem>
                <MenuItem value="Decrease">Decrease (-)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth size="small" type="date" label="From"
                InputLabelProps={{ shrink: true }} value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth size="small" type="date" label="To"
                InputLabelProps={{ shrink: true }} value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 1 }}>
              <Tooltip title="Reset Filters">
                <IconButton onClick={resetFilters} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                  <FilterAltOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 1, overflow: "hidden",
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: "0px 10px 40px rgba(0,0,0,0.03)",
            display: "flex", flexDirection: "column",
            bgcolor: 'white', mb: 4
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#fafafa" }}>
                      <TableCell sx={{ fontWeight: 700, pl: 4 }}>DATE</TableCell>
                      {currentUser?.role !== 'distributor' && <TableCell sx={{ fontWeight: 700 }}>DISTRIBUTOR</TableCell>}
                      <TableCell sx={{ fontWeight: 700 }}>PRODUCT</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>PERFORMED BY</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>REMARKS</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>PREV QTY</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>IMPACT</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "right", pr: 4 }}>NEW QTY</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {adjustments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={currentUser?.role === 'distributor' ? 7 : 8} align="center" sx={{ py: 10 }}>
                          <Typography color="text.secondary">No adjustments found.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : adjustments.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ pl: 4 }}>
                          {row.created_at ? format(new Date(row.created_at), "MMM d, yyyy HH:mm") : "-"}
                        </TableCell>
                        {currentUser?.role !== 'distributor' && <TableCell sx={{ fontWeight: 600 }}>{row.distributor_name}</TableCell>}
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{row.product_name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.adjusted_by_name || "System"}</Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Tooltip title={`${row.reason} - ${row.remarks}`}>
                            <Box component="span"><b>{row.reason}</b>: {row.remarks}</Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>
                          {row.previous_stock}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color: row.adjustment_type === "Increase" ? "success.main" : "error.main"
                          }}
                        >
                          {row.adjustment_type === "Increase" ? `+${row.quantity}` : `-${row.quantity}`}
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 4, fontWeight: 700 }}>
                          {row.new_stock}
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
                sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
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
          <DialogTitle fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WarningAmberIcon color="warning" /> Distributor Stock Adjustment
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} mt={1}>
              {currentUser?.role !== 'distributor' && (
                <Autocomplete
                  options={distributors}
                  getOptionLabel={(option) => option.full_name || option.username || ""}
                  loading={loadingDistributors}
                  onInputChange={(e, newInputValue, r) => {
                    if (r === 'input' || r === 'clear') setDistributorSearchText(newInputValue);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Select Distributor" required
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <React.Fragment>
                            {loadingDistributors ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </React.Fragment>
                        ),
                      }}
                    />
                  )}
                  value={selectedDistributor}
                  onChange={(_, newVal) => {
                    setSelectedDistributor(newVal);
                    setSelectedProduct(null);
                  }}
                  isOptionEqualToValue={(o,v) => o.id === v.id}
                />
              )}

              <Autocomplete
                options={products}
                disabled={!selectedDistributor}
                getOptionLabel={(option) => `${option.sku} - ${option.product_name} (Stock: ${option.distributor_stock || 0})`}
                loading={loadingProducts}
                onInputChange={(e, newInputValue, r) => {
                  if (r === 'input' || r === 'clear') setProductSearchText(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Select Product" required
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
                isOptionEqualToValue={(o,v) => o.id === v.id}
              />

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Action" select fullWidth value={adjType}
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
                  onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                  required
                />
              </Stack>
              <TextField
                label="Reason Code" select fullWidth value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <MenuItem value="Damaged">Damaged / Expired</MenuItem>
                <MenuItem value="Lost">Lost / Theft</MenuItem>
                <MenuItem value="Found">Found</MenuItem>
                <MenuItem value="Audit">Audit Correction</MenuItem>
              </TextField>
              <TextField
                label="Remarks" fullWidth multiline rows={2}
                placeholder="Explain the discrepancy..." value={remarks}
                onChange={(e) => setRemarks(e.target.value)} required
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpenDialog(false)} disabled={submitting}>Cancel</Button>
            <Button
              variant="contained" color="warning" onClick={handlePostAdjustment}
              disabled={submitting || !selectedDistributor || !selectedProduct || !quantity || !remarks.trim()}
              startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {submitting ? "Posting..." : "Post Adjustment"}
            </Button>
          </DialogActions>
        </Dialog>
      </motion.div>

      <Snackbar
        open={snackbar.open} autoHideDuration={4000}
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

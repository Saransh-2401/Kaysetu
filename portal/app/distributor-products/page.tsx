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
  InputAdornment,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Badge,
  Fab,
  Drawer,
  Divider,
  Avatar,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  ButtonGroup,
  Tooltip,
  MenuItem,
} from "@mui/material";
import { motion } from "framer-motion";
import { Product, distributorService } from "@/lib/distributor-service";

// Icons
import { SearchIcon, FilterListIcon, AddShoppingCartIcon, ShoppingCartIcon, Inventory2Icon, InfoOutlinedIcon, CloseIcon, RemoveIcon, AddIcon, ShoppingBagIcon, GridViewIcon, TableRowsIcon, CheckCircleIcon, ErrorIcon, WarningIcon, ArrowUpwardIcon, ArrowDownwardIcon, SortIcon, FilterAltOffIcon } from "@/components/icons";

export default function ProductCatalogPage() {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ [key: number]: number }>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // New states for enhancements
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sorting states
  const [orderBy, setOrderBy] = useState<'selling_price' | 'distributor_stock' | 'none'>('none');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await distributorService.getProductMaster();
      setProducts(data);
    } catch (error) {
      console.error("Failed to fetch products", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (stockFilter === 'in_stock') return (p.distributor_stock || 0) > 0;
    if (stockFilter === 'out_of_stock') return (p.distributor_stock || 0) <= 0;
    if (stockFilter === 'low_stock') return (p.distributor_stock || 0) > 0 && (p.distributor_stock || 0) <= 10;

    return true;
  }).sort((a, b) => {
    if (orderBy === 'none') return 0;

    const valueA = orderBy === 'selling_price' ? Number(a.selling_price) : (a.distributor_stock || 0);
    const valueB = orderBy === 'selling_price' ? Number(b.selling_price) : (b.distributor_stock || 0);

    if (order === 'asc') {
      return valueA - valueB;
    } else {
      return valueB - valueA;
    }
  });

  const handleRequestSort = (property: 'selling_price' | 'distributor_stock') => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleAddToCart = (productId: number) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => {
      const newCart = { ...prev };
      if (newCart[productId] > 1) {
        newCart[productId] -= 1;
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCheckout = async () => {
    try {
      const items = Object.entries(cart).map(([productId, quantity]) => ({
        product: parseInt(productId),
        requested_quantity: quantity
      }));

      if (items.length === 0) return;

      await distributorService.createStockRequest({
        description: `Stock enrichment request for ${items.length} products`,
        items
      });

      setCart({});
      setCartOpen(false);
      setSnackbar({
        open: true,
        message: 'Stock request submitted successfully!',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to submit stock request',
        severity: 'error'
      });
    }
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const getStockColor = (stock: number) => {
    if (stock > 50) return "success";
    if (stock > 0) return "warning";
    return "error";
  };

  const getStockLabel = (stock: number) => {
    if (stock > 50) return "In Stock";
    if (stock > 0) return "Low Stock";
    return "Out of Stock";
  };

  const calculateTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === parseInt(productId));
      if (product) {
        return total + (Number(product.selling_price) * quantity);
      }
      return total;
    }, 0);
  };

  const handleResetFilters = () => {
    setSearch("");
    setStockFilter("all");
    setOrderBy("none");
    setOrder("asc");
    setPage(0);
  };

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredProducts, page, rowsPerPage]);

  return (
    <>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* HEADER SECTION - Enhanced */}
        <Box sx={{ mb: 4 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Box>
              <Typography
                variant="h4"
                fontWeight={900}
                sx={{
                  letterSpacing: "-0.03em",
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Inventory Master
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, opacity: 0.8 }}>
                Monitor stock levels, analyze pricing, and replenish inventory.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <ButtonGroup
                size="small"
                variant="outlined"
                sx={{
                  bgcolor: 'background.paper',
                  '& .MuiButton-root': { px: 2, borderWidth: '1px !important' }
                }}
              >
                <Tooltip title="Table View">
                  <Button
                    onClick={() => setViewMode('table')}
                    variant={viewMode === 'table' ? 'contained' : 'outlined'}
                    color={viewMode === 'table' ? 'primary' : 'inherit'}
                  >
                    <TableRowsIcon fontSize="small" />
                  </Button>
                </Tooltip>
                <Tooltip title="Grid View">
                  <Button
                    onClick={() => setViewMode('grid')}
                    variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                    color={viewMode === 'grid' ? 'primary' : 'inherit'}
                  >
                    <GridViewIcon fontSize="small" />
                  </Button>
                </Tooltip>
              </ButtonGroup>
            </Stack>
          </Stack>
        </Box>

        {/* FILTER BAR - Premium Design */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 1,
            bgcolor: "background.paper",
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                placeholder="Search inventory..."
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="primary" sx={{ opacity: 0.6 }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Inventory2Icon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.default, 0.5),
                    '& fieldset': { borderColor: 'transparent' },
                    '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.2) },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
                    transition: 'all 0.2s',
                  }
                }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        borderRadius: 2,
                        mt: 1,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      }
                    }
                  }
                }}
              >
                <MenuItem value="all" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Stock: All Levels</MenuItem>
                <MenuItem value="in_stock" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>In Stock Only</MenuItem>
                <MenuItem value="low_stock" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Low Stock (≤10)</MenuItem>
                <MenuItem value="out_of_stock" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Out of Stock</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Tooltip title="Reset Filters">
                  <IconButton
                    onClick={handleResetFilters}
                    size="medium"
                    sx={{
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.error.main, 0.05),
                        borderColor: alpha(theme.palette.error.main, 0.2),
                        color: 'error.main',
                        transform: 'rotate(-90deg)'
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      width: 40,
                      height: 40
                    }}
                  >
                    <FilterAltOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* CONTENT AREA */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress thickness={4} size={40} />
          </Box>
        ) : filteredProducts.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 1, border: `1px dashed ${alpha(theme.palette.divider, 0.2)}`, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
            <Inventory2Icon sx={{ fontSize: 60, color: 'text.disabled', mb: 2, opacity: 0.3 }} />
            <Typography variant="h6" fontWeight={700}>No items found</Typography>
            <Typography variant="body2" color="text.secondary">Try adjusting your filters or search keywords</Typography>
            <Button onClick={handleResetFilters} sx={{ mt: 2 }} color="primary">Clear all filters</Button>
          </Paper>
        ) : viewMode === 'grid' ? (
          <>
            <Grid container spacing={3}>
              {paginatedProducts.map((product: Product) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={product.id}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: theme.shadows[4],
                      },
                    }}
                  >
                    {/* Image Placeholder */}
                    <Box
                      sx={{
                        height: 160,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        mb: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 2,
                      }}
                    >
                      {product.product_image ? (
                        <Box
                          component="img"
                          src={product.product_image}
                          alt={product.product_name}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                          onError={(e: any) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Inventory2Icon sx={{ fontSize: 60, color: alpha(theme.palette.primary.main, 0.2) }} />
                      )}
                    </Box>

                    <Stack spacing={1}>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                      >
                        <div>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            lineHeight={1.2}
                            noWrap
                            sx={{ maxWidth: 150 }}
                          >
                            {product.product_name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontFamily="monospace"
                          >
                            {product.sku}
                          </Typography>
                        </div>
                        <Chip
                          label={`${product.distributor_stock || 0} in stock`}
                          size="small"
                          color={getStockColor(product.distributor_stock || 0) as any}
                          variant="outlined"
                          sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary">
                        {product.uom}
                      </Typography>

                      <Divider sx={{ my: 1 }} />

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="h6" fontWeight={800}>
                          ₹{Number(product.selling_price).toFixed(2)}
                        </Typography>

                        {cart[product.id] ? (
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2, px: 1 }}>
                            <IconButton size="small" onClick={() => handleRemoveFromCart(product.id)}>
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography fontWeight={700}>{cart[product.id]}</Typography>
                            <IconButton size="small" onClick={() => handleAddToCart(product.id)}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AddShoppingCartIcon />}
                            onClick={() => handleAddToCart(product.id)}
                            sx={{ borderRadius: 2 }}
                          >
                            Request
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
            <TablePagination
              rowsPerPageOptions={[12, 24, 48]}
              component="div"
              count={filteredProducts.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ mt: 2, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 2 }}
            />
          </>
        ) : (
          /* TABLE VIEW - Default & Professional */
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, overflow: 'hidden' }}>
            <Table>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, py: 2 }}>Product Details</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>UOM</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">
                    <TableSortLabel
                      active={orderBy === 'selling_price'}
                      direction={orderBy === 'selling_price' ? order : 'asc'}
                      onClick={() => handleRequestSort('selling_price')}
                    >
                      Selling Price
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="center">
                    <TableSortLabel
                      active={orderBy === 'distributor_stock'}
                      direction={orderBy === 'distributor_stock' ? order : 'asc'}
                      onClick={() => handleRequestSort('distributor_stock')}
                    >
                      Current Stock
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="center">Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedProducts.map((product: Product) => {
                  const stock = product.distributor_stock || 0;
                  const isInCart = !!cart[product.id];

                  return (
                    <TableRow key={product.id} hover sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.01) } }}>
                      <TableCell>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar
                            variant="rounded"
                            src={product.product_image || undefined}
                            sx={{ width: 44, height: 44, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                          >
                            <Inventory2Icon color="primary" />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{product.product_name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{product.sku}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{product.uom}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={800}>₹{Number(product.selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={700} color={stock > 10 ? 'success.main' : stock > 0 ? 'warning.main' : 'error.main'}>
                          {stock} UNITS
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={stock > 0 ? <CheckCircleIcon /> : <ErrorIcon />}
                          label={stock > 0 ? 'In Stock' : 'Out of Stock'}
                          size="small"
                          color={stock > 10 ? 'success' : stock > 0 ? 'warning' : 'error'}
                          sx={{ fontWeight: 700, borderRadius: 1.5, height: 26, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {isInCart ? (
                          <Stack direction="row" alignItems="center" spacing={1} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleRemoveFromCart(product.id)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main' }}>
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography fontWeight={800}>{cart[product.id]}</Typography>
                            <IconButton size="small" onClick={() => handleAddToCart(product.id)} sx={{ bgcolor: alpha(theme.palette.success.main, 0.05), color: 'success.main' }}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        ) : (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddShoppingCartIcon sx={{ fontSize: '1rem !important' }} />}
                            onClick={() => handleAddToCart(product.id)}
                            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
                          >
                            Add To Request
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[12, 24, 48]}
              component="div"
              count={filteredProducts.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
            />
          </TableContainer>
        )}

        {/* FLOATING CART BUTTON */}
        {cartCount > 0 && (
          <Box sx={{ position: "fixed", bottom: 32, right: 32, zIndex: 100 }}>
            <Badge badgeContent={cartCount} color="error">
              <Fab
                color="primary"
                aria-label="cart"
                onClick={() => setCartOpen(true)}
                variant="extended"
                sx={{ px: 3 }}
              >
                <ShoppingBagIcon sx={{ mr: 1 }} />
                View Stock Request
              </Fab>
            </Badge>
          </Box>
        )}

        {/* CART DRAWER */}
        <Drawer
          anchor="right"
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 450 }, p: 3 } }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6" fontWeight={700}>
              Stock Entry Request
            </Typography>
            <IconButton onClick={() => setCartOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Review your stock request before submitting.
          </Typography>
          <Divider />

          <Box sx={{ flexGrow: 1, my: 3, overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
            {Object.entries(cart).map(([productId, quantity]) => {
              const product = products.find(p => p.id === parseInt(productId));
              if (!product) return null;
              const itemTotal = Number(product.selling_price) * quantity;
              return (
                <Box key={productId} sx={{ mb: 2, p: 2, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 2 }}>
                  <Stack direction="row" spacing={2}>
                    {/* Product Image */}
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {product.product_image ? (
                        <Box
                          component="img"
                          src={product.product_image}
                          alt={product.product_name}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e: any) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Inventory2Icon sx={{ fontSize: 30, color: alpha(theme.palette.primary.main, 0.3) }} />
                      )}
                    </Box>

                    {/* Product Details */}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700}>{product.product_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{product.sku}</Typography>
                      <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ mt: 0.5 }}>
                        ₹{Number(product.selling_price).toFixed(2)} × {quantity} = ₹{itemTotal.toFixed(2)}
                      </Typography>
                    </Box>

                    {/* Quantity Controls */}
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <IconButton size="small" onClick={() => handleRemoveFromCart(product.id)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography fontWeight={700} sx={{ minWidth: 30, textAlign: 'center' }}>{quantity}</Typography>
                      <IconButton size="small" onClick={() => handleAddToCart(product.id)} sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Box>
              )
            })}
          </Box>

          {/* Total Cost */}
          <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={700}>Total Cost:</Typography>
              <Typography variant="h6" fontWeight={800} color="primary.main">
                ₹{calculateTotal().toFixed(2)}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {cartCount} item{cartCount !== 1 ? 's' : ''} in request
            </Typography>
          </Box>

          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={cartCount === 0}
            onClick={() => {
              setCartOpen(false);
              setConfirmOpen(true);
            }}
            sx={{ borderRadius: 1, py: 1.5, fontWeight: 700 }}
          >
            Review & Submit Request
          </Button>
        </Drawer>

        {/* CONFIRMATION MODAL */}
        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Confirm Stock Request</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Please review your stock request before submitting. This will be sent to the warehouse for approval.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={2}>Items Requested:</Typography>
              {Object.entries(cart).map(([productId, quantity]) => {
                const product = products.find(p => p.id === parseInt(productId));
                if (!product) return null;
                return (
                  <Box key={productId} sx={{ mb: 1.5, p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {product.product_image ? (
                          <Box
                            component="img"
                            src={product.product_image}
                            alt={product.product_name}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e: any) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <Inventory2Icon sx={{ fontSize: 20, color: alpha(theme.palette.primary.main, 0.4) }} />
                        )}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" fontWeight={700}>{product.product_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{product.sku}</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700}>
                        {quantity} × ₹{Number(product.selling_price).toFixed(2)}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Box>

            <Divider />

            <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={700}>Total Amount:</Typography>
                <Typography variant="h6" fontWeight={800} color="success.main">
                  ₹{calculateTotal().toFixed(2)}
                </Typography>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setConfirmOpen(false)} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                handleCheckout();
              }}
              variant="contained"
              color="primary"
              startIcon={<ShoppingBagIcon />}
            >
              Confirm & Submit
            </Button>
          </DialogActions>
        </Dialog>
      </motion.div>
    </>
  );
}

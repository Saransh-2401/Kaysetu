"use client";
import React, { useState, Suspense } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Avatar,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  useTheme,
  alpha,
  Drawer,
  Divider,
  Fab,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";

// Icons
import { SearchIcon, AddIcon, ShoppingCartIcon, LocationOnIcon, ArrowForwardIcon, RemoveIcon, DeleteOutlineIcon, ReceiptLongIcon, CheckCircleIcon, LocalShippingIcon, MyLocationIcon, CloseIcon } from "@/components/icons";

// --- MOCK DATA ---
const ORDERS = [
  {
    id: "ORD-8821",
    customer: "TechFlow Inc",
    date: "Oct 24, 10:30 AM",
    amount: 1250,
    items: 3,
    status: "Processing",
    location: "12 Business Park",
  },
  {
    id: "ORD-8820",
    customer: "Acme Corp",
    date: "Oct 23, 02:15 PM",
    amount: 450,
    items: 1,
    status: "Delivered",
    location: "88 Industrial Way",
  },
  {
    id: "ORD-8819",
    customer: "Global Logistics",
    date: "Oct 23, 09:00 AM",
    amount: 3200,
    items: 8,
    status: "Pending",
    location: "45 Warehouse Rd",
  },
];

const PRODUCTS = [
  { id: 1, name: "Premium Widget", price: 120, stock: 50 },
  { id: 2, name: "Standard Bolt", price: 45, stock: 200 },
  { id: 3, name: "Industrial Lube", price: 85, stock: 20 },
  { id: 4, name: "Safety Kit", price: 250, stock: 15 },
];

const CUSTOMERS = [
  "TechFlow Inc",
  "Acme Corp",
  "Global Logistics",
  "Stark Ind",
];

export default function SalesAgentOrdersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrdersContent />
    </Suspense>
  );
}

function OrdersContent() {
  const theme = useTheme();
  const [search, setSearch] = useState("");

  // Create Order Wizard States
  const [openCreate, setOpenCreate] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [cart, setCart] = useState<{ [key: number]: number }>({});
  const [location, setLocation] = useState<null | string>(null);
  const [isLocating, setIsLocating] = useState(false);

  // View Details State
  const [viewOrder, setViewOrder] = useState<any>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  React.useEffect(() => {
    if (searchParams.get("action") === "new") {
      setOpenCreate(true);
    }
  }, [searchParams]);

  // Wrap setOpenCreate to clear query param on close
  const handleCloseCreate = () => {
    setOpenCreate(false);
    if (searchParams.get("action") === "new") {
      router.replace("/sales-agent/orders");
    }
  };

  // --- LOGIC ---

  const handleAddToCart = (id: number) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handleRemoveFromCart = (id: number) => {
    setCart((prev) => {
      const newCart = { ...prev };
      if (newCart[id] > 1) newCart[id]--;
      else delete newCart[id];
      return newCart;
    });
  };

  const cartTotal = Math.round(Object.keys(cart).reduce((acc, id) => {
    const product = PRODUCTS.find((p) => p.id === parseInt(id));
    return acc + (product ? Math.round(product.price * cart[parseInt(id)] * 100) / 100 : 0);
  }, 0) * 100) / 100;

  const handleNext = () => {
    if (activeStep === 2) {
      // Submit Order
      setOpenCreate(false);
      setActiveStep(0);
      setCart({});
      setSelectedCustomer("");
      setLocation(null);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const captureLocation = () => {
    setIsLocating(true);
    // Simulate GPS Delay
    setTimeout(() => {
      setLocation("Lat: 40.7128, Lng: -74.0060 (Accuracy: 5m)");
      setIsLocating(false);
    }, 1500);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
        return "success";
      case "Processing":
        return "info";
      case "Pending":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* 1. HEADER & FAB */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ letterSpacing: "-0.02em" }}
            >
              Orders
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Recent transactions and new bookings.
            </Typography>
          </Box>
          {/* Desktop Button */}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreate(true)}
            sx={{
              display: { xs: "none", md: "flex" },
              borderRadius: "10px",
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            }}
          >
            New Order
          </Button>
        </Stack>

        {/* Mobile FAB */}
        <Fab
          color="primary"
          onClick={() => setOpenCreate(true)}
          sx={{
            position: "fixed",
            bottom: 100,
            right: 20,
            display: { xs: "flex", md: "none" },
            zIndex: 100,
          }}
        >
          <AddIcon />
        </Fab>

        {/* 2. ORDER LIST (Mobile Friendly Cards) */}
        <Grid container spacing={2}>
          {ORDERS.map((order) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={order.id}>
              <Paper
                elevation={0}
                onClick={() => setViewOrder(order)}
                sx={{
                  p: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  bgcolor: "background.paper",
                  cursor: "pointer",
                  "&:hover": {
                    borderColor: theme.palette.primary.main,
                    boxShadow: theme.shadows[2],
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {order.id}
                  </Typography>
                  <Chip
                    label={order.status}
                    size="small"
                    color={getStatusColor(order.status) as any}
                    sx={{
                      borderRadius: 1,
                      height: 22,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                    }}
                  />
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <Avatar
                    sx={{
                      bgcolor: alpha(theme.palette.secondary.main, 0.1),
                      color: "secondary.main",
                      width: 40,
                      height: 40,
                    }}
                    variant="rounded"
                  >
                    <ReceiptLongIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight={600}>
                      {order.customer}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {order.date}
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    color="text.secondary"
                  >
                    <LocalShippingIcon sx={{ fontSize: 16 }} />
                    <Typography variant="caption">
                      {order.items} Items
                    </Typography>
                  </Stack>
                  <Typography
                    variant="subtitle1"
                    fontWeight={800}
                    color="primary.main"
                  >
                    ${order.amount.toLocaleString()}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* --- CREATE ORDER WIZARD (FULL SCREEN DIALOG ON MOBILE) --- */}
        <Dialog
          open={openCreate}
          onClose={handleCloseCreate}
          fullScreen={window.innerWidth < 600}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              height: { xs: "100%", sm: "auto" },
            },
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="h6" component="span" fontWeight={700}>
              New Order
            </Typography>
            <IconButton onClick={handleCloseCreate}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <Box sx={{ px: 3, pt: 2 }}>
            <Stepper activeStep={activeStep} alternativeLabel>
              <Step>
                <StepLabel>Client</StepLabel>
              </Step>
              <Step>
                <StepLabel>Items</StepLabel>
              </Step>
              <Step>
                <StepLabel>Confirm</StepLabel>
              </Step>
            </Stepper>
          </Box>

          <DialogContent sx={{ minHeight: 300, pt: 4 }}>
            {/* STEP 1: CUSTOMER */}
            {activeStep === 0 && (
              <Stack spacing={2}>
                <TextField
                  placeholder="Search Client..."
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
                <List>
                  {CUSTOMERS.map((cust) => (
                    <ListItem key={cust} disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        onClick={() => setSelectedCustomer(cust)}
                        selected={selectedCustomer === cust}
                        sx={{
                          borderRadius: 2,
                          border:
                            selectedCustomer === cust
                              ? `1px solid ${theme.palette.primary.main}`
                              : `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: "primary.main",
                            }}
                          >
                            {cust[0]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={cust}
                          secondary="12 Business Park, NY"
                        />
                        {selectedCustomer === cust && (
                          <CheckCircleIcon color="primary" />
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Stack>
            )}

            {/* STEP 2: PRODUCTS */}
            {activeStep === 1 && (
              <Stack spacing={2}>
                <TextField
                  placeholder="Search Products..."
                  size="small"
                  fullWidth
                />
                <Box sx={{ height: 250, overflowY: "auto" }}>
                  {PRODUCTS.map((prod) => (
                    <Paper
                      key={prod.id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        mb: 1,
                        borderRadius: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {prod.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Stock: {prod.stock}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          color="primary.main"
                        >
                          ${prod.price}
                        </Typography>
                      </Box>
                      {cart[prod.id] ? (
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          bgcolor={alpha(theme.palette.divider, 0.1)}
                          borderRadius={4}
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveFromCart(prod.id)}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <Typography fontWeight={600}>
                            {cart[prod.id]}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleAddToCart(prod.id)}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAddToCart(prod.id)}
                        >
                          Add
                        </Button>
                      )}
                    </Paper>
                  ))}
                </Box>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    borderRadius: 2,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography fontWeight={600}>Total Amount</Typography>
                  <Typography fontWeight={800} color="primary.main">
                    ${cartTotal.toLocaleString()}
                  </Typography>
                </Paper>
              </Stack>
            )}

            {/* STEP 3: CONFIRMATION & LOCATION */}
            {activeStep === 2 && (
              <Stack spacing={3}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    CUSTOMER
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {selectedCustomer}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    ITEMS
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {Object.values(cart).reduce((a, b) => a + b, 0)} Items
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    TOTAL VALUE
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    color="primary.main"
                  >
                    ${cartTotal.toLocaleString()}
                  </Typography>
                </Paper>

                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={
                    isLocating ? null : location ? (
                      <CheckCircleIcon />
                    ) : (
                      <MyLocationIcon />
                    )
                  }
                  onClick={captureLocation}
                  color={location ? "success" : "primary"}
                  sx={{ py: 1.5, borderStyle: "dashed" }}
                  disabled={isLocating}
                >
                  {isLocating
                    ? "Acquiring GPS..."
                    : location
                    ? "Location Verified"
                    : "Tag Location (Required)"}
                </Button>
                {location && (
                  <Typography
                    variant="caption"
                    align="center"
                    color="text.secondary"
                  >
                    {location}
                  </Typography>
                )}
              </Stack>
            )}
          </DialogContent>

          <DialogActions
            sx={{ p: 3, borderTop: `1px solid ${theme.palette.divider}` }}
          >
            <Button
              onClick={() =>
                activeStep === 0
                  ? handleCloseCreate()
                  : setActiveStep((prev) => prev - 1)
              }
              color="inherit"
            >
              {activeStep === 0 ? "Cancel" : "Back"}
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              className="text-white cursor-pointer"
              disabled={
                (activeStep === 0 && !selectedCustomer) ||
                (activeStep === 2 && !location)
              }
              endIcon={
                activeStep === 2 ? <CheckCircleIcon /> : <ArrowForwardIcon />
              }
              sx={{ px: 4, borderRadius: 2 }}
            >
              {activeStep === 2 ? "Submit Order" : "Next"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- VIEW ORDER DRAWER --- */}
        <Drawer
          anchor="bottom"
          open={Boolean(viewOrder)}
          onClose={() => setViewOrder(null)}
          PaperProps={{
            sx: { maxHeight: "90vh" },
          }}
        >
          {viewOrder && (
            <Box sx={{ p: 3 }}>
              <Box
                sx={{
                  width: 40,
                  height: 4,
                  bgcolor: "divider",
                  borderRadius: 2,
                  mx: "auto",
                  mb: 3,
                }}
              />

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
              >
                <Box>
                  <Typography variant="h5" fontWeight={800}>
                    {viewOrder.id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {viewOrder.customer}
                  </Typography>
                </Box>
                <Chip
                  label={viewOrder.status}
                  color={getStatusColor(viewOrder.status) as any}
                  sx={{ fontWeight: 700 }}
                />
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.05),
                  border: "none",
                  mb: 3,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  color="text.secondary"
                >
                  <LocationOnIcon fontSize="small" />
                  <Typography variant="body2">{viewOrder.location}</Typography>
                </Stack>
              </Paper>

              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Order Items
              </Typography>
              <List dense>
                {[1, 2, 3].map((i) => (
                  <ListItem key={i} divider>
                    <ListItemText
                      primary="Premium Widget X"
                      secondary="Qty: 5 x $120"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                    <Typography fontWeight={700}>$600</Typography>
                  </ListItem>
                ))}
              </List>

              <Stack direction="row" justifyContent="space-between" mt={2}>
                <Typography variant="h6" fontWeight={700}>
                  Total
                </Typography>
                <Typography variant="h6" fontWeight={800} color="primary.main">
                  ${viewOrder.amount.toLocaleString()}
                </Typography>
              </Stack>

              <Button fullWidth variant="contained" size="large" sx={{ mt: 4 }}>
                Download Invoice
              </Button>
            </Box>
          )}
        </Drawer>
      </motion.div>
    </>
  );
}

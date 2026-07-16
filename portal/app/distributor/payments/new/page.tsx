"use client";
import { toast } from "sonner";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Grid,
  MenuItem,
  TableSortLabel,
  TablePagination,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// Icons
import { SearchIcon, InventoryIcon, BackupIcon, ReceiptIcon, FilterAltIcon, PictureAsPdfIcon } from "@/components/icons";

import { distributorService, StockRequest, StockRequestShortage } from "@/lib/distributor-service";
import { authService, UserProfile } from "@/lib/auth-service";

export default function PendingPaymentsPage() {
  const theme = useTheme();
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [shortages, setShortages] = useState<StockRequestShortage[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderBy, setOrderBy] = useState<string>("request_date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    const initPage = async () => {
      try {
        setLoading(true);
        const [userData, requestsData, shortagesData] = await Promise.all([
          authService.getCurrentUser(),
          distributorService.getStockRequests(),
          distributorService.getShortages(),
        ]);

        if (userData.role !== "distributor") {
          router.push("/dashboard");
          return;
        }

        setUser(userData);
        setRequests(Array.isArray(requestsData) ? requestsData : (requestsData as any).results || []);
        setShortages(Array.isArray(shortagesData) ? shortagesData : (shortagesData as any).results || []);
      } catch (error) {
        console.error("Failed to load pending payments", error);
        toast.error("Failed to load pending payments.");
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, [router]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSearch("");
    setPaymentStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setOrderBy(newValue === 0 ? "request_date" : "created_at");
    setOrder("desc");
    setPage(0);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const getDueDate = (req: StockRequest) => {
    if (req.invoices && req.invoices.length > 0) {
      return req.invoices[0].due_date || null;
    }
    return null;
  };

  const calculateRequestTotal = (req: StockRequest) => {
    if (req.invoices && req.invoices.length > 0) {
      return req.invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    }
    return req.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
  };

  const sortedAndFilteredRequests = useMemo(() => {
    const filtered = requests.filter((req) => {
      if (req.payment_status === "paid") return false;
      const matchesSearch = req.request_number.toLowerCase().includes(search.toLowerCase()) || req.description?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = paymentStatusFilter === "all" || req.payment_status === paymentStatusFilter;
      let matchesDate = true;
      if (dateFrom) matchesDate = matchesDate && new Date(req.request_date) >= new Date(dateFrom);
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59);
        matchesDate = matchesDate && new Date(req.request_date) <= dTo;
      }
      return matchesSearch && matchesStatus && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      let valA: any = a[orderBy as keyof StockRequest];
      let valB: any = b[orderBy as keyof StockRequest];

      if (orderBy === "total_amount") {
        valA = calculateRequestTotal(a);
        valB = calculateRequestTotal(b);
      } else if (orderBy === "due_date") {
        valA = getDueDate(a) || "9999-12-31";
        valB = getDueDate(b) || "9999-12-31";
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [requests, search, paymentStatusFilter, dateFrom, dateTo, orderBy, order]);

  const sortedAndFilteredShortages = useMemo(() => {
    const filtered = shortages.filter((sho) => {
      if (sho.payment_status === "paid") return false;
      const matchesSearch = sho.stock_request_number.toLowerCase().includes(search.toLowerCase()) || sho.product_name.toLowerCase().includes(search.toLowerCase()) || sho.sku.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = paymentStatusFilter === "all" || sho.payment_status === paymentStatusFilter;
      let matchesDate = true;
      if (dateFrom) matchesDate = matchesDate && new Date(sho.created_at) >= new Date(dateFrom);
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59);
        matchesDate = matchesDate && new Date(sho.created_at) <= dTo;
      }
      return matchesSearch && matchesStatus && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      let valA: any = a[orderBy as keyof StockRequestShortage];
      let valB: any = b[orderBy as keyof StockRequestShortage];

      if (orderBy === "total_amount") {
        valA = Number((a as any).total_price) || 0;
        valB = Number((b as any).total_price) || 0;
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [shortages, search, paymentStatusFilter, dateFrom, dateTo, orderBy, order]);

  const paginatedRequests = useMemo(() => {
    return sortedAndFilteredRequests.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedAndFilteredRequests, page, rowsPerPage]);

  const paginatedShortages = useMemo(() => {
    return sortedAndFilteredShortages.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedAndFilteredShortages, page, rowsPerPage]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid": return "success";
      case "invoiced": return "info";
      case "overdue": return "error";
      case "unpaid": return "warning";
      case "partially_paid": return "secondary";
      default: return "default";
    }
  };

  const handleDownloadInvoice = async (row: any, type: 'request' | 'shortage') => {
    try {
      let invoiceId: number | undefined;
      let invoiceNumber: string | undefined;

      if (type === 'request') {
        if (row.invoices && row.invoices.length > 0) {
          invoiceId = row.invoices[0].id;
          invoiceNumber = row.invoices[0].invoice_number;
        }
      } else {
        if (row.is_invoiced && row.invoice) {
          invoiceId = row.invoice;
          invoiceNumber = `INV-${row.stock_request_number}`;
        }
      }

      if (!invoiceId || !invoiceNumber) {
        alert("No invoice generated for this item yet.");
        return;
      }

      setDownloadingId(row.id);
      await distributorService.downloadInvoicePDF(invoiceId, invoiceNumber);
    } catch (error) {
      console.error("Download failed", error);
      alert("Failed to download invoice. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading && !user) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Box mb={4}>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
            Make Payment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View pending payments for stock requests and backordered items.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ borderRadius: 1, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
            <Tabs value={tabValue} onChange={handleTabChange} sx={{ px: 2 }}>
              <Tab
                icon={<InventoryIcon sx={{ fontSize: 20 }} />}
                iconPosition="start"
                label="Stock Request"
                sx={{ fontWeight: 700, py: 2 }}
              />
              <Tab
                icon={<BackupIcon sx={{ fontSize: 20 }} />}
                iconPosition="start"
                label="Backordered Section"
                sx={{ fontWeight: 700, py: 2 }}
              />
            </Tabs>
          </Box>

          {/* FILTERS */}
          <Box sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.2), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}` }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="disabled" />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: 2.5 }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Payment Status"
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                  <MenuItem value="invoiced">Invoiced</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                  <MenuItem value="partially_paid">Partially Paid</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 2.5 }}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  label="From"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 2.5 }}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  label="To"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                />
              </Grid>
            </Grid>
          </Box>

          <TableContainer sx={{ minHeight: 400 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: 4, fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <TableSortLabel
                      active={orderBy === (tabValue === 0 ? "request_number" : "stock_request_number")}
                      direction={orderBy === (tabValue === 0 ? "request_number" : "stock_request_number") ? order : "asc"}
                      onClick={() => handleRequestSort(tabValue === 0 ? "request_number" : "stock_request_number")}
                    >
                      {tabValue === 0 ? "REQUEST #" : "BACKORDER #"}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <TableSortLabel
                      active={orderBy === (tabValue === 0 ? "request_date" : "created_at")}
                      direction={orderBy === (tabValue === 0 ? "request_date" : "created_at") ? order : "asc"}
                      onClick={() => handleRequestSort(tabValue === 0 ? "request_date" : "created_at")}
                    >
                      {tabValue === 0 ? "DATE" : "ITEM"}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <TableSortLabel
                      active={orderBy === "total_amount"}
                      direction={orderBy === "total_amount" ? order : "asc"}
                      onClick={() => handleRequestSort("total_amount")}
                    >
                      AMOUNT
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <TableSortLabel
                      active={orderBy === "due_date"}
                      direction={orderBy === "due_date" ? order : "asc"}
                      onClick={() => handleRequestSort("due_date")}
                    >
                      DUE DATE
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    PAYMENT STATUS
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.02), pr: 4 }}>
                    ACTION
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence mode="wait">
                  {tabValue === 0 ? (
                    paginatedRequests.map((row) => (
                      <TableRow key={row.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 4, fontWeight: 600, color: 'primary.main' }}>
                          {row.request_number}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{new Date(row.request_date).toLocaleDateString()}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.items.length} items</Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          ₹{calculateRequestTotal(row).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {getDueDate(row) ? (
                            <Typography variant="body2" sx={{ color: new Date(getDueDate(row)!) < new Date() ? 'error.main' : 'text.primary', fontWeight: 600 }}>
                              {new Date(getDueDate(row)!).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.disabled">N/A</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.payment_status.toUpperCase()}
                            size="small"
                            color={getStatusColor(row.payment_status) as any}
                            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 4 }}>
                          <Tooltip title="Download Invoice">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleDownloadInvoice(row, 'request')}
                              disabled={downloadingId === row.id || (!row.invoices || row.invoices.length === 0)}
                            >
                              {downloadingId === row.id ? (
                                <CircularProgress size={20} color="inherit" />
                              ) : (
                                <PictureAsPdfIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    paginatedShortages.map((row: any) => (
                      <TableRow key={row.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 4, fontWeight: 600, color: 'secondary.main' }}>
                          {row.stock_request_number}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{row.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary">Qty: {row.shortage_quantity} | {row.sku}</Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          ₹{(Number(row.total_price) || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {/* Assuming shortage might have a due date in its invoice if applicable */}
                          {row.is_invoiced ? (
                            <Typography variant="body2" color="text.secondary">Invoiced</Typography>
                          ) : (
                            <Typography variant="body2" color="text.disabled">N/A</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.payment_status?.toUpperCase() || "PENDING"}
                            size="small"
                            color={getStatusColor(row.payment_status || "unpaid") as any}
                            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 4 }}>
                          <Tooltip title="Download Invoice">
                            <IconButton
                              size="small"
                              color="secondary"
                              onClick={() => handleDownloadInvoice(row, 'shortage')}
                              disabled={downloadingId === row.id || !row.is_invoiced}
                            >
                              {downloadingId === row.id ? (
                                <CircularProgress size={20} color="inherit" />
                              ) : (
                                <PictureAsPdfIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </AnimatePresence>

                {((tabValue === 0 && sortedAndFilteredRequests.length === 0) || (tabValue === 1 && sortedAndFilteredShortages.length === 0)) && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                      <Box sx={{ opacity: 0.3 }}>
                        <InventoryIcon sx={{ fontSize: 64, mb: 1 }} />
                        <Typography variant="h6">No pending payments found</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={tabValue === 0 ? sortedAndFilteredRequests.length : sortedAndFilteredShortages.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </motion.div>
    </>
  );
}


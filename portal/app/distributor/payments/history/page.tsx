"use client";
import { toast } from "sonner";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
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
  Tooltip,
  Tabs,
  Tab,
  CircularProgress,
  TablePagination,
  TableSortLabel,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// Icons
import { SearchIcon, ReceiptLongIcon, CheckCircleIcon, InventoryIcon, BackupIcon, FilterAltIcon, PictureAsPdfIcon } from "@/components/icons";

import { distributorService, StockRequest, StockRequestShortage } from "@/lib/distributor-service";
import { authService, UserProfile } from "@/lib/auth-service";

export default function PaymentHistoryPage() {
  const theme = useTheme();
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [shortages, setShortages] = useState<StockRequestShortage[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [orderBy, setOrderBy] = useState<string>("payment_date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const loadData = async () => {
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
        console.error("Failed to load payment history", error);
        toast.error("Failed to load payment history.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setOrderBy(newValue === 0 ? "payment_date" : "created_at");
    setOrder("desc");
    setPage(0);
  };

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const calculateRequestTotal = (req: StockRequest) => {
    if (req.invoices && req.invoices.length > 0) {
      return req.invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    }
    return req.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
  };

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter((req) => {
      // Only show PAID
      if (req.payment_status !== "paid") return false;

      const matchesSearch =
        req.request_number.toLowerCase().includes(search.toLowerCase()) ||
        req.payment_reference?.toLowerCase()?.includes(search.toLowerCase());

      let matchesDate = true;
      if (dateFrom) matchesDate = matchesDate && new Date(req.payment_date || req.request_date) >= new Date(dateFrom);
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59);
        matchesDate = matchesDate && new Date(req.payment_date || req.request_date) <= dTo;
      }

      return matchesSearch && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      let valA: any = a[orderBy as keyof StockRequest];
      let valB: any = b[orderBy as keyof StockRequest];

      if (orderBy === "payment_date") {
        valA = a.payment_date || a.request_date;
        valB = b.payment_date || b.request_date;
      } else if (orderBy === "total_amount") {
        valA = calculateRequestTotal(a);
        valB = calculateRequestTotal(b);
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [requests, search, dateFrom, dateTo, orderBy, order]);

  const filteredShortages = useMemo(() => {
    const filtered = shortages.filter((sho) => {
      if (sho.payment_status !== "paid") return false;

      const matchesSearch =
        sho.stock_request_number.toLowerCase().includes(search.toLowerCase()) ||
        sho.product_name.toLowerCase().includes(search.toLowerCase());

      let matchesDate = true;
      if (dateFrom) matchesDate = matchesDate && new Date(sho.created_at) >= new Date(dateFrom);
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59);
        matchesDate = matchesDate && new Date(sho.created_at) <= dTo;
      }

      return matchesSearch && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      let valA: any = a[orderBy as keyof StockRequestShortage];
      let valB: any = b[orderBy as keyof StockRequestShortage];

      if (orderBy === "payment_date") {
        valA = (a as any).payment_date || a.created_at;
        valB = (b as any).payment_date || b.created_at;
      } else if (orderBy === "total_amount") {
        valA = Number((a as any).total_price) || 0;
        valB = Number((b as any).total_price) || 0;
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [shortages, search, dateFrom, dateTo, orderBy, order]);

  const paginatedRequests = useMemo(() => {
    return filteredRequests.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredRequests, page, rowsPerPage]);

  const paginatedShortages = useMemo(() => {
    return filteredShortages.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredShortages, page, rowsPerPage]);

  const handleDownloadReceipt = async (row: any, type: 'request' | 'shortage') => {
    try {
      let invoiceId: number | undefined;
      let invoiceNumber: string | undefined;

      if (type === 'request') {
        if (row.invoices && row.invoices.length > 0) {
          invoiceId = row.invoices[0].id; // Use first invoice for summary
          invoiceNumber = row.invoices[0].invoice_number;
        }
      } else {
        if (row.invoice) {
          invoiceId = row.invoice;
          invoiceNumber = `INV-${row.stock_request_number}`;
        }
      }

      if (!invoiceId || !invoiceNumber) {
        alert("No receipt found for this payment.");
        return;
      }

      setDownloadingId(row.id);
      await distributorService.downloadInvoicePDF(invoiceId, invoiceNumber);
    } catch (error) {
      console.error("Download failed", error);
      alert("Failed to download receipt. Please try again.");
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
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
              Payment History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View records of your completed payments.
            </Typography>
          </Box>
        </Stack>

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
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search by number or reference..."
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
              <Grid size={{ xs: 12, sm: 3 }}>
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

          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.info.main, 0.02), pl: 4 }}>
                    {tabValue === 0 ? "REQUEST #" : "BACKORDER #"}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
                    <TableSortLabel
                      active={orderBy === "payment_date"}
                      direction={orderBy === "payment_date" ? order : "asc"}
                      onClick={() => handleRequestSort("payment_date")}
                    >
                      PAID ON
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
                    <TableSortLabel
                      active={orderBy === "total_amount"}
                      direction={orderBy === "total_amount" ? order : "asc"}
                      onClick={() => handleRequestSort("total_amount")}
                    >
                      AMOUNT
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
                    REFERENCE
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
                    STATUS
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.info.main, 0.02), pr: 4 }}>
                    RECEIPT
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tabValue === 0 ? (
                  paginatedRequests.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.main', pl: 4 }}>
                        {row.request_number}
                      </TableCell>
                      <TableCell>
                        {row.payment_date ? (
                          <Typography variant="body2" fontWeight={600}>
                            {new Date(row.payment_date).toLocaleDateString()}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {new Date(row.request_date).toLocaleDateString()}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        ₹{calculateRequestTotal(row).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', opacity: 0.8 }}>
                          {row.payment_reference || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label="PAID"
                          size="small"
                          color="success"
                          icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                          sx={{ fontWeight: 700, fontSize: '0.65rem', borderRadius: 1 }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 4 }}>
                        <Tooltip title="Download Receipt">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleDownloadReceipt(row, 'request')}
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
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ fontWeight: 600, color: 'secondary.main', pl: 4 }}>
                        {row.stock_request_number}
                      </TableCell>
                      <TableCell>
                        {row.payment_date ? (
                          <Typography variant="body2" fontWeight={600}>
                            {new Date(row.payment_date).toLocaleDateString()}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {new Date(row.created_at).toLocaleDateString()}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        ₹{(Number(row.total_price) || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', opacity: 0.8 }}>
                          {row.payment_reference || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label="PAID"
                          size="small"
                          color="success"
                          icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                          sx={{ fontWeight: 700, fontSize: '0.65rem', borderRadius: 1 }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 4 }}>
                        <Tooltip title="Download Receipt">
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => handleDownloadReceipt(row, 'shortage')}
                            disabled={downloadingId === row.id || !row.invoice}
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

                {((tabValue === 0 && filteredRequests.length === 0) || (tabValue === 1 && filteredShortages.length === 0)) && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 10, opacity: 0.3 }}>
                      <InventoryIcon sx={{ fontSize: 64, mb: 1 }} />
                      <Typography variant="h6">No completed payments found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={tabValue === 0 ? filteredRequests.length : filteredShortages.length}
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

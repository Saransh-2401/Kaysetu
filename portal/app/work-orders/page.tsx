"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  TextField,
  InputAdornment,
  Tooltip,
  LinearProgress,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Grid,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { productionService, WorkOrder, JobCard } from "@/lib/production-service";

// Icons
import { SearchIcon, ExpandMoreIcon, ReceiptLongIcon, ArrowForwardIcon, RefreshIcon, PrintIcon, EngineeringIcon, VisibilityIcon, HistoryIcon, FactoryIcon, CheckCircleIcon, ListAltIcon, CloseIcon } from "@/components/icons";
import { Snackbar, Alert } from "@mui/material";

export default function WorkOrdersPage() {
  const theme = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const response = await productionService.getWorkOrders();
      setWorkOrders(response.results || []);
    } catch (error) {
      console.error("Failed to fetch work orders", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintJobCard = async (workOrderId: number, woNumber: string) => {
    try {
      setToast({ open: true, message: "Generating Job Card PDF...", severity: "info" });
      const blob = await productionService.printJobCard(workOrderId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `JobCard_${woNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setToast({ open: true, message: "Job Card downloaded successfully!", severity: "success" });
    } catch (error) {
      console.error("Failed to print Job Card", error);
      setToast({ open: true, message: "Failed to generate Job Card PDF. Please try again.", severity: "error" });
    }
  };

  const groupedWorkOrders = useMemo(() => {
    const grouped: Record<string, WorkOrder[]> = {};
    const filtered = workOrders.filter(
      (wo) =>
        wo.work_order_number.toLowerCase().includes(search.toLowerCase()) ||
        wo.item_name.toLowerCase().includes(search.toLowerCase()) ||
        (wo.plan_number || '').toLowerCase().includes(search.toLowerCase())
    );

    filtered.forEach(wo => {
      const key = wo.plan_number || 'Unplanned / Manual';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(wo);
    });

    return grouped;
  }, [workOrders, search]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "in_progress":
      case "in progress":
        return "primary";
      case "scheduled":
      case "not_started":
        return "info";
      case "completed":
        return "success";
      case "stopped":
      case "blocked":
        return "error";
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
              Work Orders
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage production execution grouped by Production Plan.
            </Typography>
          </Box>
          <IconButton onClick={fetchWorkOrders} color="primary" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
            <RefreshIcon />
          </IconButton>
        </Stack>

        <Box sx={{ mb: 4 }}>
          <TextField
            placeholder="Search Work Order, Item or Plan..."
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              bgcolor: "background.paper",
              borderRadius: 2,
            }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
          </Box>
        ) : Object.keys(groupedWorkOrders).length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No work orders found.</Typography>
          </Paper>
        ) : (
          Object.entries(groupedWorkOrders).map(([planNumber, orders]) => (
            <Accordion
              key={planNumber}
              defaultExpanded
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
                  <Typography variant="h6" fontWeight={700}>
                    Plan: {planNumber}
                  </Typography>
                  <Box flexGrow={1} />
                  <Chip
                    label={`${orders.length} items`}
                    size="small"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.action.hover, 0.05) }}>
                        <TableCell sx={{ fontWeight: 700, pl: 3 }}>WO NUMBER</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>ITEM</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>QUANTITY</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>PROGRESS</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: 'right', pr: 3 }}>ACTIONS</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((row) => {
                        const percent = row.completion_percentage ?? ((row.produced_quantity / row.quantity_to_produce) * 100 || 0);
                        return (
                          <TableRow key={row.id} hover>
                            <TableCell sx={{ pl: 3, fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                              {row.work_order_number}
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {row.item_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                BOM: {row.bom_number}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {row.quantity_to_produce} Units
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ width: 180 }}>
                              <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between">
                                  <Typography variant="caption" fontWeight={700}>
                                    {percent.toFixed(0)}%
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {row.produced_quantity} Done
                                  </Typography>
                                </Stack>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(percent, 100)}
                                  color={percent >= 100 ? "success" : "primary"}
                                  sx={{ height: 6, borderRadius: 1 }}
                                />
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={row.status.toUpperCase().replace('_', ' ')}
                                size="small"
                                color={getStatusColor(row.status) as any}
                                sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: '0.65rem' }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ pr: 3 }}>
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Tooltip title="Print Job Card">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handlePrintJobCard(row.id, row.work_order_number)}
                                  >
                                    <PrintIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="View Job Cards">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => router.push(`/job-cards?wo=${row.id}`)}
                                  >
                                    <EngineeringIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="View Details">
                                  <IconButton
                                    size="small"
                                    color="info"
                                    onClick={() => {
                                      setSelectedWO(row);
                                      setViewDialogOpen(true);
                                    }}
                                  >
                                    <VisibilityIcon />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))
        )}

      </motion.div>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} sx={{ width: '100%', borderRadius: 1, fontWeight: 700 }}>
          {toast.message}
        </Alert>
      </Snackbar>

      {/* WORK ORDER DETAIL DIALOG */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 1, backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.background.default, 0.95)} 100%)` } }}
      >
        {selectedWO && (
          <>
            <DialogTitle sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h5" fontWeight={900}>Work Order Details</Typography>
                <Typography variant="caption" color="primary" fontWeight={800} sx={{ letterSpacing: 1 }}>{selectedWO.work_order_number}</Typography>
              </Box>
              <IconButton onClick={() => setViewDialogOpen(false)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <Divider sx={{ opacity: 0.1 }} />
            <DialogContent sx={{ p: 3 }}>
              <Grid container spacing={3}>
                {/* HEADERS / SUMMARY ROW */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid size={{ xs: 12, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">Produced Item</Typography>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{selectedWO.item_name}</Typography>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">Execution Status</Typography>
                        <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'center' }}>
                          <Chip label={selectedWO.status.toUpperCase()} color={getStatusColor(selectedWO.status) as any} sx={{ fontWeight: 800, borderRadius: 1.5, height: 22, fontSize: '0.65rem' }} />
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 3, sm: 3 }} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">Target Qty</Typography>
                        <Typography variant="subtitle2" fontWeight={800} color="primary">{selectedWO.quantity_to_produce} Units</Typography>
                      </Grid>
                      <Grid size={{ xs: 3, sm: 3 }} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">Produced Qty</Typography>
                        <Typography variant="subtitle2" fontWeight={800} color="success.main">{selectedWO.produced_quantity || 0} Units</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* PROGRESS ROW */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2, px: 3, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.02) }}>
                    <Stack direction="row" spacing={3} alignItems="center">
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase" sx={{ whiteSpace: 'nowrap' }}>Overall Progress</Typography>
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={selectedWO.completion_percentage || 0}
                          sx={{ height: 10, borderRadius: 5, bgcolor: alpha(theme.palette.primary.main, 0.1) }}
                          color={selectedWO.completion_percentage === 100 ? "success" : "primary"}
                        />
                      </Box>
                      <Typography variant="h6" fontWeight={900} color={selectedWO.completion_percentage === 100 ? "success.main" : "primary.main"}>
                        {selectedWO.completion_percentage || 0}%
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>

                {/* JOB CARDS TABLE */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6" fontWeight={900} sx={{ mb: 2, mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EngineeringIcon color="primary" /> Operations & Job Cards
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Operation</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedWO.job_cards?.map((jc) => (
                          <TableRow key={jc.id}>
                            <TableCell sx={{ fontWeight: 600 }}>{jc.operation_name}</TableCell>
                            <TableCell align="right">
                              <Chip size="small" label={jc.status.toUpperCase()} color={jc.status === 'completed' ? 'success' : jc.status === 'in_progress' ? 'primary' : 'default'} sx={{ fontWeight: 700, height: 20 }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* ACTIVITY LOGS */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HistoryIcon color="primary" /> Execution Timeline
                  </Typography>
                  <Paper variant="outlined" sx={{ borderRadius: 1, p: 3, bgcolor: alpha(theme.palette.background.paper, 0.4) }}>
                    {selectedWO.execution_logs && selectedWO.execution_logs.length > 0 ? (
                      <Stack spacing={3} sx={{ position: 'relative', pl: 4 }}>
                        <Box sx={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, bgcolor: alpha(theme.palette.primary.main, 0.08) }} />
                        {selectedWO.execution_logs.map((log) => (
                          <Box key={log.id} sx={{ position: 'relative', zIndex: 1 }}>
                            <Box sx={{
                              position: 'absolute',
                              left: -25,
                              top: 4,
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: log.status === 'completed' ? theme.palette.success.main : theme.palette.primary.main,
                              border: `3px solid ${theme.palette.background.paper}`,
                              boxShadow: `0 0 10px ${alpha(log.status === 'completed' ? theme.palette.success.main : theme.palette.primary.main, 0.4)}`
                            }} />
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Box>
                                <Typography variant="subtitle2" fontWeight={800}>{log.description}</Typography>
                                <Typography variant="caption" color="text.disabled" fontWeight={700}>REF: {log.reference_no}</Typography>
                              </Box>
                              <Typography variant="caption" color="text.disabled" fontWeight={800}>
                                {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Box sx={{ p: 4, textAlign: 'center', opacity: 0.6 }}>
                        <ListAltIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1, opacity: 0.3 }} />
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>No timeline data available.</Typography>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setViewDialogOpen(false)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}

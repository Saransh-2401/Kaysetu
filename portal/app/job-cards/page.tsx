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
  useTheme,
  alpha,
  TextField,
  TableCell,
  LinearProgress,
  TableRow,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  CircularProgress,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Snackbar,
  Alert
} from "@mui/material";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { productionService, JobCard } from "@/lib/production-service";

// Icons
import { SearchIcon, ExpandMoreIcon, PlayCircleOutlineIcon, StopIcon, CheckCircleIcon, CheckIcon, EditIcon, ErrorOutlineIcon, RefreshIcon } from "@/components/icons";

export default function JobCardsPage() {
  const theme = useTheme();
  const searchParams = useSearchParams();
  const woId = searchParams.get('wo');

  const [search, setSearch] = useState("");
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    fetchJobCards();
  }, [woId]);

  const fetchJobCards = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (woId) params.work_order = woId;
      const response = await productionService.getJobCards(params);
      setJobCards(response.results || []);
    } catch (error) {
      console.error("Failed to fetch job cards", error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (jobCardId: number) => {
    try {
      await productionService.completeJobCard(jobCardId);
      setToast({ open: true, message: 'Job Card completed successfully', severity: 'success' });
      fetchJobCards();
    } catch (error: any) {
      setToast({
        open: true,
        message: error.response?.data?.error || 'Failed to complete job card',
        severity: 'error'
      });
    }
  };

  const groupedJobCards = useMemo(() => {
    const grouped: Record<string, JobCard[]> = {};
    const filtered = jobCards.filter(
      (jc) =>
        jc.job_card_number.toLowerCase().includes(search.toLowerCase()) ||
        jc.work_order_number.toLowerCase().includes(search.toLowerCase()) ||
        jc.operation_name.toLowerCase().includes(search.toLowerCase())
    );

    filtered.forEach(jc => {
      if (!grouped[jc.work_order_number]) {
        grouped[jc.work_order_number] = [];
      }
      grouped[jc.work_order_number].push(jc);
    });

    // Sort job cards within groups by ID (assuming ID reflects sequence)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.id || 0) - (b.id || 0));
    });

    return grouped;
  }, [jobCards, search]);

  const getStatusChip = (status: string) => {
    let color = "default";
    let icon: React.ReactElement | undefined;
    switch (status.toLowerCase()) {
      case "in_progress":
        color = "primary";
        icon = <PlayCircleOutlineIcon fontSize="small" />;
        break;
      case "completed":
        color = "success";
        icon = <CheckCircleIcon fontSize="small" />;
        break;
      case "blocked":
        color = "error";
        icon = <ErrorOutlineIcon fontSize="small" />;
        break;
      case "pending":
      case "scheduled":
        color = "info";
        break;
      default:
        color = "default";
    }
    return { color, icon };
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
              Job Cards
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track and manage individual production tasks grouped by Work Order.
              {woId && ` Showing for Work Order #${woId}`}
            </Typography>
          </Box>
          <IconButton onClick={fetchJobCards} color="primary" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
            <RefreshIcon />
          </IconButton>
        </Stack>

        <Box sx={{ mb: 4 }}>
          <TextField
            placeholder="Search Job Card, Work Order or Operation..."
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
        ) : Object.keys(groupedJobCards).length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No job cards found matching your criteria.</Typography>
          </Paper>
        ) : (
          Object.entries(groupedJobCards).map(([woNumber, cards]) => (
            <Accordion
              key={woNumber}
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
                  <Typography variant="h6" fontWeight={700}>
                    Work Order: {woNumber}
                  </Typography>
                  <Box flexGrow={1} />
                  <Chip
                    label={`${cards.filter(c => c.status === 'completed').length} / ${cards.length} Completed`}
                    size="small"
                    color={cards.every(c => c.status === 'completed') ? 'success' : 'default'}
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.action.hover, 0.05) }}>
                        <TableCell sx={{ fontWeight: 700, pl: 4 }}>JOB CARD ID</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>OPERATION</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>PROGRESS</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: "right", pr: 4 }}>ACTIONS</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cards.map((row, index) => {
                        const percent = (row.completed_quantity / row.for_quantity) * 100 || 0;
                        const { color, icon } = getStatusChip(row.status);

                        // Logic for Sequence Enforcement
                        const isCompleted = row.status === 'completed';
                        const isPreviousCompleted = index === 0 || cards[index - 1].status === 'completed';
                        const canComplete = !isCompleted && isPreviousCompleted;
                        const isPending = row.status === 'pending' || row.status === 'scheduled';
                        const isNextInLine = canComplete;

                        return (
                          <TableRow
                            key={row.id}
                            hover
                            sx={{
                              bgcolor: isNextInLine && !isCompleted ? alpha(theme.palette.primary.main, 0.02) : 'inherit',
                              borderLeft: isNextInLine && !isCompleted ? `4px solid ${theme.palette.primary.main}` : '4px solid transparent'
                            }}
                          >
                            <TableCell sx={{ pl: 3, fontFamily: "monospace", fontWeight: 700, color: 'text.primary' }}>
                              {row.job_card_number}
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {row.operation_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {row.workstation ? `Workstation ID: ${row.workstation}` : 'Scanning...'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ width: 180 }}>
                              <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between">
                                  <Typography variant="caption" fontWeight={700}>
                                    {percent.toFixed(0)}%
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {row.completed_quantity} / {row.for_quantity}
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
                                color={color as any}
                                icon={icon}
                                sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: '0.65rem' }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ pr: 4 }}>
                              {/* Action Logic */}
                              {isCompleted ? (
                                <Tooltip title="This operation is completed">
                                  <IconButton size="small" color="success" disabled>
                                    <CheckCircleIcon />
                                  </IconButton>
                                </Tooltip>
                              ) : canComplete ? (
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="small"
                                  startIcon={<CheckIcon />}
                                  onClick={() => row.id && handleComplete(row.id)}
                                  sx={{ borderRadius: 5, textTransform: 'none', px: 2 }}
                                >
                                  Complete
                                </Button>
                              ) : (
                                <Tooltip title="Previous operation must be completed first">
                                  <span>
                                    <Button
                                      variant="outlined"
                                      color="inherit"
                                      size="small"
                                      disabled
                                      startIcon={<StopIcon />}
                                      sx={{ borderRadius: 5, textTransform: 'none', px: 2, opacity: 0.5 }}
                                    >
                                      Locked
                                    </Button>
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
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </motion.div>

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

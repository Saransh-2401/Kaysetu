"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Tabs,
  Tab,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  useTheme,
  alpha,
  CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend, Line, ComposedChart,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { analyticsService } from "@/lib/analytics-service";
import { getFYDates, getLastFYDates } from "@/lib/accounts-api";
import { useChartPalette } from "@/components/admin/analytics/kit";

// Icons
import { DownloadIcon, CalendarTodayIcon, TrendingUpIcon, ShowChartIcon, FilterAltIcon, PeopleAltIcon, MapIcon, EmojiEventsIcon } from "@/components/icons";

// --- COMPONENTS ---

const KpiCard = ({ title, value, trend, subtext, color }: any) => (
  <Paper
    data-animate-group
    elevation={0}
    sx={{
      p: 3,
      height: "100%",
      bgcolor: "background.paper",
      boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
      border: `1px solid ${alpha(color, 0.1)}`,
    }}
  >
    <Typography
      variant="body2"
      color="text.secondary"
      fontWeight={600}
      gutterBottom
    >
      {title}
    </Typography>
    <Stack direction="row" alignItems="flex-end" spacing={1} mb={1}>
      <Typography variant="h4" fontWeight={800} sx={{ color: "text.primary" }}>
        {value}
      </Typography>
      {trend && (
        <Chip
          icon={<TrendingUpIcon />}
          label={trend}
          size="small"
          sx={{
            bgcolor: alpha(color, 0.1),
            color: color,
            fontWeight: 700,
            borderRadius: 1,
            height: 24,
            "& .MuiChip-icon": { color: "inherit", fontSize: 16 },
          }}
        />
      )}
    </Stack>
    <Typography variant="caption" color="text.secondary">
      {subtext}
    </Typography>
  </Paper>
);

export default function SalesReportsPage() {
  const theme = useTheme();
  const cp = useChartPalette();
  const [tab, setTab] = useState(0);
  const [range, setRange] = useState("This Quarter");
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<any>(null);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      let params: Record<string, string> | undefined;
      if (range === "Year to Date") {
        const fy = getFYDates();
        params = { from_date: fy.from_date, to_date: fy.to_date };
      } else if (range === "Last Year (FY)") {
        const fy = getLastFYDates();
        params = { from_date: fy.from_date, to_date: fy.to_date };
      }
      const data = await analyticsService.getSalesReports(params);
      setReportsData(data);
    } catch (error) {
      console.error("Failed to fetch reports data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, [range]);

  if (loading) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  const COLORS = cp.chart;

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
              Analytics & Insights
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Deep dive into revenue, pipeline, and team performance.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              size="small"
              sx={{
                minWidth: 150,
                borderRadius: 2,
              }}
              InputProps={{
                startAdornment: (
                  <CalendarTodayIcon fontSize="small" sx={{ mr: 1 }} />
                ),
              }}
            >
              <MenuItem value="This Month">This Month</MenuItem>
              <MenuItem value="This Quarter">This Quarter</MenuItem>
              <MenuItem value="Year to Date">Year to Date (FY)</MenuItem>
              <MenuItem value="Last Year (FY)">Last Year (FY)</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              sx={{
                borderRadius: "10px",
                borderColor: alpha(theme.palette.divider, 0.3),
                color: "text.primary",
              }}
            >
              Export PDF
            </Button>
          </Stack>
        </Stack>

        {/* TABS */}
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            overflow: "hidden",
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 2,
              "& .MuiTab-root": { py: 3, fontWeight: 700, minHeight: 64 },
            }}
          >
            <Tab
              icon={<ShowChartIcon sx={{ mr: 1 }} />}
              iconPosition="start"
              label="Revenue & Growth"
            />
            <Tab
              icon={<FilterAltIcon sx={{ mr: 1 }} />}
              iconPosition="start"
              label="Pipeline Velocity"
            />
            <Tab
              icon={<PeopleAltIcon sx={{ mr: 1 }} />}
              iconPosition="start"
              label="Team Performance"
            />
            <Tab
              icon={<MapIcon sx={{ mr: 1 }} />}
              iconPosition="start"
              label="Top Customers"
            />
          </Tabs>
        </Paper>

        <Box sx={{ minHeight: 500 }}>
          {/* --- TAB 1: REVENUE --- */}
          {tab === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(1, 1fr)",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(4, 1fr)",
                  },
                  gap: 3,
                  mb: 4,
                }}
              >
                <KpiCard
                  title="Total Revenue"
                  value={`₹${(reportsData?.kpis?.total_revenue || 0).toLocaleString()}`}
                  trend={`+${reportsData?.kpis?.quota_attainment || 0}%`}
                  subtext="vs target"
                  color={theme.palette.primary.main}
                />
                <KpiCard
                  title="Quota Attainment"
                  value={`${reportsData?.kpis?.quota_attainment || 0}%`}
                  trend="+5%"
                  subtext="Team average"
                  color={theme.palette.success.main}
                />
                <KpiCard
                  title="YTD Revenue"
                  value={`₹${(reportsData?.kpis?.year_revenue || 0).toLocaleString()}`}
                  trend="+18.5%"
                  subtext="Annual projection"
                  color={theme.palette.info.main}
                />
                <KpiCard
                  title="Avg Deal Size"
                  value={`₹${Math.round(reportsData?.kpis?.avg_deal_size || 0).toLocaleString()}`}
                  subtext={`${reportsData?.kpis?.total_deals || 0} deals closed`}
                  color={theme.palette.warning.main}
                />
              </Box>

              <Paper sx={{ p: 3, height: 450, mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" mb={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Revenue Trajectory
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Target vs Actual Performance
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          bgcolor: theme.palette.primary.main,
                          borderRadius: "50%",
                        }}
                      />
                      <Typography variant="caption">Actual</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          bgcolor: theme.palette.divider,
                          borderRadius: "50%",
                        }}
                      />
                      <Typography variant="caption">Target</Typography>
                    </Stack>
                  </Stack>
                </Stack>
                <ResponsiveContainer width="100%" height="85%">
                  <ComposedChart data={reportsData?.revenue_trend || []}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={theme.palette.primary.main}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={theme.palette.primary.main}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={alpha(theme.palette.divider, 0.1)}
                    />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke={theme.palette.primary.main}
                      fillOpacity={1}
                      fill="url(#colorRev)"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke={theme.palette.divider}
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Paper>
            </motion.div>
          )}

          {/* --- TAB 2: PIPELINE --- */}
          {tab === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
                  gap: 3,
                }}
              >
                <Paper sx={{ p: 3, height: 500 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Conversion Funnel
                  </Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart
                      layout="vertical"
                      data={reportsData?.funnel_data || []}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fontWeight: 600 }}
                      />
                      <Tooltip cursor={{ fill: "transparent" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                        {(reportsData?.funnel_data || []).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
                <Stack spacing={3} height="100%">
                  <Paper
                    sx={{
                      p: 3,
                      flex: 1,
                      bgcolor: alpha(theme.palette.success.main, 0.05),
                      border: `1px solid ${alpha(
                        theme.palette.success.main,
                        0.2
                      )}`,
                    }}
                  >
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      color="success.main"
                    >
                      {reportsData?.kpis?.quota_attainment || 0}%
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      Quota Attainment
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Team performance vs targets
                    </Typography>
                  </Paper>
                  <Paper sx={{ p: 3, flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      {reportsData?.kpis?.total_deals || 0}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      Total Deals Closed
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={70}
                      sx={{ mt: 2, borderRadius: 2 }}
                    />
                  </Paper>
                  <Paper sx={{ p: 3, flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      ₹{Math.round(reportsData?.kpis?.avg_deal_size || 0).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      Average Deal Size
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Per transaction
                    </Typography>
                  </Paper>
                </Stack>
              </Box>
            </motion.div>
          )}

          {/* --- TAB 3: TEAM --- */}
          {tab === 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Paper
                sx={{
                  overflow: "hidden",
                  boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                }}
              >
                <Box
                  sx={{
                    p: 3,
                    borderBottom: `1px solid ${alpha(
                      theme.palette.divider,
                      0.1
                    )}`,
                  }}
                >
                  <Typography variant="h6" fontWeight={700}>
                    Agent Leaderboard
                  </Typography>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow
                        sx={{
                          bgcolor: alpha(theme.palette.primary.main, 0.02),
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700, pl: 4 }}>
                          RANK
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>AGENT</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>REVENUE</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>QUOTA</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          ATTAINMENT
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          DEALS CLOSED
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(reportsData?.agent_stats || []).map((agent: any, index: number) => {
                        const percent = (agent.sales / agent.quota) * 100;
                        return (
                          <TableRow key={agent.id} hover>
                            <TableCell sx={{ pl: 4 }}>
                              {index === 0 ? (
                                <EmojiEventsIcon sx={{ color: "gold" }} />
                              ) : index === 1 ? (
                                <EmojiEventsIcon sx={{ color: "silver" }} />
                              ) : index === 2 ? (
                                <EmojiEventsIcon sx={{ color: "#CD7F32" }} />
                              ) : (
                                <Typography
                                  fontWeight={700}
                                  color="text.secondary"
                                >
                                  #{index + 1}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700}>
                                {agent.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              ₹{agent.sales.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              ₹{agent.quota.toLocaleString()}
                            </TableCell>
                            <TableCell sx={{ width: 200 }}>
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={2}
                              >
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(percent, 100)}
                                  sx={{
                                    width: 100,
                                    height: 8,
                                  }}
                                  color={
                                    percent >= 100
                                      ? "success"
                                      : percent > 80
                                        ? "primary"
                                        : "warning"
                                  }
                                />
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                >
                                  {percent.toFixed(0)}%
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>{agent.deals}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </motion.div>
          )}

          {/* --- TAB 4: TOP CUSTOMERS --- */}
          {tab === 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 3,
                }}
              >
                <Paper sx={{ p: 3, height: 450 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Top Customers by Revenue
                  </Typography>
                  <ResponsiveContainer width="100%" height="85%">
                    <PieChart data={reportsData?.category_data || []}>
                      <Pie
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(reportsData?.category_data || []).map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
                <Paper sx={{ p: 3, height: 450 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Customer Details
                  </Typography>
                  <TableContainer sx={{ mt: 2 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>CUSTOMER</TableCell>
                          <TableCell align="right">REVENUE</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(reportsData?.category_data || []).map((customer: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {customer.name}
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`₹${customer.value.toLocaleString()}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Box>
            </motion.div>
          )}
        </Box>
      </motion.div>
    </>
  );
}

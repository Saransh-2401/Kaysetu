"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  Avatar,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  LinearProgress,
  TextField,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  TablePagination,
  Chip,
  InputAdornment,
  TableSortLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  useMediaQuery,
} from "@mui/material";
import { SearchIcon, SaveIcon, FileDownloadIcon, EditIcon, CancelIcon, EventAvailableIcon, ShoppingBagIcon, MonetizationOnIcon, PersonAddIcon, AccessTimeIcon, ChevronLeftIcon, ChevronRightIcon, TuneIcon, FilterAltOffIcon, InventoryIcon, TrendingUpIcon, KeyboardArrowDownIcon, KeyboardArrowUpIcon, LocationCityIcon } from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { authService, UserProfile } from "@/lib/auth-service";
import BulkAssignModal from "@/components/sales/BulkAssignModal";

// @ts-ignore
import XLSXStyle from "xlsx-js-style";

// Icons

interface CityTarget {
  id?: number;
  city: string;
  visit_target: number;
  order_target: number;
  stock_request_target: number;
  revenue_target: number;
  stock_request_revenue_target: number;
  new_client_target: number;
  login_hours_target: number;
}

interface Target {
  id?: number;
  visit_target: number;
  order_target: number;
  stock_request_target: number;
  revenue_target: number;
  stock_request_revenue_target: number;
  new_client_target: number;
  login_hours_target: number;
  pincodes: string[];
  city_targets?: CityTarget[];
}

interface CityPerformance {
  city: string;
  targets: {
    visit_target: number;
    order_target: number;
    stock_request_target: number;
    revenue_target: number;
    stock_request_revenue_target: number;
    new_client_target: number;
    login_hours_target: number;
  };
  actuals: {
    visits: number;
    orders: number;
    stock_requests: number;
    revenue: number;
    stock_request_revenue: number;
    new_clients: number;
  };
  performance_percentages: {
    visits: number;
    orders: number;
    stock_requests: number;
    revenue: number;
    stock_request_revenue: number;
    new_clients: number;
  };
}

interface AgentPerformanceData {
  agent_id: number;
  agent_name: string;
  target_type: string;
  targets: Target;
  actuals: {
    visits: number;
    orders: number;
    stock_requests: number;
    revenue: number;
    stock_request_revenue: number;
    new_clients: number;
    login_hours: number;
  };
  performance_percentages: {
    visits: number;
    orders: number;
    stock_requests: number;
    revenue: number;
    stock_request_revenue: number;
    new_clients: number;
    login_hours: number;
  };
  city_performance?: CityPerformance[];
}

const EMPTY_TARGET: Target = {
  visit_target: 0, order_target: 0, stock_request_target: 0,
  revenue_target: 0, stock_request_revenue_target: 0,
  new_client_target: 0, login_hours_target: 0, pincodes: [],
};

// ─── Excel Export ─────────────────────────────────────────────────────────────
const XLSX_PRIMARY = '1565C0';
const XLSX_WHITE = 'FFFFFF';
const XLSX_GREY = 'F5F5F5';
const XLSX_GREEN = 'E8F5E9';
const XLSX_RED = 'FFEBEE';
const XLSX_AMBER = 'FFF8E1';
const XLSX_BORDER = {
  top: { style: 'thin', color: { rgb: 'CFD8DC' } },
  bottom: { style: 'thin', color: { rgb: 'CFD8DC' } },
  left: { style: 'thin', color: { rgb: 'CFD8DC' } },
  right: { style: 'thin', color: { rgb: 'CFD8DC' } },
};

function xlHdr(text: string): any {
  return {
    v: text, t: 's',
    s: {
      font: { bold: true, color: { rgb: XLSX_WHITE }, sz: 11 },
      fill: { fgColor: { rgb: XLSX_PRIMARY } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: XLSX_BORDER,
    },
  };
}

function xlTitle(text: string): any {
  return {
    v: text, t: 's',
    s: {
      font: { bold: true, sz: 14, color: { rgb: '1A237E' } },
      fill: { fgColor: { rgb: XLSX_WHITE } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };
}

function xlSubHdr(text: string): any {
  return {
    v: text, t: 's',
    s: {
      font: { bold: true, color: { rgb: XLSX_WHITE }, sz: 11 },
      fill: { fgColor: { rgb: 'FF8F00' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: XLSX_BORDER,
    },
  };
}

function xlCell(value: any, rowIdx: number, opts?: { bold?: boolean; color?: string; align?: string }): any {
  return {
    v: value ?? '-', t: typeof value === 'number' ? 'n' : 's',
    s: {
      font: { sz: 10, bold: opts?.bold, color: { rgb: opts?.color || '212121' } },
      fill: { fgColor: { rgb: rowIdx % 2 === 0 ? XLSX_GREY : XLSX_WHITE } },
      alignment: { horizontal: opts?.align || 'left', vertical: 'center' },
      border: XLSX_BORDER,
    },
  };
}

function xlNum(value: number, rowIdx: number, fmt?: string): any {
  return {
    v: value || 0, t: 'n',
    s: {
      font: { sz: 10, color: { rgb: '212121' } },
      fill: { fgColor: { rgb: rowIdx % 2 === 0 ? XLSX_GREY : XLSX_WHITE } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: fmt || '#,##0',
      border: XLSX_BORDER,
    },
  };
}

function xlPct(value: number, rowIdx: number): any {
  const color = value >= 90 ? '2E7D32' : value >= 75 ? '1565C0' : value >= 50 ? 'E65100' : 'C62828';
  const bg = value >= 90 ? XLSX_GREEN : value >= 50 ? XLSX_AMBER : XLSX_RED;
  return {
    v: `${value.toFixed(1)}%`, t: 's',
    s: {
      font: { sz: 10, bold: true, color: { rgb: color } },
      fill: { fgColor: { rgb: rowIdx % 2 === 0 ? bg : XLSX_WHITE } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: XLSX_BORDER,
    },
  };
}

function xlEmpty(): any {
  return { v: '', t: 's', s: { fill: { fgColor: { rgb: XLSX_WHITE } } } };
}

function exportTargetsToExcel(
  data: AgentPerformanceData[],
  monthLabel: string,
  year: number,
) {
  const wb = XLSXStyle.utils.book_new();
  const COLS = 10;

  // ── Sheet 1: Performance Summary ──────────────────────────────────
  const headers = ['Agent', 'Target Type', 'Visits', 'P. Orders', 'S. Orders', 'P. Revenue (₹)', 'S. Revenue (₹)', 'New Clients', 'Login Hrs', 'Rating'];
  const ws: any = {};
  const merges: any[] = [];
  let row = 0;

  // Title
  ws[XLSXStyle.utils.encode_cell({ r: row, c: 0 })] = xlTitle(`Targets & Performance — ${monthLabel} ${year}`);
  for (let c = 1; c < COLS; c++) ws[XLSXStyle.utils.encode_cell({ r: row, c })] = xlEmpty();
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } });
  row++;

  // Subtitle
  ws[XLSXStyle.utils.encode_cell({ r: row, c: 0 })] = {
    v: `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — ${data.length} agents`,
    t: 's', s: { font: { sz: 10, color: { rgb: '616161' }, italic: true }, fill: { fgColor: { rgb: XLSX_WHITE } } },
  };
  for (let c = 1; c < COLS; c++) ws[XLSXStyle.utils.encode_cell({ r: row, c })] = xlEmpty();
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } });
  row++;

  // Blank row
  for (let c = 0; c < COLS; c++) ws[XLSXStyle.utils.encode_cell({ r: row, c })] = xlEmpty();
  row++;

  // Header row
  headers.forEach((h, c) => { ws[XLSXStyle.utils.encode_cell({ r: row, c })] = xlHdr(h); });
  row++;

  // Data rows — each agent gets 3 sub-rows: Target, Actual, %
  data.forEach((agent, idx) => {
    const t = agent.targets;
    const a = agent.actuals;
    const p = agent.performance_percentages;
    const avgPerf = (p.visits + p.orders + p.stock_requests + p.revenue + p.stock_request_revenue + p.new_clients + p.login_hours) / 7;
    const ratingLabel = avgPerf >= 90 ? 'Top Performer' : avgPerf >= 75 ? 'Above Average' : avgPerf >= 50 ? 'Average' : 'Below Average';
    const tType = agent.target_type === 'agent_specific' ? 'Individual' : agent.target_type === 'global_monthly' ? 'Global' : 'Baseline';
    const ri = idx * 3;

    // Row: Target values
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 0 })] = xlCell(agent.agent_name, ri, { bold: true });
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 1 })] = xlCell(tType, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 2 })] = xlNum(t.visit_target, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 3 })] = xlNum(t.stock_request_target, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 4 })] = xlNum(t.order_target, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 5 })] = xlNum(Math.round(Number(t.stock_request_revenue_target)), ri, '#,##0');
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 6 })] = xlNum(Math.round(Number(t.revenue_target)), ri, '#,##0');
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 7 })] = xlNum(t.new_client_target, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 8 })] = xlCell(hoursToTimeString(Number(t.login_hours_target)), ri, { align: 'center' });
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 9 })] = xlPct(avgPerf, ri);
    row++;

    // Row: Actual values
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 0 })] = xlCell('  Actual', ri + 1, { color: '1565C0', bold: true });
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 1 })] = xlCell('', ri + 1);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 2 })] = xlNum(a.visits, ri + 1);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 3 })] = xlNum(a.stock_requests, ri + 1);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 4 })] = xlNum(a.orders, ri + 1);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 5 })] = xlNum(Math.round(Number(a.stock_request_revenue)), ri + 1, '#,##0');
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 6 })] = xlNum(Math.round(Number(a.revenue)), ri + 1, '#,##0');
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 7 })] = xlNum(a.new_clients, ri + 1);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 8 })] = xlCell(hoursToTimeString(Number(a.login_hours)), ri + 1, { align: 'center' });
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 9 })] = xlCell(ratingLabel, ri + 1, {
      bold: true,
      color: avgPerf >= 90 ? '2E7D32' : avgPerf >= 75 ? '1565C0' : avgPerf >= 50 ? 'E65100' : 'C62828',
      align: 'center',
    });
    row++;

    // Row: Achievement %
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 0 })] = xlCell('  Achievement %', ri, { color: '616161' });
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 1 })] = xlCell('', ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 2 })] = xlPct(p.visits, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 3 })] = xlPct(p.stock_requests, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 4 })] = xlPct(p.orders, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 5 })] = xlPct(p.stock_request_revenue, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 6 })] = xlPct(p.revenue, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 7 })] = xlPct(p.new_clients, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 8 })] = xlPct(p.login_hours, ri);
    ws[XLSXStyle.utils.encode_cell({ r: row, c: 9 })] = xlCell('', ri);
    row++;
  });

  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: COLS - 1 } });
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 13 }, { wch: 12 }, { wch: 16 }];
  ws['!rows'] = [{ hpx: 30 }, { hpx: 20 }, { hpx: 10 }, { hpx: 28 }, ...Array(row - 4).fill({ hpx: 20 })];

  XLSXStyle.utils.book_append_sheet(wb, ws, 'Performance Summary');

  // ── Sheet 2: City-wise Breakdown (only agents with city data) ─────
  const cityAgents = data.filter(a => (a.city_performance?.length ?? 0) > 0 || (a.targets?.city_targets?.length ?? 0) > 0);
  if (cityAgents.length > 0) {
    const cityHeaders = ['Agent', 'City', 'Metric', 'Target', 'Actual', 'Achievement'];
    const cws: any = {};
    const cMerges: any[] = [];
    let cr = 0;

    cws[XLSXStyle.utils.encode_cell({ r: cr, c: 0 })] = xlTitle(`City-wise Performance — ${monthLabel} ${year}`);
    for (let c = 1; c < 6; c++) cws[XLSXStyle.utils.encode_cell({ r: cr, c })] = xlEmpty();
    cMerges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
    cr++;

    for (let c = 0; c < 6; c++) cws[XLSXStyle.utils.encode_cell({ r: cr, c })] = xlEmpty();
    cr++;

    cityAgents.forEach((agent) => {
      // Agent sub-header
      for (let c = 0; c < 6; c++) cws[XLSXStyle.utils.encode_cell({ r: cr, c })] = xlSubHdr(c === 0 ? agent.agent_name : '');
      cMerges.push({ s: { r: cr, c: 0 }, e: { r: cr, c: 5 } });
      cr++;

      // Column headers
      cityHeaders.forEach((h, c) => { cws[XLSXStyle.utils.encode_cell({ r: cr, c })] = xlHdr(h); });
      cr++;

      const cities = agent.city_performance?.length ? agent.city_performance : (agent.targets?.city_targets || []).map((ct: any) => ({
        city: ct.city,
        targets: ct,
        actuals: { visits: 0, orders: 0, stock_requests: 0, revenue: 0, stock_request_revenue: 0, new_clients: 0 },
        performance_percentages: { visits: 0, orders: 0, stock_requests: 0, revenue: 0, stock_request_revenue: 0, new_clients: 0 },
      }));

      const metrics = [
        { label: 'Visits', tKey: 'visit_target', aKey: 'visits', pKey: 'visits' },
        { label: 'Primary Orders', tKey: 'stock_request_target', aKey: 'stock_requests', pKey: 'stock_requests' },
        { label: 'Secondary Orders', tKey: 'order_target', aKey: 'orders', pKey: 'orders' },
        { label: 'Primary Revenue', tKey: 'stock_request_revenue_target', aKey: 'stock_request_revenue', pKey: 'stock_request_revenue', isCurrency: true },
        { label: 'Secondary Revenue', tKey: 'revenue_target', aKey: 'revenue', pKey: 'revenue', isCurrency: true },
        { label: 'New Clients', tKey: 'new_client_target', aKey: 'new_clients', pKey: 'new_clients' },
      ];

      cities.forEach((cp: any, ci: number) => {
        metrics.forEach((m, mi) => {
          const ri = ci * metrics.length + mi;
          const tVal = Math.round(Number((cp.targets as any)?.[m.tKey] || 0));
          const aVal = Math.round(Number((cp.actuals as any)?.[m.aKey] || 0));
          const pVal = Number((cp.performance_percentages as any)?.[m.pKey] || 0);

          cws[XLSXStyle.utils.encode_cell({ r: cr, c: 0 })] = mi === 0 ? xlCell(agent.agent_name, ri, { bold: true }) : xlCell('', ri);
          cws[XLSXStyle.utils.encode_cell({ r: cr, c: 1 })] = mi === 0 ? xlCell(cp.city, ri, { bold: true, color: '1565C0' }) : xlCell('', ri);
          cws[XLSXStyle.utils.encode_cell({ r: cr, c: 2 })] = xlCell(m.label, ri);
          cws[XLSXStyle.utils.encode_cell({ r: cr, c: 3 })] = xlNum(tVal, ri, m.isCurrency ? '#,##0' : '#,##0');
          cws[XLSXStyle.utils.encode_cell({ r: cr, c: 4 })] = xlNum(aVal, ri, m.isCurrency ? '#,##0' : '#,##0');
          cws[XLSXStyle.utils.encode_cell({ r: cr, c: 5 })] = xlPct(pVal, ri);
          cr++;
        });
      });

      // Blank separator
      for (let c = 0; c < 6; c++) cws[XLSXStyle.utils.encode_cell({ r: cr, c })] = xlEmpty();
      cr++;
    });

    cws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: cr - 1, c: 5 } });
    cws['!merges'] = cMerges;
    cws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    cws['!rows'] = [{ hpx: 30 }, { hpx: 10 }, ...Array(cr - 2).fill({ hpx: 20 })];

    XLSXStyle.utils.book_append_sheet(wb, cws, 'City Breakdown');
  }

  XLSXStyle.writeFile(wb, `Targets_${monthLabel}_${year}.xlsx`);
}

// Helper: Convert decimal hours to HH:mm
const hoursToTimeString = (decimalHours: number) => {
  const h = Math.floor(decimalHours);
  const totalMinutes = Math.round((decimalHours - h) * 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Helper: Convert HH:mm:ss, HH:mm, or plain number to decimal hours
const timeStringToHours = (timeStr: any) => {
  if (typeof timeStr === 'number') return timeStr;
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 1) {
    const val = parseFloat(parts[0]);
    return isNaN(val) ? 0 : val;
  }
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return h + (m / 60) + (s / 3600);
};

export default function TargetsPage() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [performanceData, setPerformanceData] = useState<AgentPerformanceData[]>([]);

  // Modes
  const [showDefaults, setShowDefaults] = useState(false);
  const [editDefaultMode, setEditDefaultMode] = useState(false);

  // Targets State
  const [defaultTarget, setDefaultTarget] = useState<Target>({ ...EMPTY_TARGET });

  // Bulk assign modal
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  // Expanded rows for city targets
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const toggleRowExpand = (agentId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const MONTHS = [
    { value: 1, label: "January" }, { value: 2, label: "February" },
    { value: 3, label: "March" }, { value: 4, label: "April" },
    { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" },
    { value: 9, label: "September" }, { value: 10, label: "October" },
    { value: 11, label: "November" }, { value: 12, label: "December" },
  ];

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [managers, setManagers] = useState<any[]>([]);

  // Sorting State
  const [orderBy, setOrderBy] = useState<string>("agent_name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const isAdmin = user?.role === "admin" || user?.role === "it_admin";
  const isAdminOrManager = isAdmin || user?.role === "sales_manager";
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let currentUser = user;
      if (!currentUser) {
        currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      }

      // Fetch Managers if Admin
      if (currentUser?.role === "admin" || currentUser?.role === "it_admin") {
        try {
          const mgrRes: any = await apiClient.get("/auth/users/", { role: "sales_manager" });
          setManagers(mgrRes.results || mgrRes || []);
        } catch (e) {
          console.error("Failed to fetch managers", e);
        }
      }

      // Fetch System Fallback Targets
      let currentDefault: Target = { ...EMPTY_TARGET };
      try {
        const defRes: any = await apiClient.get("/t/field/targets/default/");
        const sanitized = {
          ...defRes,
          visit_target: Math.round(Number(defRes.visit_target) || 0),
          order_target: Math.round(Number(defRes.order_target) || 0),
          stock_request_target: Math.round(Number(defRes.stock_request_target) || 0),
          revenue_target: Math.round(Number(defRes.revenue_target) || 0),
          stock_request_revenue_target: Math.round(Number(defRes.stock_request_revenue_target) || 0),
          new_client_target: Math.round(Number(defRes.new_client_target) || 0),
          login_hours_target: Math.round(Number(defRes.login_hours_target) || 0),
          pincodes: defRes.pincodes || [],
        };
        setDefaultTarget(sanitized);
        currentDefault = sanitized;
      } catch (e) {
        console.log("No default target set yet");
      }

      // Fetch Agents and their Performance
      let agentsParams: any = { role: "sales_agent" };
      if (currentUser?.role === "sales_manager") {
        agentsParams.assigned_to = currentUser.id.toString();
      } else if (isAdmin && managerFilter !== 'all') {
        agentsParams.assigned_to = managerFilter.toString();
      }

      const agentsRes: any = await apiClient.get("/auth/users/", agentsParams);
      const agents = agentsRes.results || agentsRes || [];

      if (!Array.isArray(agents)) {
        setPerformanceData([]);
        return;
      }

      const perfPromises = agents.map(async (agent: any) => {
        try {
          const res: any = await apiClient.get("/t/field/targets/performance/", {
            agent: String(agent.id),
            month: String(month),
            year: String(year)
          });
          return {
            agent_id: agent.id,
            agent_name: agent.full_name || agent.username,
            ...res
          };
        } catch (e) {
          return {
            agent_id: agent.id,
            agent_name: agent.full_name || agent.username,
            target_type: "none",
            targets: currentDefault,
            actuals: { visits: 0, orders: 0, stock_requests: 0, revenue: 0, stock_request_revenue: 0, new_clients: 0, login_hours: 0 },
            performance_percentages: { visits: 0, orders: 0, stock_requests: 0, revenue: 0, stock_request_revenue: 0, new_clients: 0, login_hours: 0 }
          };
        }
      });

      const perfResults = await Promise.all(perfPromises);
      setPerformanceData(perfResults as AgentPerformanceData[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, year, user, managerFilter, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData, managerFilter]);

  const handleSaveDefault = async () => {
    try {
      setSavingDefault(true);
      const loginHrs = typeof defaultTarget.login_hours_target === 'string'
        ? timeStringToHours(defaultTarget.login_hours_target)
        : defaultTarget.login_hours_target;
      const finalPayload = {
        ...defaultTarget,
        visit_target: Math.round(Number(defaultTarget.visit_target) || 0),
        order_target: Math.round(Number(defaultTarget.order_target) || 0),
        stock_request_target: Math.round(Number(defaultTarget.stock_request_target) || 0),
        revenue_target: Math.round(Number(defaultTarget.revenue_target) || 0),
        stock_request_revenue_target: Math.round(Number(defaultTarget.stock_request_revenue_target) || 0),
        new_client_target: Math.round(Number(defaultTarget.new_client_target) || 0),
        login_hours_target: Math.round(Number(loginHrs) || 0),
      };
      const res: any = await apiClient.post("/t/field/targets/default/", finalPayload);
      setDefaultTarget({
        ...res,
        visit_target: Math.round(Number(res.visit_target) || 0),
        order_target: Math.round(Number(res.order_target) || 0),
        stock_request_target: Math.round(Number(res.stock_request_target) || 0),
        revenue_target: Math.round(Number(res.revenue_target) || 0),
        stock_request_revenue_target: Math.round(Number(res.stock_request_revenue_target) || 0),
        new_client_target: Math.round(Number(res.new_client_target) || 0),
        login_hours_target: Math.round(Number(res.login_hours_target) || 0),
        pincodes: res.pincodes || [],
      });
      setEditDefaultMode(false);
      setSuccessMsg("Fallback limits updated!");
      fetchData();
    } catch (e: any) {
      setError("Failed to save default targets");
    } finally {
      setSavingDefault(false);
    }
  };

  const currentMonthLabel = MONTHS.find(m => m.value === month)?.label;

  const renderProgressBar = (percentage: number, color: string = "primary") => {
    const isOverTarget = percentage > 100;
    return (
      <Box sx={{ width: "100%", mt: 0.5 }}>
        <Stack direction="row" justifyContent="space-between" mb={0.5}>
          <Typography variant="caption" fontWeight={900} color={isOverTarget ? "success.main" : `${color}.main`} sx={{ fontSize: '0.7rem' }}>
            {percentage.toFixed(0)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(percentage, 100)}
          color={color as any}
          sx={{
            height: 6,
            borderRadius: 1,
            bgcolor: alpha((theme.palette as any)[color].main, 0.1),
            "& .MuiLinearProgress-bar": {
              borderRadius: 1,
              bgcolor: isOverTarget ? theme.palette.success.main : undefined
            }
          }}
        />
      </Box>
    );
  };

  const getAvgPerf = (perf: AgentPerformanceData["performance_percentages"]) => {
    return (perf.visits + perf.orders + perf.stock_requests + perf.revenue + perf.stock_request_revenue + perf.new_clients + perf.login_hours) / 7;
  };

  const getRating = (avgPerf: number) => {
    if (avgPerf >= 90) return { label: "Top Performer", color: "success" as const, key: "top" };
    if (avgPerf >= 75) return { label: "Above Average", color: "primary" as const, key: "above" };
    if (avgPerf >= 50) return { label: "Average", color: "warning" as const, key: "average" };
    return { label: "Below Average", color: "error" as const, key: "below" };
  };

  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const filteredAndSortedData = performanceData
    .filter(agent => {
      const matchesSearch = agent.agent_name.toLowerCase().includes(searchTerm.toLowerCase());
      const avgPerf = getAvgPerf(agent.performance_percentages);
      const rating = getRating(avgPerf);
      const matchesStatus = statusFilter === "all" || rating.key === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let valA: any, valB: any;
      if (orderBy === "agent_name") { valA = a.agent_name; valB = b.agent_name; }
      else if (orderBy === "visits") { valA = a.performance_percentages.visits; valB = b.performance_percentages.visits; }
      else if (orderBy === "orders") { valA = a.performance_percentages.orders; valB = b.performance_percentages.orders; }
      else if (orderBy === "stock_requests") { valA = a.performance_percentages.stock_requests; valB = b.performance_percentages.stock_requests; }
      else if (orderBy === "revenue") { valA = a.performance_percentages.revenue; valB = b.performance_percentages.revenue; }
      else if (orderBy === "stock_request_revenue") { valA = a.performance_percentages.stock_request_revenue; valB = b.performance_percentages.stock_request_revenue; }
      else if (orderBy === "clients") { valA = a.performance_percentages.new_clients; valB = b.performance_percentages.new_clients; }
      else if (orderBy === "login") { valA = a.performance_percentages.login_hours; valB = b.performance_percentages.login_hours; }
      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });


  // Integer-only change handler for target fields
  const handleDefaultFieldChange = (field: string, value: string, max: number) => {
    if (field === "login_hours_target") {
      // Allow time string input (HH:mm)
      setDefaultTarget({ ...defaultTarget, login_hours_target: value as any });
      return;
    }
    const intVal = parseInt(value, 10);
    if (value === "" || value === "0") {
      setDefaultTarget({ ...defaultTarget, [field]: 0 });
      return;
    }
    if (isNaN(intVal) || intVal < 0) return;
    if (intVal > max) return;
    setDefaultTarget({ ...defaultTarget, [field]: intVal });
  };

  // Default fields config (row 1: 4 items, row 2: 3 items)
  const defaultFields = [
    { label: "Visits", field: "visit_target", value: defaultTarget.visit_target, max: 999 },
    { label: "Primary Orders", field: "stock_request_target", value: defaultTarget.stock_request_target, max: 999 },
    { label: "Secondary Orders", field: "order_target", value: defaultTarget.order_target, max: 999 },
    { label: "Primary Revenue", field: "stock_request_revenue_target", value: defaultTarget.stock_request_revenue_target, prefix: "₹", max: 9999999 },
    { label: "Secondary Revenue", field: "revenue_target", value: defaultTarget.revenue_target, prefix: "₹", max: 9999999 },
    { label: "New Clients", field: "new_client_target", value: defaultTarget.new_client_target, max: 999 },
    { label: "Log Time", field: "login_hours_target", value: defaultTarget.login_hours_target, isTime: true, max: 999 },
  ];

  // Metric card config (row 1: 4 cards, row 2: 3 cards)
  const metricCards = [
    { label: "Visits", field: "visit_target", color: "primary", icon: <EventAvailableIcon sx={{ fontSize: 20 }} /> },
    { label: "Primary Orders", field: "stock_request_target", color: "info", icon: <InventoryIcon sx={{ fontSize: 20 }} /> },
    { label: "Secondary Orders", field: "order_target", color: "success", icon: <ShoppingBagIcon sx={{ fontSize: 20 }} /> },
    { label: "Primary Revenue", field: "stock_request_revenue_target", color: "error", icon: <MonetizationOnIcon sx={{ fontSize: 20 }} />, prefix: "₹" },
    { label: "Secondary Revenue", field: "revenue_target", color: "warning", icon: <MonetizationOnIcon sx={{ fontSize: 20 }} />, prefix: "₹" },
    { label: "New Clients", field: "new_client_target", color: "secondary", icon: <PersonAddIcon sx={{ fontSize: 20 }} /> },
    { label: "Login Hours", field: "login_hours_target", color: "primary", icon: <AccessTimeIcon sx={{ fontSize: 20 }} />, isTime: true },
  ];

  // Performance table metric columns
  const perfColumns = [
    { key: "visits", label: "VISITS", sortKey: "visits", color: "primary", actualKey: "visits", targetKey: "visit_target" },
    { key: "stock_requests", label: "P. ORDERS", sortKey: "stock_requests", color: "info", actualKey: "stock_requests", targetKey: "stock_request_target" },
    { key: "orders", label: "S. ORDERS", sortKey: "orders", color: "success", actualKey: "orders", targetKey: "order_target" },
    { key: "stock_request_revenue", label: "P. REVENUE", sortKey: "stock_request_revenue", color: "error", actualKey: "stock_request_revenue", targetKey: "stock_request_revenue_target", isCurrency: true },
    { key: "revenue", label: "S. REVENUE", sortKey: "revenue", color: "warning", actualKey: "revenue", targetKey: "revenue_target", isCurrency: true },
    { key: "new_clients", label: "CLIENTS", sortKey: "clients", color: "secondary", actualKey: "new_clients", targetKey: "new_client_target" },
    { key: "login_hours", label: "LOGIN HRS", sortKey: "login", color: "primary", actualKey: "login_hours", targetKey: "login_hours_target", isTime: true },
  ];

  const formatActual = (col: typeof perfColumns[0], val: number) => {
    if (col.isTime) return hoursToTimeString(val);
    if (col.isCurrency) return `₹${Math.round(val).toLocaleString()}`;
    return String(Math.round(val));
  };

  return (
    <>
      <Box sx={{ px: { xs: 2, md: 3, lg: 4 }, pt: { xs: 1, md: 1.5 }, pb: { xs: 2, md: 3, lg: 4 }, width: "100%", maxWidth: 1600, mx: "auto" }}>
        {/* HEADER */}
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "flex-end" }} sx={{ mb: 3, px: 1 }}>
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: "-0.02em", color: "text.primary", mb: 0.5 }}>
              Targets & Goals
            </Typography>
            <Typography variant="body1" color="text.secondary" fontWeight={500}>
              Monitor performance metrics and manage sales objectives.
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1}>
            <Paper
              elevation={0}
              sx={{
                p: 0.5,
                display: 'flex',
                alignItems: 'center',
                borderRadius: '12px',
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: "background.paper",
                boxShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.05)}`
              }}
            >
              <IconButton size="medium" onClick={() => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }}>
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="subtitle1" fontWeight={800} sx={{ px: 3, minWidth: 180, textAlign: 'center', textTransform: "uppercase", letterSpacing: 1 }}>
                {currentMonthLabel} {year}
              </Typography>
              <IconButton size="medium" onClick={() => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }}>
                <ChevronRightIcon />
              </IconButton>
            </Paper>

            {isAdminOrManager && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setBulkAssignOpen(true)}
                startIcon={<TrendingUpIcon />}
                sx={{ borderRadius: "12px", height: 48, fontWeight: 800, px: 3 }}
              >
                Set Targets
              </Button>
            )}

            <Button
              variant="outlined"
              onClick={() => exportTargetsToExcel(filteredAndSortedData, currentMonthLabel || '', year)}
              disabled={loading || filteredAndSortedData.length === 0}
              startIcon={<FileDownloadIcon />}
              sx={{ borderRadius: "12px", height: 48, fontWeight: 800, px: 3 }}
            >
              Export
            </Button>

            {isAdmin && (
              <Button
                variant={editDefaultMode ? "contained" : "outlined"}
                color="secondary"
                onClick={() => {
                  if (editDefaultMode) {
                    setEditDefaultMode(false);
                    setShowDefaults(false);
                  } else {
                    setShowDefaults(true);
                    setEditDefaultMode(true);
                  }
                }}
                startIcon={editDefaultMode ? <CancelIcon /> : <TuneIcon />}
                sx={{ borderRadius: "12px", height: 48, fontWeight: 800, px: 3 }}
              >
                {editDefaultMode ? "Close Editor" : "Edit Baseline"}
              </Button>
            )}
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5 }}>{error}</Alert>}

        {/* FALLBACK DEFAULTS (ADMIN) — edit mode shown inline on metric cards */}
        <AnimatePresence>
          {showDefaults && isAdmin && editDefaultMode && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
              <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2, border: `1px solid ${theme.palette.secondary.main}`, bgcolor: alpha(theme.palette.secondary.main, 0.02) }} elevation={0}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2" fontWeight={900} sx={{ letterSpacing: 0.5 }}>EDIT SYSTEM BASELINE</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="text" color="error" onClick={() => setEditDefaultMode(false)} sx={{ fontWeight: 700 }}>Cancel</Button>
                    <Button size="small" variant="contained" color="secondary" startIcon={<SaveIcon sx={{ fontSize: 14 }} />} onClick={handleSaveDefault} disabled={savingDefault} sx={{ fontWeight: 800 }}>Save</Button>
                  </Stack>
                </Stack>

                {/* Row 1: 4 fields */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {defaultFields.slice(0, 4).map((item, idx) => (
                    <Grid size={{ xs: 6, sm: 3 }} key={idx}>
                      <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", display: "block", mb: 0.5, fontSize: "0.65rem", letterSpacing: 0.5 }}>{item.label}</Typography>
                      <TextField
                        fullWidth size="small" variant="outlined"
                        placeholder={item.isTime ? "HH:mm" : "0"}
                        slotProps={{
                          input: {
                            startAdornment: item.prefix ? (
                              <InputAdornment position="start"><Typography variant="caption" fontWeight={900} color="primary">{item.prefix}</Typography></InputAdornment>
                            ) : null,
                            sx: { borderRadius: 1.5, bgcolor: alpha(theme.palette.background.default, 0.5), fontWeight: 800 }
                          }
                        }}
                        value={item.isTime ? (typeof defaultTarget.login_hours_target === 'string' ? defaultTarget.login_hours_target : hoursToTimeString(defaultTarget.login_hours_target)) : Math.round(Number(defaultTarget[item.field as keyof Target] || 0)) || ""}
                        onChange={(e) => handleDefaultFieldChange(item.field, e.target.value, item.max)}
                      />
                    </Grid>
                  ))}
                </Grid>
                {/* Row 2: 3 fields */}
                <Grid container spacing={2}>
                  {defaultFields.slice(4).map((item, idx) => (
                    <Grid size={{ xs: 6, sm: 4 }} key={idx}>
                      <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", display: "block", mb: 0.5, fontSize: "0.65rem", letterSpacing: 0.5 }}>{item.label}</Typography>
                      <TextField
                        fullWidth size="small" variant="outlined"
                        placeholder={item.isTime ? "HH:mm" : "0"}
                        slotProps={{
                          input: {
                            startAdornment: item.prefix ? (
                              <InputAdornment position="start"><Typography variant="caption" fontWeight={900} color="primary">{item.prefix}</Typography></InputAdornment>
                            ) : null,
                            sx: { borderRadius: 1.5, bgcolor: alpha(theme.palette.background.default, 0.5), fontWeight: 800 }
                          }
                        }}
                        value={item.isTime ? (typeof defaultTarget.login_hours_target === 'string' ? defaultTarget.login_hours_target : hoursToTimeString(defaultTarget.login_hours_target)) : Math.round(Number(defaultTarget[item.field as keyof Target] || 0)) || ""}
                        onChange={(e) => handleDefaultFieldChange(item.field, e.target.value, item.max)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>

        {/* METRIC OVERVIEW CARDS — Row 1: 4 cards, Row 2: 3 cards (equal width) */}
        <Box sx={{ mb: 3 }}>
          {/* Row 1 */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {metricCards.slice(0, 4).map((item, idx) => {
              const displayValue = Number((defaultTarget as any)[item.field] || 0);
              return (
                <Grid size={{ xs: 6, sm: 3 }} key={idx}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2, height: '100%', borderRadius: '14px', bgcolor: 'background.paper',
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      transition: "all 0.25s ease",
                      "&:hover": {
                        transform: "translateY(-3px)",
                        boxShadow: `0 6px 14px ${alpha(theme.palette.common.black, 0.04)}`,
                        borderColor: alpha((theme.palette as any)[item.color].main, 0.3),
                      }
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" mb={1.2}>
                      <Box sx={{
                        width: 34, height: 34, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha((theme.palette as any)[item.color].main, 0.1), color: `${item.color}.main`
                      }}>
                        {item.icon}
                      </Box>
                      <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8, fontSize: '0.65rem' }}>
                        {item.label}
                      </Typography>
                    </Stack>
                    <Typography variant="h5" fontWeight={900} color="text.primary" sx={{ lineHeight: 1.2 }}>
                      {item.isTime ? hoursToTimeString(displayValue) : `${item.prefix || ""}${Math.round(displayValue).toLocaleString()}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.68rem' }}>baseline target</Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          {/* Row 2 */}
          <Grid container spacing={2}>
            {metricCards.slice(4).map((item, idx) => {
              const displayValue = Number((defaultTarget as any)[item.field] || 0);
              return (
                <Grid size={{ xs: 6, sm: 4 }} key={idx}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2, height: '100%', borderRadius: '14px', bgcolor: 'background.paper',
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      transition: "all 0.25s ease",
                      "&:hover": {
                        transform: "translateY(-3px)",
                        boxShadow: `0 6px 14px ${alpha(theme.palette.common.black, 0.04)}`,
                        borderColor: alpha((theme.palette as any)[item.color].main, 0.3),
                      }
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" mb={1.2}>
                      <Box sx={{
                        width: 34, height: 34, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha((theme.palette as any)[item.color].main, 0.1), color: `${item.color}.main`
                      }}>
                        {item.icon}
                      </Box>
                      <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8, fontSize: '0.65rem' }}>
                        {item.label}
                      </Typography>
                    </Stack>
                    <Typography variant="h5" fontWeight={900} color="text.primary" sx={{ lineHeight: 1.2 }}>
                      {item.isTime ? hoursToTimeString(displayValue) : `${item.prefix || ""}${Math.round(displayValue).toLocaleString()}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.68rem' }}>baseline target</Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        {/* FILTERS BAR */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5, px: 3, mb: 3,
            borderRadius: { xs: '16px', sm: '50px' },
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center',
            bgcolor: 'background.paper',
            boxShadow: `0 4px 15px ${alpha(theme.palette.common.black, 0.04)}`
          }}
        >
          <TextField
            size="small" placeholder="Search Agent Name..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 260 }, flex: 1 }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment>,
                sx: { borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4), '& fieldset': { borderColor: alpha(theme.palette.divider, 0.1) } }
              }
            }}
          />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Month</InputLabel>
            <Select value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}
              sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4), '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.1) } }}>
              {MONTHS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Rating</InputLabel>
            <Select value={statusFilter} label="Rating" onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4), '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.1) } }}>
              <MenuItem value="all">All Ratings</MenuItem>
              <MenuItem value="top">Top Performer</MenuItem>
              <MenuItem value="above">Above Average</MenuItem>
              <MenuItem value="average">Average</MenuItem>
              <MenuItem value="below">Below Average</MenuItem>
            </Select>
          </FormControl>

          {isAdmin && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Manager</InputLabel>
              <Select value={managerFilter} label="Manager" onChange={(e) => setManagerFilter(e.target.value)}
                sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4), '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.1) } }}>
                <MenuItem value="all">All Managers</MenuItem>
                {managers.map(mgr => <MenuItem key={mgr.id} value={mgr.id}>{mgr.full_name || mgr.username}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {(searchTerm !== "" || statusFilter !== "all" || managerFilter !== "all") && (
            <Tooltip title="Reset all filters" arrow>
              <IconButton color="error" size="small"
                onClick={() => { setSearchTerm(""); setStatusFilter("all"); setManagerFilter("all"); setOrderBy("agent_name"); setOrder("asc"); }}
                sx={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${alpha(theme.palette.error.main, 0.2)}`, bgcolor: alpha(theme.palette.error.main, 0.05), "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.1), border: `2px solid ${theme.palette.error.main}` } }}>
                <FilterAltOffIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Paper>

        {/* MOBILE CARD VIEW */}
        {isMobile && (
          <>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={40} thickness={4} />
              </Box>
            ) : filteredAndSortedData.length === 0 ? (
              <Paper elevation={0} sx={{ p: 4, borderRadius: '20px', textAlign: 'center', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Typography variant="body1" color="text.secondary" fontWeight={600}>No agents found for this period</Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {filteredAndSortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((agent) => {
                  const avgPerf = getAvgPerf(agent.performance_percentages);
                  const rating = getRating(avgPerf);
                  const metrics = perfColumns.map(col => ({
                    label: col.label,
                    pct: (agent.performance_percentages as any)[col.key],
                    color: col.color,
                    actual: formatActual(col, (agent.actuals as any)[col.actualKey]),
                    target: col.isTime ? hoursToTimeString((agent.targets as any)[col.targetKey]) : col.isCurrency ? `₹${Math.round(Number((agent.targets as any)[col.targetKey])).toLocaleString()}` : String(Math.round(Number((agent.targets as any)[col.targetKey]))),
                  }));

                  return (
                    <Paper key={agent.agent_id} elevation={0} component={motion.div} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      sx={{
                        borderRadius: '20px', border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, overflow: 'hidden',
                        boxShadow: `0 2px 12px ${alpha(theme.palette.common.black, 0.04)}`,
                      }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center"
                        sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`, bgcolor: alpha((theme.palette as any)[rating.color].main, 0.02) }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ width: 40, height: 40, bgcolor: alpha((theme.palette as any)[rating.color].main, 0.12), color: `${rating.color}.main`, fontWeight: 900, fontSize: '1rem' }}>
                            {agent.agent_name[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={900} sx={{ lineHeight: 1.2, fontSize: '0.95rem' }}>{agent.agent_name}</Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
                              {agent.target_type === "agent_specific" ? "Individual Target" : agent.target_type === "global_monthly" ? "Global Target" : agent.target_type === "default" ? "Baseline" : "No Target"}
                            </Typography>
                          </Box>
                        </Stack>
                        <Chip label={rating.label} size="small" color={rating.color}
                          sx={{ fontWeight: 900, height: 24, fontSize: '0.62rem', borderRadius: '6px', textTransform: 'uppercase' }} />
                      </Stack>

                      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                        {metrics.map((m, i) => (
                          <Box key={i} sx={{ mb: i < metrics.length - 1 ? 1.5 : 0 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.4}>
                              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 0.5 }}>{m.label}</Typography>
                              <Typography variant="caption" fontWeight={900} color={`${m.color}.main`} sx={{ fontSize: '0.72rem' }}>{m.actual} / {m.target}</Typography>
                            </Stack>
                            {renderProgressBar(m.pct, m.color)}
                          </Box>
                        ))}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5} pt={1.5} sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                          <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>Overall Average</Typography>
                          <Typography variant="caption" fontWeight={900} color={`${rating.color}.main`} sx={{ fontSize: '0.8rem' }}>{avgPerf.toFixed(0)}%</Typography>
                        </Stack>

                        {/* City performance in mobile */}
                        {(agent.city_performance?.length ?? 0) > 0 && (
                          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" mb={1}>
                              <LocationCityIcon sx={{ fontSize: 14, color: "primary.main" }} />
                              <Typography variant="caption" fontWeight={800} color="primary.main" sx={{ textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: 0.5 }}>
                                City-wise Performance
                              </Typography>
                            </Stack>
                            {agent.city_performance!.map((cp: any) => (
                              <Box key={cp.city} sx={{ mb: 1, p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                                <Typography variant="caption" fontWeight={800} color="primary.main" sx={{ fontSize: "0.7rem", mb: 0.5, display: "block" }}>{cp.city}</Typography>
                                {perfColumns.filter(c => !c.isTime).map(col => {
                                  const actual = (cp.actuals as any)?.[col.actualKey] ?? 0;
                                  const targetVal = (cp.targets as any)?.[col.targetKey] ?? 0;
                                  const pctVal = (cp.performance_percentages as any)?.[col.key] ?? 0;
                                  return (
                                    <Box key={col.key} sx={{ mb: 0.8 }}>
                                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.2}>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: "0.6rem", textTransform: "uppercase" }}>{col.label}</Typography>
                                        <Typography variant="caption" fontWeight={900} sx={{ fontSize: "0.65rem" }}>
                                          {col.isCurrency ? `₹${Math.round(Number(actual)).toLocaleString()}` : Math.round(Number(actual))} / {col.isCurrency ? `₹${Math.round(Number(targetVal)).toLocaleString()}` : Math.round(Number(targetVal))}
                                        </Typography>
                                      </Stack>
                                      {renderProgressBar(pctVal, col.color)}
                                    </Box>
                                  );
                                })}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            )}
            {!loading && filteredAndSortedData.length > 0 && (
              <Paper elevation={0} sx={{ mt: 2, borderRadius: '16px', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]} component="div"
                  count={filteredAndSortedData.length} rowsPerPage={rowsPerPage} page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                  sx={{ "& .MuiTablePagination-toolbar": { py: 1 }, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontWeight: 700, fontSize: '0.75rem' } }}
                />
              </Paper>
            )}
          </>
        )}

        {/* DESKTOP TABLE VIEW */}
        {!isMobile && (
          <Paper elevation={0} sx={{ borderRadius: '24px', border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, overflow: "hidden", boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.03)}` }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 1200 }}>
                <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.005) }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900, py: 3, pl: 4, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: 1 }}>
                      <TableSortLabel active={orderBy === "agent_name"} direction={orderBy === "agent_name" ? order : "asc"} onClick={() => handleSort("agent_name")}>AGENT</TableSortLabel>
                    </TableCell>
                    {perfColumns.map(col => (
                      <TableCell key={col.key} sx={{ fontWeight: 900, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: 1, minWidth: 130 }}>
                        <TableSortLabel active={orderBy === col.sortKey} direction={orderBy === col.sortKey ? order : "asc"} onClick={() => handleSort(col.sortKey)}>
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 900, pr: 4, color: 'text.secondary', fontSize: '0.8rem', letterSpacing: 1 }}>RATING</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={perfColumns.length + 2} align="center" sx={{ py: 10 }}><CircularProgress size={40} thickness={4} /></TableCell></TableRow>
                  ) : filteredAndSortedData.length === 0 ? (
                    <TableRow><TableCell colSpan={perfColumns.length + 2} align="center" sx={{ py: 10 }}>
                      <Typography variant="body1" color="text.secondary" fontWeight={600}>No agents found for this period</Typography>
                    </TableCell></TableRow>
                  ) : (
                    filteredAndSortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((agent) => {
                      const avgPerf = getAvgPerf(agent.performance_percentages);
                      const rating = getRating(avgPerf);
                      const cityCount = agent.targets?.city_targets?.length ?? agent.city_performance?.length ?? 0;
                      const hasCityData = cityCount > 0;
                      const isExpanded = expandedRows.has(agent.agent_id);
                      return (
                        <React.Fragment key={agent.agent_id}>
                          <TableRow hover
                            sx={{
                              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                              "& .MuiTableCell-root": { py: 2, borderBottom: isExpanded ? 'none' : undefined },
                              cursor: hasCityData ? "pointer" : "default",
                            }}
                            onClick={() => hasCityData && toggleRowExpand(agent.agent_id)}>
                            <TableCell sx={{ pl: 4 }}>
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                {hasCityData && (
                                  <IconButton size="small" sx={{ p: 0.3 }}
                                    onClick={(e) => { e.stopPropagation(); toggleRowExpand(agent.agent_id); }}>
                                    {isExpanded ? <KeyboardArrowUpIcon sx={{ fontSize: 20 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
                                  </IconButton>
                                )}
                                <Avatar sx={{ width: 40, height: 40, bgcolor: alpha((theme.palette as any)[rating.color].main, 0.1), color: `${rating.color}.main`, fontWeight: 900, fontSize: "0.9rem" }}>
                                  {agent.agent_name[0]}
                                </Avatar>
                                <Box sx={{ minWidth: 140 }}>
                                  <Typography variant="subtitle2" fontWeight={900} sx={{ lineHeight: 1.2 }}>{agent.agent_name}</Typography>
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', fontWeight: 700 }}>
                                      {agent.target_type === "agent_specific" ? "Individual" : agent.target_type === "global_monthly" ? "Global" : "Baseline"}
                                    </Typography>
                                    {hasCityData && (
                                      <Chip
                                        icon={<LocationCityIcon sx={{ fontSize: 12 }} />}
                                        label={`${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800, borderRadius: '4px', '& .MuiChip-icon': { ml: 0.3 } }}
                                      />
                                    )}
                                  </Stack>
                                </Box>
                              </Stack>
                            </TableCell>
                            {perfColumns.map(col => (
                              <TableCell key={col.key} sx={{ minWidth: 130 }}>
                                <Typography variant="caption" fontWeight={900} color="text.primary" sx={{ mb: 0.5, display: "block", fontSize: "0.78rem" }}>
                                  {formatActual(col, (agent.actuals as any)[col.actualKey])} / {col.isTime ? hoursToTimeString((agent.targets as any)[col.targetKey]) : col.isCurrency ? `₹${Math.round(Number((agent.targets as any)[col.targetKey])).toLocaleString()}` : Math.round(Number((agent.targets as any)[col.targetKey]))}
                                </Typography>
                                {renderProgressBar((agent.performance_percentages as any)[col.key], col.color)}
                              </TableCell>
                            ))}
                            <TableCell align="right" sx={{ pr: 4 }}>
                              <Tooltip title={`Overall: ${avgPerf.toFixed(1)}%`} arrow>
                                <Chip label={rating.label} size="small" color={rating.color}
                                  sx={{ fontWeight: 900, height: 28, fontSize: '0.68rem', borderRadius: '6px', textTransform: 'uppercase', px: 1 }} />
                              </Tooltip>
                            </TableCell>
                          </TableRow>

                          {/* City Performance Expandable Row */}
                          {hasCityData && isExpanded && (
                            <TableRow>
                              <TableCell colSpan={perfColumns.length + 2} sx={{ py: 0, px: 4, bgcolor: alpha(theme.palette.primary.main, 0.015) }}>
                                <Box sx={{ py: 2 }}>
                                  <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                                    <LocationCityIcon sx={{ fontSize: 16, color: "primary.main" }} />
                                    <Typography variant="caption" fontWeight={800} color="primary.main" sx={{ textTransform: "uppercase", letterSpacing: 1, fontSize: "0.65rem" }}>
                                      City-wise Performance
                                    </Typography>
                                  </Stack>
                                  <Table size="small" sx={{ "& .MuiTableCell-root": { py: 1.2, px: 1.5, border: "none" } }}>
                                    <TableHead>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 800, fontSize: "0.68rem", color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>City</TableCell>
                                        {perfColumns.filter(c => !c.isTime).map(col => (
                                          <TableCell key={col.key} sx={{ fontWeight: 800, fontSize: "0.68rem", color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                            {col.label}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {(agent.city_performance ?? []).map((cp: any) => (
                                        <TableRow key={cp.city} sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
                                          <TableCell>
                                            <Chip label={cp.city} size="small" color="primary" variant="outlined" sx={{ fontWeight: 800, borderRadius: "6px", fontSize: "0.72rem" }} />
                                          </TableCell>
                                          {perfColumns.filter(c => !c.isTime).map(col => {
                                            const actual = (cp.actuals as any)?.[col.actualKey] ?? 0;
                                            const targetVal = (cp.targets as any)?.[col.targetKey] ?? 0;
                                            const pctVal = (cp.performance_percentages as any)?.[col.key] ?? 0;
                                            return (
                                              <TableCell key={col.key} sx={{ minWidth: 110 }}>
                                                <Typography variant="caption" fontWeight={900} color="text.primary" sx={{ mb: 0.3, display: "block", fontSize: "0.72rem" }}>
                                                  {col.isCurrency ? `₹${Math.round(Number(actual)).toLocaleString()}` : Math.round(Number(actual))} / {col.isCurrency ? `₹${Math.round(Number(targetVal)).toLocaleString()}` : Math.round(Number(targetVal))}
                                                </Typography>
                                                {renderProgressBar(pctVal, col.color)}
                                              </TableCell>
                                            );
                                          })}
                                        </TableRow>
                                      ))}
                                      {/* Fallback: show targets only if no city_performance data yet */}
                                      {(!agent.city_performance || agent.city_performance.length === 0) && agent.targets.city_targets!.map((ct: any) => (
                                        <TableRow key={ct.city} sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
                                          <TableCell>
                                            <Chip label={ct.city} size="small" color="primary" variant="outlined" sx={{ fontWeight: 800, borderRadius: "6px", fontSize: "0.72rem" }} />
                                          </TableCell>
                                          {perfColumns.filter(c => !c.isTime).map(col => (
                                            <TableCell key={col.key}>
                                              <Typography variant="caption" fontWeight={800} sx={{ fontSize: "0.72rem" }}>
                                                0 / {col.isCurrency ? `₹${Math.round(Number(ct[col.targetKey] || 0)).toLocaleString()}` : Math.round(Number(ct[col.targetKey] || 0))}
                                              </Typography>
                                              {renderProgressBar(0, col.color)}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]} component="div"
              count={filteredAndSortedData.length} rowsPerPage={rowsPerPage} page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              sx={{
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                "& .MuiTablePagination-toolbar": { py: 1 },
                "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }
              }}
            />
          </Paper>
        )}
      </Box>

      {/* BULK ASSIGN MODAL */}
      <BulkAssignModal
        open={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        preSelectedAgentIds={[]}
        month={month}
        year={year}
        currentUser={user}
        onSuccess={() => {
          fetchData();
        }}
      />

      <Snackbar open={!!successMsg} autoHideDuration={3000} onClose={() => setSuccessMsg("")} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert variant="filled" severity="success" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: '0.75rem' }}>{successMsg}</Alert>
      </Snackbar>
    </>
  );
}

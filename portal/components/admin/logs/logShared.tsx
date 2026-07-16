"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Table,
  TableContainer,
  TablePagination,
  CircularProgress,
  useTheme,
  alpha,
} from "@mui/material";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

// --------------------------------------------------------------------------- //
// Shared types + display helpers used across every Logs tab.
// --------------------------------------------------------------------------- //
export interface Paginated<T> {
  count: number;
  results: T[];
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  warehouse_manager: "Warehouse Manager",
  production_manager: "Production Manager",
  purchase_manager: "Purchase Manager",
  accounts_officer: "Accounts Officer",
  distributor: "Distributor",
  mdo: "MDO",
  quality_manager: "Quality Manager",
};

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Avatar + name (+ optional subtitle) cell used in every tab's User column. */
export function UserCell({ name, subtitle }: { name?: string | null; subtitle?: string | null }) {
  const theme = useTheme();
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: theme.palette.primary.main,
          bgcolor: alpha(theme.palette.primary.main, 0.1),
        }}
      >
        {initials(name)}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {name || "Unknown"}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

/** Debounce a fast-changing value (search boxes) so we don't fetch per keystroke. */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Fetch + paginate a paginated admin-log endpoint. `filters` should be a
 * memoised object of query params (empty values are dropped). Changing the
 * filters resets to the first page.
 */
export function useLogData<T>(endpoint: string, filters: Record<string, string>) {
  const [rows, setRows] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const filterKey = JSON.stringify(filters);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(0);
  }, [filterKey]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: String(page + 1),
        page_size: String(rowsPerPage),
        ...filters,
      };
      Object.keys(params).forEach((k) => {
        if (params[k] === "" || params[k] === undefined || params[k] === null) delete params[k];
      });
      const data = await apiClient.get<Paginated<T>>(endpoint, params);
      setRows(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      console.error(`Failed to load ${endpoint}:`, err);
      toast.error("Failed to load logs");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
    // filterKey captures `filters`; endpoint/page/rowsPerPage are explicit deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, rowsPerPage, filterKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { rows, count, loading, page, setPage, rowsPerPage, setRowsPerPage, refetch: fetchData };
}

/**
 * The table card shared by every tab: handles the loading spinner, empty state,
 * the bordered Paper, and the pagination footer. `children` is the <Table>.
 */
export function LogCard({
  loading,
  isEmpty,
  emptyText,
  testId,
  children,
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  EmptyIcon,
}: {
  loading: boolean;
  isEmpty: boolean;
  emptyText: string;
  testId: string;
  children: React.ReactNode;
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (p: number) => void;
  onRowsPerPageChange: (n: number) => void;
  EmptyIcon?: React.ElementType;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Paper
      elevation={0}
      data-testid={testId}
      sx={{
        borderRadius: 4,
        border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.1 : 0.15)}`,
        overflow: "hidden",
      }}
    >
      {loading ? (
        <Box sx={{ p: 6, textAlign: "center" }}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading…
          </Typography>
        </Box>
      ) : isEmpty ? (
        <Box sx={{ p: 6, textAlign: "center" }} data-testid={`${testId}-empty`}>
          {EmptyIcon ? <EmptyIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} /> : null}
          <Typography variant="body1" color="text.secondary">
            {emptyText}
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>{children}</Table>
        </TableContainer>
      )}

      <TablePagination
        component="div"
        count={count}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Paper>
  );
}

/** A thin Paper wrapper for a tab's filter row. */
export function FilterBar({ testId, children }: { testId: string; children: React.ReactNode }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Paper
      elevation={0}
      data-testid={testId}
      sx={{
        p: 2,
        mb: 2.5,
        borderRadius: 4,
        border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.1 : 0.15)}`,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", md: "center" }}
        flexWrap="wrap"
        useFlexGap
      >
        {children}
      </Stack>
    </Paper>
  );
}

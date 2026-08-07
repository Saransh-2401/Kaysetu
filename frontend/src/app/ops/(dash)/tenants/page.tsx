"use client";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import ExtensionIcon from "@mui/icons-material/Extension";
import PauseCircleIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleIcon from "@mui/icons-material/PlayCircleOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RefreshIcon from "@mui/icons-material/Refresh";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import StorageIcon from "@mui/icons-material/Storage";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import {
  CodeText,
  EmptyRow,
  HeadRow,
  PageHeader,
  SectionHeader,
  StatusChip,
  Surface,
  TableShell,
  TableSkeleton,
  TableToolbar,
  SearchField,
  fmtDate,
  type Column,
  type Tone,
} from "@/components/ui/kit";
import { RADIUS } from "@/theme";
import { api, type Paginated } from "@/lib/api";

interface TenantRow {
  id: number;
  org_code: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  owner_name: string;
  owner_email: string;
  package_code: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

interface TenantDetail extends TenantRow {
  owner_phone: string;
  db_name: string;
  entitled_modules: string[];
  subscriptions: {
    id: number;
    package_code: string;
    seats: number;
    billing_cycle: string;
    status: string;
  }[];
  jobs: {
    id: number;
    job_type: string;
    status: string;
    attempts: number;
    log: string;
    created_at: string;
  }[];
}

interface ModuleDef {
  code: string;
  name: string;
}

const STATUSES = ["provisioning", "trial", "active", "suspended", "churned", "failed"] as const;

const STATUS_TONE: Record<string, Tone> = {
  trial: "info",
  active: "success",
  suspended: "warning",
  failed: "danger",
  provisioning: "gold",
  churned: "neutral",
};

const JOB_TONE: Record<string, Tone> = {
  done: "success",
  failed: "danger",
  running: "info",
  pending: "warning",
};

const COLS: Column[] = [
  { key: "Org code", width: 130 },
  { key: "Company" },
  { key: "Owner" },
  { key: "Package", align: "center", width: 110 },
  { key: "Status", align: "center", width: 120 },
  { key: "Trial ends", align: "right", width: 120 },
];

/** Label + value pair used throughout the detail drawer. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", lineHeight: 1.6 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}

export default function TenantsPage() {
  const theme = useTheme();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    api<Paginated<TenantRow>>("ops", `/sa/tenants/?${params}`)
      .then((page) => {
        setRows(page.results);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<ModuleDef[]>("ops", "/sa/modules/").then(setModules).catch(() => {});
  }, []);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const data = await api<TenantDetail>("ops", `/sa/tenants/${id}/`);
      setDetail(data);
      setSelectedModules(data.entitled_modules);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not open the tenant.");
    } finally {
      setDetailLoading(false);
    }
  };

  const act = async (path: string, body?: unknown, message = "Done") => {
    if (!detail) return;
    setBusy(true);
    try {
      await api("ops", `/sa/tenants/${detail.id}/${path}/`, { method: "POST", body });
      setToast(message);
      await openDetail(detail.id);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const filtersActive = Boolean(search || statusFilter);

  return (
    <Box data-testid="ops-tenants-container">
      <PageHeader
        title="Tenants"
        subtitle="Every business on the platform, and the levers you have over them"
        icon={<BusinessIcon />}
        actions={
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={load}
                disabled={loading}
                aria-label="Refresh tenants"
                data-testid="ops-tenants-refresh-btn"
                sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}
              >
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableShell
        testId="ops-tenants-table"
        minWidth={880}
        toolbar={
          <TableToolbar>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search company, org code or email"
              width={300}
              testId="ops-tenants-search-input"
            />
            <TextField
              size="small"
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="ops-tenants-status-select"
              sx={{ width: 170, "& .MuiOutlinedInput-root": { height: 36 } }}
            >
              <MenuItem value="">All statuses</MenuItem>
              {STATUSES.map((s) => (
                <MenuItem key={s} value={s} data-testid={`ops-tenants-status-option-${s}`} sx={{ textTransform: "capitalize" }}>
                  {s}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ flexGrow: 1 }} />

            <Typography variant="caption" color="text.secondary">
              {loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "tenant" : "tenants"}`}
            </Typography>
          </TableToolbar>
        }
      >
        <HeadRow cols={COLS} />

        {loading ? (
          <TableSkeleton cols={COLS.length} />
        ) : rows.length === 0 ? (
          <EmptyRow
            cols={COLS.length}
            icon={filtersActive ? <SearchOffIcon /> : <BusinessIcon />}
            message={filtersActive ? "No tenants match those filters" : "No tenants yet"}
            hint={
              filtersActive
                ? "Try a different search term, or clear the status filter."
                : "Tenants appear here as soon as the first signup completes provisioning."
            }
            testId="ops-tenants-empty-text"
            action={
              filtersActive ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                  }}
                  data-testid="ops-tenants-clear-filters-btn"
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                hover
                onClick={() => openDetail(row.id)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && openDetail(row.id)}
                data-testid={`ops-tenant-row-${row.org_code}`}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>
                  <CodeText>{row.org_code}</CodeText>
                </TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1.25}>
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "7px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: "primary.main",
                      }}
                    >
                      {row.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {row.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                        {row.industry || "—"}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap>
                    {row.owner_name || "—"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {row.owner_email}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {row.package_code ? (
                    <Chip size="small" variant="outlined" label={row.package_code} />
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      —
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  <StatusChip
                    label={row.status}
                    tone={STATUS_TONE[row.status] ?? "neutral"}
                    testId={`ops-tenant-status-chip-${row.org_code}`}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="caption" color={row.trial_ends_at ? "text.primary" : "text.disabled"}>
                    {row.trial_ends_at ? fmtDate(row.trial_ends_at) : "—"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </TableShell>

      {/* ── Detail drawer ───────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={detail !== null}
        onClose={() => setDetail(null)}
        data-testid="ops-tenant-detail-drawer"
        PaperProps={{ sx: { width: { xs: "100%", sm: 560 }, bgcolor: "background.default" } }}
      >
        {detail && (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Sticky header so the tenant identity stays visible while scrolling. */}
            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                px: 3,
                py: 2.25,
                bgcolor: "background.paper",
                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                  <Avatar
                    variant="rounded"
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: RADIUS.sm,
                      fontWeight: 800,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: "primary.main",
                    }}
                  >
                    {detail.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" noWrap sx={{ fontSize: "1.05rem", lineHeight: 1.3 }}>
                      {detail.name}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.4 }}>
                      <CodeText>{detail.org_code}</CodeText>
                      <StatusChip label={detail.status} tone={STATUS_TONE[detail.status] ?? "neutral"} />
                    </Stack>
                  </Box>
                </Stack>
                <IconButton
                  size="small"
                  onClick={() => setDetail(null)}
                  aria-label="Close tenant details"
                  data-testid="ops-tenant-close-drawer-btn"
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Stack>
            </Box>

            <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
              <Stack spacing={2}>
                {/* Identity */}
                <Surface>
                  <SectionHeader title="Account" icon={<StorageIcon />} />
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.75,
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    }}
                  >
                    <Field label="Owner" value={detail.owner_name} />
                    <Field label="Industry" value={detail.industry} />
                    <Field label="Owner email" value={detail.owner_email} />
                    <Field label="Owner phone" value={detail.owner_phone} />
                    <Field label="Database" value={<CodeText>{detail.db_name}</CodeText>} />
                    <Field label="Created" value={fmtDate(detail.created_at)} />
                  </Box>
                </Surface>

                {/* Lifecycle actions — destructive/disruptive ones are tone-coded. */}
                <Surface>
                  <SectionHeader
                    title="Lifecycle"
                    subtitle="Actions apply immediately to this tenant"
                    icon={<RocketLaunchIcon />}
                    color={theme.palette.warning.main}
                  />
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
                    {detail.status !== "suspended" ? (
                      <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        disabled={busy}
                        startIcon={<PauseCircleIcon sx={{ fontSize: 16 }} />}
                        onClick={() => act("suspend", undefined, `${detail.org_code} suspended`)}
                        data-testid="ops-tenant-suspend-btn"
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        disabled={busy}
                        startIcon={<PlayCircleIcon sx={{ fontSize: 16 }} />}
                        onClick={() => act("activate", undefined, `${detail.org_code} reactivated`)}
                        data-testid="ops-tenant-activate-btn"
                      >
                        Activate
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={busy}
                      startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                      onClick={() => act("retry-provisioning", undefined, "Provisioning re-queued")}
                      data-testid="ops-tenant-retry-provisioning-btn"
                    >
                      Re-run provisioning
                    </Button>
                  </Stack>
                </Surface>

                {/* Entitlements */}
                <Surface>
                  <SectionHeader
                    title="Entitlements"
                    subtitle="Manual override — overrides the package's modules"
                    icon={<ExtensionIcon />}
                    color={theme.palette.info.main}
                    actions={
                      <Chip
                        size="small"
                        label={`${selectedModules.length} of ${modules.length}`}
                        sx={{ height: 20, fontSize: "0.68rem" }}
                      />
                    }
                  />
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      mb: 1.5,
                    }}
                    data-testid="ops-tenant-modules-grid"
                  >
                    {modules.map((mod) => {
                      const on = selectedModules.includes(mod.code);
                      return (
                        <FormControlLabel
                          key={mod.code}
                          sx={{ mr: 0, minWidth: 0 }}
                          control={
                            <Checkbox
                              checked={on}
                              onChange={(e) =>
                                setSelectedModules((current) =>
                                  e.target.checked
                                    ? [...current, mod.code]
                                    : current.filter((c) => c !== mod.code)
                                )
                              }
                              data-testid={`ops-tenant-module-checkbox-${mod.code}`}
                            />
                          }
                          label={
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="caption"
                                fontWeight={800}
                                sx={{ display: "block", color: on ? "primary.main" : "text.secondary" }}
                              >
                                {mod.code}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                                {mod.name}
                              </Typography>
                            </Box>
                          }
                        />
                      );
                    })}
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={busy}
                    onClick={() => act("set-modules", { modules: selectedModules }, "Entitlements updated")}
                    data-testid="ops-tenant-savemodules-btn"
                  >
                    Save modules
                  </Button>
                </Surface>

                {/* Subscription */}
                <Surface>
                  <SectionHeader title="Subscription" icon={<ReceiptLongIcon />} color={theme.palette.secondary.main} />
                  {detail.subscriptions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No subscription on record — this tenant is on a trial or unpriced plan.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {detail.subscriptions.map((sub) => (
                        <Stack
                          key={sub.id}
                          direction="row"
                          alignItems="center"
                          spacing={1.5}
                          data-testid={`ops-tenant-subscription-row-${sub.id}`}
                          sx={{
                            p: 1.25,
                            borderRadius: "10px",
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                          }}
                        >
                          <Chip size="small" label={sub.package_code} sx={{ fontWeight: 800 }} />
                          <Typography variant="caption" sx={{ flex: 1 }}>
                            {sub.seats} {sub.seats === 1 ? "seat" : "seats"} · {sub.billing_cycle}
                          </Typography>
                          <StatusChip
                            label={sub.status}
                            tone={sub.status === "active" ? "success" : "neutral"}
                          />
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Surface>

                {/* Provisioning jobs */}
                <Surface>
                  <SectionHeader
                    title="Provisioning jobs"
                    subtitle="Most recent first"
                    icon={<RocketLaunchIcon />}
                    color={theme.palette.info.main}
                  />
                  {detail.jobs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No provisioning jobs recorded.
                    </Typography>
                  ) : (
                    <Stack spacing={1.25}>
                      {detail.jobs.map((job) => (
                        <Box key={job.id} data-testid={`ops-tenant-job-row-${job.id}`}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }} flexWrap="wrap">
                            <StatusChip label={job.status} tone={JOB_TONE[job.status] ?? "neutral"} />
                            <Typography variant="caption" fontWeight={700}>
                              {job.job_type}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              attempt {job.attempts} · {fmtDate(job.created_at)}
                            </Typography>
                          </Stack>
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              p: 1.25,
                              maxHeight: 150,
                              overflow: "auto",
                              borderRadius: "8px",
                              fontSize: "0.68rem",
                              lineHeight: 1.6,
                              whiteSpace: "pre-wrap",
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              bgcolor: alpha(theme.palette.primary.main, 0.04),
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                              color: "text.secondary",
                            }}
                          >
                            {job.log || "(no log output)"}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Surface>
              </Stack>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Loading a tenant is a full-screen wait; say so rather than freezing the row. */}
      {detailLoading && !detail && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(theme.palette.background.default, 0.6),
          }}
        >
          <CircularProgress size={30} />
        </Box>
      )}

      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        data-testid="ops-tenants-toast"
      />
    </Box>
  );
}

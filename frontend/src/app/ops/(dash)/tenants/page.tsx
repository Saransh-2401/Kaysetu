"use client";
import {
  Alert, Box, Button, Checkbox, Chip, Divider, Drawer, FormControlLabel, MenuItem,
  Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

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
  subscriptions: { id: number; package_code: string; seats: number; billing_cycle: string; status: string }[];
  jobs: { id: number; job_type: string; status: string; attempts: number; log: string; created_at: string }[];
}

interface ModuleDef {
  code: string;
  name: string;
}

const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  trial: "info", active: "success", suspended: "warning", failed: "error",
};

export default function TenantsPage() {
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    api<Paginated<TenantRow>>("ops", `/sa/tenants/?${params}`)
      .then((page) => setRows(page.results))
      .catch((err) => setError(err.message));
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<ModuleDef[]>("ops", "/sa/modules/").then(setModules).catch(() => {});
  }, []);

  const openDetail = async (id: number) => {
    const data = await api<TenantDetail>("ops", `/sa/tenants/${id}/`);
    setDetail(data);
    setSelectedModules(data.entitled_modules);
  };

  const act = async (path: string, body?: unknown) => {
    if (!detail) return;
    try {
      await api("ops", `/sa/tenants/${detail.id}/${path}/`, { method: "POST", body });
      setToast("Done");
      await openDetail(detail.id);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <Box data-testid="ops-tenants-container">
      <Typography variant="h5" gutterBottom>
        Tenants
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" label="Search company / org code / email" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ width: 320 }}
          inputProps={{ "data-testid": "ops-tenants-search-input" }} />
        <TextField size="small" select label="Status" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)} sx={{ width: 180 }}
          data-testid="ops-tenants-status-select">
          <MenuItem value="">All</MenuItem>
          {["provisioning", "trial", "active", "suspended", "churned", "failed"].map((s) => (
            <MenuItem key={s} value={s} data-testid={`ops-tenants-status-option-${s}`}>{s}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Table size="small" data-testid="ops-tenants-table">
        <TableHead>
          <TableRow>
            <TableCell>Org code</TableCell>
            <TableCell>Company</TableCell>
            <TableCell>Owner</TableCell>
            <TableCell>Package</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Trial ends</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover sx={{ cursor: "pointer" }} onClick={() => openDetail(row.id)}
              data-testid={`ops-tenant-row-${row.org_code}`}>
              <TableCell>{row.org_code}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.owner_email}</TableCell>
              <TableCell>{row.package_code ?? "—"}</TableCell>
              <TableCell>
                <Chip size="small" label={row.status} color={STATUS_COLOR[row.status] ?? "default"}
                  data-testid={`ops-tenant-status-chip-${row.org_code}`} />
              </TableCell>
              <TableCell>{row.trial_ends_at ? new Date(row.trial_ends_at).toLocaleDateString("en-IN") : "—"}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography color="text.secondary" data-testid="ops-tenants-empty-text">No tenants found.</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Drawer anchor="right" open={detail !== null} onClose={() => setDetail(null)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 520 }, p: 3 } }} data-testid="ops-tenant-detail-drawer">
        {detail && (
          <Box>
            <Typography variant="h6">{detail.name}</Typography>
            <Typography color="text.secondary" gutterBottom>
              {detail.org_code} · {detail.industry} · DB {detail.db_name}
            </Typography>
            <Chip size="small" label={detail.status} color={STATUS_COLOR[detail.status] ?? "default"} sx={{ mb: 2 }} />

            <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
              {detail.status !== "suspended" ? (
                <Button variant="outlined" color="warning" onClick={() => act("suspend")}
                  data-testid="ops-tenant-suspend-btn">
                  Suspend
                </Button>
              ) : (
                <Button variant="contained" color="success" onClick={() => act("activate")}
                  data-testid="ops-tenant-activate-btn">
                  Activate
                </Button>
              )}
              <Button variant="outlined" onClick={() => act("retry-provisioning")}
                data-testid="ops-tenant-retry-provisioning-btn">
                Re-run provisioning
              </Button>
            </Stack>

            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Entitlements (manual override)
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", mb: 1 }} data-testid="ops-tenant-modules-grid">
              {modules.map((mod) => (
                <FormControlLabel
                  key={mod.code}
                  control={
                    <Checkbox
                      checked={selectedModules.includes(mod.code)}
                      onChange={(e) =>
                        setSelectedModules((current) =>
                          e.target.checked ? [...current, mod.code] : current.filter((c) => c !== mod.code),
                        )
                      }
                      data-testid={`ops-tenant-module-checkbox-${mod.code}`}
                    />
                  }
                  label={`${mod.code} — ${mod.name}`}
                />
              ))}
            </Box>
            <Button variant="contained" onClick={() => act("set-modules", { modules: selectedModules })}
              data-testid="ops-tenant-savemodules-btn">
              Save modules
            </Button>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Subscription
            </Typography>
            {detail.subscriptions.map((sub) => (
              <Typography key={sub.id} variant="body2" data-testid={`ops-tenant-subscription-row-${sub.id}`}>
                {sub.package_code} · {sub.seats} seats · {sub.billing_cycle} · {sub.status}
              </Typography>
            ))}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Provisioning jobs
            </Typography>
            {detail.jobs.map((job) => (
              <Box key={job.id} sx={{ mb: 1 }} data-testid={`ops-tenant-job-row-${job.id}`}>
                <Chip size="small" label={`${job.job_type} · ${job.status} · attempt ${job.attempts}`}
                  color={job.status === "failed" ? "error" : job.status === "done" ? "success" : "default"} />
                <Typography variant="caption" component="pre"
                  sx={{ whiteSpace: "pre-wrap", bgcolor: "action.hover", p: 1, borderRadius: 1, mt: 0.5, maxHeight: 140, overflow: "auto" }}>
                  {job.log}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Drawer>

      <Snackbar open={toast !== null} autoHideDuration={2500} onClose={() => setToast(null)}
        message={toast} data-testid="ops-tenants-toast" />
    </Box>
  );
}

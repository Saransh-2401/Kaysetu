"use client";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, MenuItem,
  Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { api, type Paginated } from "@/lib/api";

interface Job {
  id: number;
  tenant_id: number;
  tenant_org_code: string;
  tenant_name: string;
  job_type: string;
  status: string;
  attempts: number;
  log: string;
  created_at: string;
  finished_at: string | null;
}

const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  done: "success", failed: "error", running: "info", pending: "warning",
};

export default function ProvisioningPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    api<Paginated<Job>>("ops", `/sa/provisioning-jobs/${params}`)
      .then((page) => setJobs(page.results))
      .catch((err) => setError(err.message));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async (job: Job) => {
    try {
      await api("ops", `/sa/tenants/${job.tenant_id}/retry-provisioning/`, { method: "POST" });
      setToast(`Re-ran provisioning for ${job.tenant_org_code}`);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Retry failed");
    }
  };

  return (
    <Box data-testid="ops-provisioning-container">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Provisioning Monitor</Typography>
        <Stack direction="row" spacing={1}>
          <TextField size="small" select label="Status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} sx={{ width: 160 }}
            data-testid="ops-provisioning-status-select">
            <MenuItem value="">All</MenuItem>
            {["pending", "running", "done", "failed"].map((s) => (
              <MenuItem key={s} value={s} data-testid={`ops-provisioning-status-option-${s}`}>{s}</MenuItem>
            ))}
          </TextField>
          <Button startIcon={<RefreshIcon />} onClick={load} data-testid="ops-provisioning-refresh-btn">
            Refresh
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {jobs.map((job) => (
        <Accordion key={job.id} disableGutters data-testid={`ops-provisioning-job-${job.id}`}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ width: "100%" }}>
              <Chip size="small" label={job.status} color={STATUS_COLOR[job.status] ?? "default"}
                data-testid={`ops-provisioning-jobstatus-chip-${job.id}`} />
              <Typography sx={{ fontWeight: 600 }}>{job.tenant_org_code}</Typography>
              <Typography color="text.secondary">{job.tenant_name}</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ ml: "auto", mr: 2 }}>
                {job.job_type} · attempts {job.attempts} · {new Date(job.created_at).toLocaleString("en-IN")}
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Typography component="pre" variant="caption"
              sx={{ whiteSpace: "pre-wrap", bgcolor: "action.hover", p: 1.5, borderRadius: 1, maxHeight: 220, overflow: "auto" }}>
              {job.log || "(no log)"}
            </Typography>
            {job.status === "failed" && (
              <Button variant="contained" color="warning" sx={{ mt: 1 }} onClick={() => retry(job)}
                data-testid={`ops-provisioning-retry-btn-${job.id}`}>
                Retry provisioning
              </Button>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
      {jobs.length === 0 && !error && (
        <Typography color="text.secondary" data-testid="ops-provisioning-empty-text">
          No provisioning jobs yet.
        </Typography>
      )}

      <Snackbar open={toast !== null} autoHideDuration={2500} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

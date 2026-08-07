"use client";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReplayIcon from "@mui/icons-material/Replay";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import {
  Alert,
  Box,
  Button,
  Collapse,
  IconButton,
  MenuItem,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import {
  CodeText,
  EmptyState,
  PageHeader,
  StatPill,
  StatusChip,
  Surface,
  enterSx,
  fmtAgo,
  type Tone,
} from "@/components/ui/kit";
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

const STATUSES = ["pending", "running", "done", "failed"] as const;

const STATUS_TONE: Record<string, Tone> = {
  done: "success",
  failed: "danger",
  running: "info",
  pending: "warning",
};

export default function ProvisioningPage() {
  const theme = useTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : "";
    api<Paginated<Job>>("ops", `/sa/provisioning-jobs/${params}`)
      .then((page) => {
        setJobs(page.results);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async (job: Job) => {
    setRetrying(job.id);
    try {
      await api("ops", `/sa/tenants/${job.tenant_id}/retry-provisioning/`, { method: "POST" });
      setToast(`Re-ran provisioning for ${job.tenant_org_code}`);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  };

  // Counts come from the loaded page, so they describe what's on screen.
  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = jobs.filter((j) => j.status === s).length;
    return acc;
  }, {});

  return (
    <Box data-testid="ops-provisioning-container">
      <PageHeader
        title="Provisioning Monitor"
        subtitle="Every tenant database build, and why it failed when it did"
        icon={<RocketLaunchIcon />}
        actions={
          <>
            <TextField
              size="small"
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="ops-provisioning-status-select"
              sx={{ width: 160, "& .MuiOutlinedInput-root": { height: 36 } }}
            >
              <MenuItem value="">All statuses</MenuItem>
              {STATUSES.map((s) => (
                <MenuItem
                  key={s}
                  value={s}
                  data-testid={`ops-provisioning-status-option-${s}`}
                  sx={{ textTransform: "capitalize" }}
                >
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  onClick={load}
                  disabled={loading}
                  aria-label="Refresh provisioning jobs"
                  data-testid="ops-provisioning-refresh-btn"
                  sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}
                >
                  <RefreshIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!loading && jobs.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2, rowGap: 1, ...enterSx(1) }}>
          {STATUSES.filter((s) => counts[s] > 0).map((s) => (
            <StatPill
              key={s}
              label={s}
              value={counts[s]}
              tone={STATUS_TONE[s]}
              testId={`ops-provisioning-count-${s}`}
            />
          ))}
        </Stack>
      )}

      {loading ? (
        <Stack spacing={1.25}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={62} />
          ))}
        </Stack>
      ) : jobs.length === 0 ? (
        <Surface>
          <EmptyState
            icon={statusFilter ? <SearchOffIcon /> : <CheckCircleIcon />}
            message={statusFilter ? `No ${statusFilter} jobs` : "No provisioning jobs yet"}
            hint={
              statusFilter
                ? "Nothing is in this state right now."
                : "A job is recorded here every time a new tenant's database is built."
            }
            testId="ops-provisioning-empty-text"
            action={
              statusFilter ? (
                <Button size="small" variant="outlined" onClick={() => setStatusFilter("")}>
                  Show all jobs
                </Button>
              ) : undefined
            }
          />
        </Surface>
      ) : (
        <Stack spacing={1.25}>
          {jobs.map((job, i) => {
            const open = expanded === job.id;
            const tone = STATUS_TONE[job.status] ?? "neutral";
            const failed = job.status === "failed";

            return (
              <Surface
                key={job.id}
                padded={false}
                testId={`ops-provisioning-job-${job.id}`}
                accent={failed ? theme.palette.error.main : undefined}
                sx={enterSx(Math.min(i, 8))}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  onClick={() => setExpanded(open ? null : job.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpanded(open ? null : job.id);
                    }
                  }}
                  sx={{
                    px: 2,
                    py: 1.5,
                    pl: failed ? 2.5 : 2,
                    cursor: "pointer",
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                  }}
                >
                  <StatusChip
                    label={job.status}
                    tone={tone}
                    testId={`ops-provisioning-jobstatus-chip-${job.id}`}
                  />

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <CodeText>{job.tenant_org_code}</CodeText>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {job.tenant_name}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {job.job_type} · attempt {job.attempts} · started {fmtAgo(job.created_at)}
                      {job.finished_at ? ` · finished ${fmtAgo(job.finished_at)}` : ""}
                    </Typography>
                  </Box>

                  <ExpandMoreIcon
                    sx={{
                      fontSize: 20,
                      flexShrink: 0,
                      color: "text.disabled",
                      transform: open ? "rotate(180deg)" : "none",
                      transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </Stack>

                <Collapse in={open} timeout={240} unmountOnExit>
                  <Box sx={{ px: 2, pb: 2, pl: failed ? 2.5 : 2 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      Job log
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        p: 1.5,
                        maxHeight: 240,
                        overflow: "auto",
                        borderRadius: "8px",
                        fontSize: "0.7rem",
                        lineHeight: 1.65,
                        whiteSpace: "pre-wrap",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                        color: "text.secondary",
                      }}
                    >
                      {job.log || "(no log output)"}
                    </Box>

                    {failed && (
                      <Button
                        variant="contained"
                        color="warning"
                        size="small"
                        sx={{ mt: 1.5 }}
                        disabled={retrying !== null}
                        startIcon={<ReplayIcon sx={{ fontSize: 16 }} />}
                        onClick={() => retry(job)}
                        data-testid={`ops-provisioning-retry-btn-${job.id}`}
                      >
                        {retrying === job.id ? "Retrying…" : "Retry provisioning"}
                      </Button>
                    )}
                  </Box>
                </Collapse>
              </Surface>
            );
          })}
        </Stack>
      )}

      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
    </Box>
  );
}

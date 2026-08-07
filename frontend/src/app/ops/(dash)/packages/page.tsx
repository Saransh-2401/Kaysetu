"use client";
import EditIcon from "@mui/icons-material/Edit";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  Switch,
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
  StatusChip,
  TableShell,
  TableSkeleton,
  type Column,
} from "@/components/ui/kit";
import { api, type Paginated } from "@/lib/api";

interface PackageRow {
  id: number;
  code: string;
  name: string;
  tagline: string;
  modules: string[];
  is_addon: boolean;
  mobile_level: string;
  base_price_monthly: string;
  base_price_annual: string;
  included_users: number;
  per_user_price: string;
  is_published: boolean;
  sort_order: number;
}

interface ModuleDef {
  code: string;
  name: string;
}

const COLS: Column[] = [
  { key: "Code", width: 130 },
  { key: "Package" },
  { key: "Modules", width: 260 },
  { key: "₹ / month", align: "right", width: 110 },
  { key: "Users incl.", align: "right", width: 100 },
  { key: "Visibility", align: "center", width: 110 },
  { key: "", align: "right", width: 60 },
];

export default function PackagesPage() {
  const theme = useTheme();
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [editing, setEditing] = useState<PackageRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<Paginated<PackageRow>>("ops", "/sa/packages/")
      .then((page) => {
        setRows(page.results);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api<ModuleDef[]>("ops", "/sa/modules/").then(setModules).catch(() => {});
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api("ops", `/sa/packages/${editing.id}/`, {
        method: "PATCH",
        body: {
          name: editing.name,
          tagline: editing.tagline,
          modules: editing.modules,
          base_price_monthly: editing.base_price_monthly,
          base_price_annual: editing.base_price_annual,
          included_users: editing.included_users,
          per_user_price: editing.per_user_price,
          is_published: editing.is_published,
        },
      });
      setToast(`${editing.code} saved — live on the pricing page`);
      setEditing(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box data-testid="ops-packages-container">
      <PageHeader
        title="Packages & Pricing"
        subtitle="Edits go live on the public pricing page immediately — existing subscriptions keep their price"
        icon={<Inventory2Icon />}
        actions={
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={load}
                disabled={loading}
                aria-label="Refresh packages"
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

      <TableShell testId="ops-packages-table" minWidth={980}>
        <HeadRow cols={COLS} />

        {loading ? (
          <TableSkeleton cols={COLS.length} />
        ) : rows.length === 0 ? (
          <EmptyRow
            cols={COLS.length}
            icon={<Inventory2Icon />}
            message="No packages defined"
            hint="Seed the package catalogue before tenants can subscribe to a plan."
          />
        ) : (
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover data-testid={`ops-package-row-${row.code}`}>
                <TableCell>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <CodeText>{row.code}</CodeText>
                    {row.is_addon && (
                      <Chip
                        size="small"
                        label="add-on"
                        sx={{ height: 18, fontSize: "0.6rem", bgcolor: alpha(theme.palette.info.main, 0.12), color: "info.dark" }}
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {row.name}
                  </Typography>
                  {row.tagline && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: 260 }}>
                      {row.tagline}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" gap={0.5} flexWrap="wrap">
                    {row.modules.length === 0 ? (
                      <Typography variant="caption" color="text.disabled">
                        none
                      </Typography>
                    ) : (
                      row.modules.map((m) => (
                        <Chip
                          key={m}
                          size="small"
                          variant="outlined"
                          label={m}
                          sx={{ height: 19, fontSize: "0.62rem", fontWeight: 700 }}
                        />
                      ))
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right" data-testid={`ops-package-price-${row.code}`}>
                  <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {Number(row.base_price_monthly).toLocaleString("en-IN")}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {row.included_users}
                </TableCell>
                <TableCell align="center">
                  <StatusChip
                    label={row.is_published ? "Live" : "Hidden"}
                    tone={row.is_published ? "success" : "neutral"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={`Edit ${row.code}`}>
                    <IconButton
                      size="small"
                      onClick={() => setEditing(row)}
                      aria-label={`Edit ${row.code}`}
                      data-testid={`ops-package-edit-btn-${row.code}`}
                      sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}
                    >
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </TableShell>

      {/* ── Editor ──────────────────────────────────────────────── */}
      <Dialog
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        fullWidth
        maxWidth="sm"
        data-testid="ops-package-edit-dialog"
      >
        {editing && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <span>Edit package</span>
                <CodeText>{editing.code}</CodeText>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
                Changes are published to kaysetu.in as soon as you save.
              </Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ bgcolor: "background.default" }}>
              <Stack spacing={2.25} sx={{ pt: 0.5 }}>
                <TextField
                  label="Name"
                  size="small"
                  fullWidth
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  slotProps={{ htmlInput: { "data-testid": "ops-package-name-input" } }}
                />
                <TextField
                  label="Tagline"
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  value={editing.tagline}
                  helperText="One line shown under the package name on the pricing page."
                  onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                  slotProps={{ htmlInput: { "data-testid": "ops-package-tagline-input" } }}
                />

                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  }}
                >
                  <TextField
                    label="Price / month"
                    size="small"
                    value={editing.base_price_monthly}
                    onChange={(e) => setEditing({ ...editing, base_price_monthly: e.target.value })}
                    slotProps={{
                      htmlInput: { "data-testid": "ops-package-monthly-input", inputMode: "decimal" },
                      input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                    }}
                  />
                  <TextField
                    label="Price / year"
                    size="small"
                    value={editing.base_price_annual}
                    onChange={(e) => setEditing({ ...editing, base_price_annual: e.target.value })}
                    slotProps={{
                      htmlInput: { "data-testid": "ops-package-annual-input", inputMode: "decimal" },
                      input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                    }}
                  />
                  <TextField
                    label="Included users"
                    size="small"
                    type="number"
                    value={editing.included_users}
                    onChange={(e) => setEditing({ ...editing, included_users: Number(e.target.value) })}
                    slotProps={{ htmlInput: { "data-testid": "ops-package-users-input", min: 0 } }}
                  />
                  <TextField
                    label="Price / extra user"
                    size="small"
                    value={editing.per_user_price}
                    onChange={(e) => setEditing({ ...editing, per_user_price: e.target.value })}
                    slotProps={{
                      htmlInput: { "data-testid": "ops-package-peruser-input", inputMode: "decimal" },
                      input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Modules
                    </Typography>
                    <Chip
                      size="small"
                      label={`${editing.modules.length} selected`}
                      sx={{ height: 19, fontSize: "0.66rem" }}
                    />
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" },
                      p: 1,
                      borderRadius: "10px",
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                      bgcolor: "background.paper",
                    }}
                  >
                    {modules.map((mod) => (
                      <FormControlLabel
                        key={mod.code}
                        sx={{ mr: 0 }}
                        control={
                          <Checkbox
                            checked={editing.modules.includes(mod.code)}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                modules: e.target.checked
                                  ? [...editing.modules, mod.code]
                                  : editing.modules.filter((c) => c !== mod.code),
                              })
                            }
                            data-testid={`ops-package-module-checkbox-${mod.code}`}
                          />
                        }
                        label={
                          <Tooltip title={mod.name}>
                            <Typography variant="caption" fontWeight={700}>
                              {mod.code}
                            </Typography>
                          </Tooltip>
                        }
                      />
                    ))}
                  </Box>
                </Box>

                <FormControlLabel
                  sx={{ alignItems: "flex-start", m: 0, "& .MuiFormControlLabel-label": { pt: 0.5 } }}
                  control={
                    <Switch
                      checked={editing.is_published}
                      onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                      data-testid="ops-package-published-switch"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        Published on the pricing page
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Turn off to hide this package from prospects without deleting it.
                      </Typography>
                    </Box>
                  }
                />
              </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button
                onClick={() => setEditing(null)}
                disabled={saving}
                data-testid="ops-package-cancel-btn"
                sx={{ color: "text.secondary" }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={save}
                disabled={saving}
                data-testid="ops-package-save-btn"
              >
                {saving ? "Saving…" : "Save package"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

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

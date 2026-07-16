"use client";
import EditIcon from "@mui/icons-material/Edit";
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Snackbar, Stack, Switch, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

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

export default function PackagesPage() {
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [editing, setEditing] = useState<PackageRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Paginated<PackageRow>>("ops", "/sa/packages/")
      .then((page) => setRows(page.results))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
    api<ModuleDef[]>("ops", "/sa/modules/").then(setModules).catch(() => {});
  }, [load]);

  const save = async () => {
    if (!editing) return;
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
    }
  };

  return (
    <Box data-testid="ops-packages-container">
      <Typography variant="h5" gutterBottom>
        Packages & Pricing
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Edits go live on the public pricing page immediately. Existing subscriptions keep their price.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Table size="small" data-testid="ops-packages-table">
        <TableHead>
          <TableRow>
            <TableCell>Code</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Modules</TableCell>
            <TableCell align="right">₹/month</TableCell>
            <TableCell align="right">Users incl.</TableCell>
            <TableCell>Published</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover data-testid={`ops-package-row-${row.code}`}>
              <TableCell>
                {row.code}
                {row.is_addon && <Chip size="small" label="add-on" sx={{ ml: 1 }} />}
              </TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell sx={{ maxWidth: 260 }}>
                <Stack direction="row" gap={0.5} flexWrap="wrap">
                  {row.modules.map((m) => <Chip key={m} size="small" variant="outlined" label={m} />)}
                </Stack>
              </TableCell>
              <TableCell align="right" data-testid={`ops-package-price-${row.code}`}>
                {Number(row.base_price_monthly).toLocaleString("en-IN")}
              </TableCell>
              <TableCell align="right">{row.included_users}</TableCell>
              <TableCell>
                <Chip size="small" label={row.is_published ? "live" : "hidden"}
                  color={row.is_published ? "success" : "default"} />
              </TableCell>
              <TableCell>
                <IconButton size="small" onClick={() => setEditing(row)} data-testid={`ops-package-edit-btn-${row.code}`}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm"
        data-testid="ops-package-edit-dialog">
        {editing && (
          <>
            <DialogTitle>Edit {editing.code}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="Name" value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  inputProps={{ "data-testid": "ops-package-name-input" }} />
                <TextField label="Tagline" value={editing.tagline} multiline
                  onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                  inputProps={{ "data-testid": "ops-package-tagline-input" }} />
                <Stack direction="row" spacing={2}>
                  <TextField label="₹ / month" value={editing.base_price_monthly}
                    onChange={(e) => setEditing({ ...editing, base_price_monthly: e.target.value })}
                    inputProps={{ "data-testid": "ops-package-monthly-input" }} />
                  <TextField label="₹ / year" value={editing.base_price_annual}
                    onChange={(e) => setEditing({ ...editing, base_price_annual: e.target.value })}
                    inputProps={{ "data-testid": "ops-package-annual-input" }} />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField label="Included users" type="number" value={editing.included_users}
                    onChange={(e) => setEditing({ ...editing, included_users: Number(e.target.value) })}
                    inputProps={{ "data-testid": "ops-package-users-input" }} />
                  <TextField label="₹ / extra user" value={editing.per_user_price}
                    onChange={(e) => setEditing({ ...editing, per_user_price: e.target.value })}
                    inputProps={{ "data-testid": "ops-package-peruser-input" }} />
                </Stack>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Modules</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {modules.map((mod) => (
                      <FormControlLabel key={mod.code}
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
                        label={mod.code}
                      />
                    ))}
                  </Box>
                </Box>
                <FormControlLabel
                  control={
                    <Switch checked={editing.is_published}
                      onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                      data-testid="ops-package-published-switch" />
                  }
                  label="Published on pricing page"
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditing(null)} data-testid="ops-package-cancel-btn">Cancel</Button>
              <Button variant="contained" onClick={save} data-testid="ops-package-save-btn">Save</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

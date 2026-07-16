"use client";
import AddIcon from "@mui/icons-material/Add";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { api, getContext, type Paginated, type PortalContext } from "@/lib/api";

interface CatalogItem {
  id: number;
  name: string;
  code: string;
  kind: "product" | "service";
  unit: string;
  price: string;
  tax_rate: string;
  hsn_sac: string;
  is_active: boolean;
}

const EMPTY_FORM = { name: "", kind: "product", unit: "pcs", price: "0", tax_rate: "18", hsn_sac: "" };

export default function CatalogPage() {
  const [rows, setRows] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labels = getContext<PortalContext>("portal")?.org.labels ?? {};
  const itemLabel = labels.catalog_item ?? "Item";
  const catalogLabel = labels.catalog ?? "Catalog";

  const load = useCallback(() => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    api<Paginated<CatalogItem>>("portal", `/t/catalog/${params}`)
      .then((page) => setRows(page.results))
      .catch((err) => setError(err.message));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      await api("portal", "/t/catalog/", { method: "POST", body: form });
      setToast(`${itemLabel} added`);
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <Box data-testid="portal-catalog-container">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" data-testid="portal-catalog-title">
          {catalogLabel}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}
          data-testid="portal-catalog-add-btn">
          Add {itemLabel}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField size="small" label={`Search ${catalogLabel.toLowerCase()}`} value={search}
        onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, width: 320 }}
        inputProps={{ "data-testid": "portal-catalog-search-input" }} />

      <Table size="small" data-testid="portal-catalog-table">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Price (₹)</TableCell>
            <TableCell align="right">Tax %</TableCell>
            <TableCell>HSN/SAC</TableCell>
            <TableCell>Unit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover data-testid={`portal-catalog-row-${row.id}`}>
              <TableCell>{row.name}</TableCell>
              <TableCell>
                <Chip size="small" label={row.kind} variant="outlined"
                  color={row.kind === "service" ? "secondary" : "default"} />
              </TableCell>
              <TableCell align="right">{Number(row.price).toLocaleString("en-IN")}</TableCell>
              <TableCell align="right">{row.tax_rate}</TableCell>
              <TableCell>{row.hsn_sac || "—"}</TableCell>
              <TableCell>{row.unit}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography color="text.secondary" data-testid="portal-catalog-empty-text">
                  No {catalogLabel.toLowerCase()} yet — add your first {itemLabel.toLowerCase()}.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" data-testid="portal-catalog-add-dialog">
        <DialogTitle>Add {itemLabel}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              inputProps={{ "data-testid": "portal-catalog-name-input" }} />
            <TextField select label="Type" value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              data-testid="portal-catalog-kind-select">
              <MenuItem value="product" data-testid="portal-catalog-kind-option-product">Product</MenuItem>
              <MenuItem value="service" data-testid="portal-catalog-kind-option-service">Service</MenuItem>
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField label="Price (₹)" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                inputProps={{ "data-testid": "portal-catalog-price-input" }} />
              <TextField label="Tax %" value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                inputProps={{ "data-testid": "portal-catalog-tax-input" }} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="HSN/SAC" value={form.hsn_sac}
                onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })}
                inputProps={{ "data-testid": "portal-catalog-hsn-input" }} />
              <TextField label="Unit" value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                inputProps={{ "data-testid": "portal-catalog-unit-input" }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} data-testid="portal-catalog-cancel-btn">Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!form.name} data-testid="portal-catalog-save-btn">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={2500} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import { purchaseService, Supplier, SupplierLedger } from "@/lib/purchase-service";
import { authService } from "@/lib/auth-service";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

export default function SupplierLedgerPage() {
  const theme = useTheme();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [ledger, setLedger] = useState<SupplierLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The supplier list comes from PURCH; without it there are no supplier
    // statements to show (a BOOKS tenant with no procurement).
    if (!authService.hasModule("PURCH")) return;
    let active = true;
    (async () => {
      try {
        const resp = await purchaseService.getSuppliers({ page_size: "1000", ordering: "supplier_name" });
        if (!active) return;
        const list = resp.results || [];
        setSuppliers(list);
        if (list.length > 0) setSupplierId(String(list[0].id));
      } catch {
        if (active) setError("Failed to load suppliers.");
      }
    })();
    return () => { active = false; };
  }, []);

  const loadLedger = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setLedger(await purchaseService.getSupplierLedger(Number(id)));
    } catch {
      setError("Failed to load ledger.");
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (supplierId) loadLedger(supplierId); }, [supplierId, loadLedger]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} mb={4} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>Supplier Ledger</Typography>
          <Typography variant="body2" color="text.secondary">Statement of Accounts (Payables).</Typography>
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, mb: 4, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Select Supplier"
              select
              fullWidth
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              data-testid="supplier-ledger-select"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
            >
              {suppliers.length === 0 ? (
                <MenuItem value="" disabled>No suppliers</MenuItem>
              ) : suppliers.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>{s.supplier_name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              data-testid="supplier-ledger-balance"
              sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.05), borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <Typography fontWeight={600} color="warning.main">Outstanding Payable</Typography>
              <Typography variant="h5" fontWeight={800} color="warning.main">
                {ledger ? inr(ledger.closing_balance) : "—"}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="supplier-ledger-error">{error}</Alert>}

      <Paper elevation={0} sx={{ overflow: "hidden", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
        <TableContainer>
          <Table data-testid="supplier-ledger-table">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700, pl: 4 }}>DATE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>REF #</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>DESCRIPTION</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">DEBIT (PAID)</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">CREDIT (BILL)</TableCell>
                <TableCell sx={{ fontWeight: 700, pr: 4 }} align="right">BALANCE</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : !ledger || ledger.lines.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">No transactions for this supplier.</Typography>
                </TableCell></TableRow>
              ) : (
                <>
                  {ledger.opening_balance !== 0 && (
                    <TableRow>
                      <TableCell sx={{ pl: 4 }}>—</TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>OB</TableCell>
                      <TableCell>Opening Balance</TableCell>
                      <TableCell />
                      <TableCell align="right">-</TableCell>
                      <TableCell align="right">-</TableCell>
                      <TableCell sx={{ pr: 4, fontWeight: 700 }} align="right">{inr(ledger.opening_balance)}</TableCell>
                    </TableRow>
                  )}
                  {ledger.lines.map((row, i) => (
                    <TableRow key={`${row.ref}-${i}`} hover data-testid={`supplier-ledger-row-${row.ref}`}>
                      <TableCell sx={{ pl: 4 }}>{row.date || "—"}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{row.ref}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{row.description || "—"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{row.debit > 0 ? inr(row.debit) : "-"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{row.credit > 0 ? inr(row.credit) : "-"}</TableCell>
                      <TableCell align="right" sx={{ pr: 4, fontWeight: 700 }}>{inr(row.balance)}</TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </motion.div>
  );
}

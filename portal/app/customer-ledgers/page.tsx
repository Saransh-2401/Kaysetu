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
import { crmService, Customer, CustomerLedger } from "@/lib/crm-service";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

export default function CustomerLedgerPage() {
  const theme = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the customer list for the selector
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await crmService.getCustomers({ page_size: "1000", ordering: "customer_name" });
        if (!active) return;
        const list = resp.results || [];
        setCustomers(list);
        if (list.length > 0) setCustomerId(String(list[0].id));
      } catch {
        if (active) setError("Failed to load customers.");
      }
    })();
    return () => { active = false; };
  }, []);

  const loadLedger = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await crmService.getCustomerLedger(Number(id));
      setLedger(data);
    } catch {
      setError("Failed to load ledger.");
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (customerId) loadLedger(customerId); }, [customerId, loadLedger]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} mb={4} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>Customer Ledger</Typography>
          <Typography variant="body2" color="text.secondary">Statement of Accounts (Receivables).</Typography>
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, mb: 4, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Select Customer"
              select
              fullWidth
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              data-testid="customer-ledger-select"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
            >
              {customers.length === 0 ? (
                <MenuItem value="" disabled>No customers</MenuItem>
              ) : customers.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>{c.shop_name || c.customer_name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              data-testid="customer-ledger-balance"
              sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <Typography fontWeight={600} color="info.main">Current Balance Due</Typography>
              <Typography variant="h5" fontWeight={800} color="info.main">
                {ledger ? inr(ledger.closing_balance) : "—"}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="customer-ledger-error">{error}</Alert>}

      <Paper elevation={0} sx={{ overflow: "hidden", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
        <TableContainer>
          <Table data-testid="customer-ledger-table">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700, pl: 4 }}>DATE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>REF #</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>DESCRIPTION</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">DEBIT (INV)</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">CREDIT (PAY)</TableCell>
                <TableCell sx={{ fontWeight: 700, pr: 4 }} align="right">BALANCE</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : !ledger || ledger.lines.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">No transactions for this customer.</Typography>
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
                    <TableRow key={`${row.ref}-${i}`} hover data-testid={`customer-ledger-row-${row.ref}`}>
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

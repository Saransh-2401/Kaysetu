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
import { accountsApi, Account, AccountLedger } from "@/lib/accounts-api";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

export default function GeneralLedgerPage() {
  const theme = useTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await accountsApi.getAccounts({ page_size: "1000", ordering: "account_number" });
        if (!active) return;
        const list = resp.results || [];
        setAccounts(list);
        if (list.length > 0) setAccountId(String(list[0].id));
      } catch {
        if (active) setError("Failed to load accounts.");
      }
    })();
    return () => { active = false; };
  }, []);

  const loadLedger = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setLedger(await accountsApi.getAccountLedger(Number(id)));
    } catch {
      setError("Failed to load ledger.");
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (accountId) loadLedger(accountId); }, [accountId, loadLedger]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} mb={4} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>General Ledger</Typography>
          <Typography variant="body2" color="text.secondary">Account-wise posted journal entries.</Typography>
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, mb: 4, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Select Account"
              select
              fullWidth
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              data-testid="general-ledger-select"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
            >
              {accounts.length === 0 ? (
                <MenuItem value="" disabled>No accounts</MenuItem>
              ) : accounts.map((a) => (
                <MenuItem key={a.id} value={String(a.id)}>{a.account_number} - {a.account_name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              data-testid="general-ledger-balance"
              sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <Typography fontWeight={600} color="primary.main">Closing Balance</Typography>
              <Typography variant="h5" fontWeight={800} color="primary.main">
                {ledger ? inr(ledger.closing_balance) : "—"}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="general-ledger-error">{error}</Alert>}

      <Paper elevation={0} sx={{ overflow: "hidden", boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
        <TableContainer>
          <Table data-testid="general-ledger-table">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700, pl: 4 }}>DATE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>REF #</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>DESCRIPTION</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">DEBIT</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">CREDIT</TableCell>
                <TableCell sx={{ fontWeight: 700, pr: 4 }} align="right">BALANCE</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : !ledger || ledger.lines.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">No journal entries posted for this account.</Typography>
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
                    <TableRow key={`${row.ref}-${i}`} hover data-testid={`general-ledger-row-${row.ref}`}>
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

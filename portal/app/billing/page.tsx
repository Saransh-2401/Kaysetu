"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";

import {
  AddIcon,
  CreditCardIcon,
  FileDownloadIcon,
  GroupIcon,
  RefreshIcon,
  RemoveIcon,
} from "@/components/icons";
import {
  billingService,
  type BillingQuote,
  type BillingSummary,
  type CheckoutOrder,
  type PublicPackage,
} from "@/lib/billing-service";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment window."));
    document.body.appendChild(script);
  });
}

const inr = (value: string | number) =>
  `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const dateIN = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function BillingPage() {
  const theme = useTheme();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [packageCode, setPackageCode] = useState("");
  const [seats, setSeats] = useState(5);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await billingService.getSummary();
      setSummary(data);
      if (data.subscription) {
        setPackageCode((current) => current || data.subscription!.package_code);
        setSeats((current) => Math.max(current, data.subscription!.seats));
        setCycle(data.subscription.billing_cycle);
      }
      setSeats((current) => Math.max(current, data.seats.used));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load billing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    billingService
      .getPackages()
      .then((all) => setPackages(all.filter((p) => !p.is_addon)))
      .catch(() => setPackages([]));
  }, [load]);

  useEffect(() => {
    if (!packageCode) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      billingService
        .getQuote(packageCode, seats, cycle)
        .then((q) => !cancelled && setQuote(q))
        .catch(() => !cancelled && setQuote(null));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [packageCode, seats, cycle]);

  const sub = summary?.subscription ?? null;
  const seatsUsed = summary?.seats.used ?? 0;
  const seatLimit = summary?.seats.limit ?? null;
  const seatPct = seatLimit ? Math.min(100, (seatsUsed / seatLimit) * 100) : 0;

  const daysLeft = useMemo(() => {
    const end =
      summary?.tenant_status === "trial" ? summary?.trial_ends_at : sub?.current_period_end;
    if (!end) return null;
    return Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
  }, [summary, sub]);

  const finishSuccess = useCallback(async () => {
    setToast("Payment received — your subscription is active!");
    await load();
  }, [load]);

  const payNow = async () => {
    setPaying(true);
    setError(null);
    try {
      const order: CheckoutOrder = await billingService.checkout(packageCode, seats, cycle);
      if (order.gateway === "mock") {
        await billingService.verify(order.order_id, `mock_pay_${order.order_id}`, "mock");
        await finishSuccess();
      } else {
        await loadRazorpayScript();
        new window.Razorpay!({
          key: order.key_id,
          amount: order.amount_paise,
          currency: order.currency,
          name: "KaySetu",
          description: `${packageCode} · ${seats} users · ${cycle}`,
          order_id: order.gateway_order_id,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await billingService.verify(
                order.order_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );
              await finishSuccess();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Payment verification failed.");
            }
          },
          theme: { color: "#2C3E50" },
        }).open();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const downloadInvoice = async (paymentId: number, invoiceNo: string) => {
    try {
      await billingService.downloadInvoice(paymentId, invoiceNo);
    } catch {
      setToast("Could not download the invoice — try again.");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
        <CircularProgress data-testid="billing-loading-spinner" />
      </Box>
    );
  }

  const statusChip = (() => {
    const status = summary?.tenant_status ?? "";
    const map: Record<string, "success" | "info" | "warning" | "error"> = {
      active: "success",
      trial: "info",
      suspended: "error",
    };
    return (
      <Chip
        size="small"
        label={status.toUpperCase()}
        color={map[status] ?? "warning"}
        sx={{ fontWeight: 700 }}
        data-testid="billing-tenant-status-chip"
      />
    );
  })();

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }} data-testid="billing-page-container">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <CreditCardIcon color="primary" />
        <Typography variant="h4" fontWeight={800}>
          Plan & Billing
        </Typography>
        {statusChip}
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh">
          <IconButton onClick={load} data-testid="billing-refresh-btn">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Your subscription, user seats and GST invoices.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} data-testid="billing-error-alert">
          {error}
        </Alert>
      )}

      {/* Renewal / trial / suspension banner */}
      {summary?.tenant_status === "trial" && daysLeft !== null && (
        <Alert severity={daysLeft <= 3 ? "warning" : "info"} sx={{ mb: 2 }} data-testid="billing-trial-banner">
          Trial — {Math.max(0, daysLeft)} day{daysLeft === 1 ? "" : "s"} remaining. Subscribe below to keep your
          workspace running.
        </Alert>
      )}
      {sub?.status === "past_due" && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="billing-pastdue-banner">
          Your subscription period ended on {dateIN(sub.current_period_end)}. Pay within{" "}
          {summary?.grace_days} grace day{(summary?.grace_days ?? 0) === 1 ? "" : "s"} to avoid suspension.
        </Alert>
      )}
      {sub?.status === "active" && daysLeft !== null && daysLeft <= 7 && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="billing-renewal-banner">
          Your {sub.billing_cycle} subscription renews in {daysLeft} day{daysLeft === 1 ? "" : "s"} (
          {dateIN(sub.current_period_end)}). Pay below to extend it.
        </Alert>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ mb: 2.5 }}>
        {/* Current plan */}
        <Paper sx={{ p: 2.5, flex: 1, borderRadius: 3 }} data-testid="billing-current-plan-card">
          <Typography variant="overline" color="text.secondary">
            Current plan
          </Typography>
          {sub ? (
            <>
              <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }} data-testid="billing-current-package-text">
                {sub.package_name}{" "}
                <Typography component="span" color="text.secondary" variant="body2">
                  ({sub.package_code})
                </Typography>
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Chip size="small" variant="outlined" label={sub.billing_cycle} />
                <Chip
                  size="small"
                  variant="outlined"
                  color={sub.status === "active" ? "success" : sub.status === "past_due" ? "error" : "default"}
                  label={sub.status.replace(/_/g, " ")}
                  data-testid="billing-subscription-status-chip"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Period ends: <strong>{dateIN(sub.current_period_end)}</strong>
              </Typography>
            </>
          ) : (
            <Typography sx={{ mt: 1 }} color="text.secondary" data-testid="billing-no-subscription-text">
              No paid subscription yet — you are on the free trial.
            </Typography>
          )}
        </Paper>

        {/* Seats */}
        <Paper sx={{ p: 2.5, flex: 1, borderRadius: 3 }} data-testid="billing-seats-card">
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupIcon color="primary" fontSize="small" />
            <Typography variant="overline" color="text.secondary">
              User seats
            </Typography>
          </Stack>
          <Typography variant="h5" fontWeight={800} data-testid="billing-seats-usage-text">
            {seatsUsed} <Typography component="span" variant="h6" color="text.secondary">of {seatLimit ?? "∞"} used</Typography>
          </Typography>
          <LinearProgress
            variant="determinate"
            value={seatPct}
            color={seatPct >= 100 ? "error" : seatPct >= 80 ? "warning" : "primary"}
            sx={{ my: 1.5, height: 8, borderRadius: 4 }}
            data-testid="billing-seats-progress"
          />
          <Typography variant="body2" color="text.secondary">
            {seatLimit !== null && seatsUsed >= seatLimit
              ? "All seats are in use — buy more below to add users."
              : "Each active user consumes one seat."}
          </Typography>
        </Paper>
      </Stack>

      {/* Subscribe / change plan */}
      <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2.5 }} data-testid="billing-subscribe-card">
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          {sub ? "Renew / change plan" : "Subscribe"}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
          <TextField
            select
            label="Package"
            size="small"
            value={packageCode}
            onChange={(e) => setPackageCode(e.target.value)}
            sx={{ minWidth: 260 }}
            data-testid="billing-package-select"
          >
            {packages.map((plan) => (
              <MenuItem key={plan.code} value={plan.code} data-testid={`billing-package-option-${plan.code}`}>
                {plan.name} — {inr(plan.base_price_monthly)}/mo
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <IconButton
              size="small"
              onClick={() => setSeats((s) => Math.max(seatsUsed || 1, s - 1))}
              data-testid="billing-seats-minus-btn"
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
            <TextField
              label="Seats"
              size="small"
              type="number"
              value={seats}
              onChange={(e) => setSeats(Math.max(seatsUsed || 1, Number(e.target.value) || 1))}
              sx={{ width: 92 }}
              inputProps={{ min: seatsUsed || 1, "data-testid": "billing-seats-input" }}
            />
            <IconButton size="small" onClick={() => setSeats((s) => s + 1)} data-testid="billing-seats-plus-btn">
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={cycle}
            onChange={(_, value) => value && setCycle(value)}
          >
            <ToggleButton value="monthly" data-testid="billing-cycle-monthly-btn">
              Monthly
            </ToggleButton>
            <ToggleButton value="annual" data-testid="billing-cycle-annual-btn">
              Annual
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {quote && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
              maxWidth: 460,
            }}
            data-testid="billing-quote-box"
          >
            <Stack spacing={0.75}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">
                  {quote.package_name} base ({quote.included_users} users incl.)
                </Typography>
                <Typography variant="body2">{inr(quote.base)}</Typography>
              </Stack>
              {quote.extra_users > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">
                    Extra seats × {quote.extra_users} @ {inr(quote.per_user_unit)}
                  </Typography>
                  <Typography variant="body2">{inr(quote.extra_amount)}</Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  GST @ {quote.tax_rate}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {inr(quote.tax)}
                </Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={800}>
                  Total / {cycle === "annual" ? "year" : "month"}
                </Typography>
                <Typography fontWeight={800} data-testid="billing-quote-total-text">
                  {inr(quote.total)}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        )}

        <Button
          variant="contained"
          size="large"
          disabled={paying || !packageCode}
          onClick={payNow}
          startIcon={paying ? undefined : <CreditCardIcon />}
          data-testid="billing-pay-btn"
        >
          {paying ? <CircularProgress size={24} color="inherit" /> : "Pay securely"}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Payments are processed by Razorpay. Your plan activates instantly after payment.
        </Typography>
      </Paper>

      {/* Payment history */}
      <Paper sx={{ p: 2.5, borderRadius: 3 }} data-testid="billing-history-card">
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
          Payment history & invoices
        </Typography>
        <TableContainer>
          <Table size="small" data-testid="billing-history-table">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Package</TableCell>
                <TableCell align="center">Seats</TableCell>
                <TableCell>Cycle</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(summary?.payments ?? []).map((payment) => (
                <TableRow key={payment.id} hover data-testid={`billing-payment-row-${payment.id}`}>
                  <TableCell>{dateIN(payment.paid_at || payment.created_at)}</TableCell>
                  <TableCell>{payment.package}</TableCell>
                  <TableCell align="center">{payment.seats}</TableCell>
                  <TableCell>{payment.cycle}</TableCell>
                  <TableCell align="right">{inr(payment.total)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={payment.status}
                      color={
                        payment.status === "paid"
                          ? "success"
                          : payment.status === "failed"
                            ? "error"
                            : "default"
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    {payment.invoice_no ? (
                      <Tooltip title={`Download ${payment.invoice_no}`}>
                        <IconButton
                          size="small"
                          onClick={() => downloadInvoice(payment.id, payment.invoice_no!)}
                          data-testid={`billing-invoice-download-btn-${payment.id}`}
                        >
                          <FileDownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        —
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(summary?.payments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                      No payments yet — your first invoice appears here after you subscribe.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        data-testid="billing-toast"
      />
    </Box>
  );
}

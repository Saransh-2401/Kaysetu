"use client";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Snackbar,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { api, updatePortalOrg, type PortalContext, type PublicPackage } from "@/lib/api";

interface Summary {
  tenant_status: string;
  trial_ends_at: string | null;
  subscription: {
    package_code: string; package_name: string; seats: number;
    billing_cycle: string; status: string; current_period_end: string | null;
  } | null;
  payments: {
    id: number; package: string; seats: number; cycle: string;
    total: string; status: string; paid_at: string | null; created_at: string;
  }[];
}

interface Quote {
  subtotal: string; tax: string; total: string; tax_rate: number;
  extra_users: number; included_users: number;
}

interface CheckoutResponse {
  order_id: number; gateway: string; gateway_order_id: string;
  key_id: string; amount_paise: number; currency: string;
}

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
    script.onerror = () => reject(new Error("Could not load payment window."));
    document.body.appendChild(script);
  });
}

export default function BillingPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [packageCode, setPackageCode] = useState("");
  const [seats, setSeats] = useState(5);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Summary>("portal", "/t/billing")
      .then((data) => {
        setSummary(data);
        if (data.subscription) {
          setPackageCode((code) => code || data.subscription!.package_code);
          setSeats(data.subscription.seats);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
    api<PublicPackage[]>(null, "/public/packages")
      .then((all) => setPackages(all.filter((p) => !p.is_addon)))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!packageCode) return;
    api<Quote>("portal", `/t/billing/quote?package=${packageCode}&seats=${seats}&cycle=${cycle}`)
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [packageCode, seats, cycle]);

  const finishSuccess = useCallback(async () => {
    setToast("Payment received — your subscription is active!");
    load();
    const me = await api<PortalContext & { scope: string }>("portal", "/me");
    updatePortalOrg({ modules: me.org.modules, status: me.org.status });
  }, [load]);

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const order = await api<CheckoutResponse>("portal", "/t/billing/checkout", {
        method: "POST",
        body: { package_code: packageCode, seats, cycle },
      });
      if (order.gateway === "mock") {
        await api("portal", "/t/billing/verify", {
          method: "POST",
          body: { order_id: order.order_id, payment_id: `mock_pay_${order.order_id}`, signature: "mock" },
        });
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
            razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string;
          }) => {
            await api("portal", "/t/billing/verify", {
              method: "POST",
              body: {
                order_id: order.order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              },
            });
            await finishSuccess();
          },
          theme: { color: "#2C3E50" },
        }).open();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!summary) return null;
  const sub = summary.subscription;

  return (
    <Box sx={{ maxWidth: 860 }} data-testid="portal-billing-container">
      <Typography variant="h5" gutterBottom>
        Billing & Subscription
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="portal-billing-error-alert">{error}</Alert>}

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="portal-billing-current-card">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <CreditCardIcon color="primary" />
            <Typography variant="h6">Current plan</Typography>
            <Chip size="small" label={summary.tenant_status}
              color={summary.tenant_status === "active" ? "success" : summary.tenant_status === "trial" ? "info" : "warning"}
              data-testid="portal-billing-status-chip" />
          </Stack>
          {sub ? (
            <Typography color="text.secondary">
              {sub.package_name} ({sub.package_code}) · {sub.seats} users · {sub.billing_cycle} · {sub.status}
              {sub.current_period_end &&
                ` · renews ${new Date(sub.current_period_end).toLocaleDateString("en-IN")}`}
            </Typography>
          ) : (
            <Typography color="text.secondary">No subscription yet.</Typography>
          )}
          {summary.tenant_status === "trial" && summary.trial_ends_at && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Trial ends {new Date(summary.trial_ends_at).toLocaleDateString("en-IN")} — subscribe below to keep everything running.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="portal-billing-subscribe-card">
        <CardContent>
          <Typography variant="h6" gutterBottom>Subscribe / change plan</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField select label="Package" value={packageCode} sx={{ minWidth: 240 }}
              onChange={(e) => setPackageCode(e.target.value)} data-testid="portal-billing-package-select">
              {packages.map((plan) => (
                <MenuItem key={plan.code} value={plan.code} data-testid={`portal-billing-package-option-${plan.code}`}>
                  {plan.name} — ₹{Number(plan.base_price_monthly).toLocaleString("en-IN")}/mo
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Users" type="number" value={seats} sx={{ width: 120 }}
              onChange={(e) => setSeats(Math.max(1, Number(e.target.value)))}
              inputProps={{ "data-testid": "portal-billing-seats-input", min: 1 }} />
            <ToggleButtonGroup exclusive value={cycle} onChange={(_, value) => value && setCycle(value)}>
              <ToggleButton value="monthly" data-testid="portal-billing-cycle-monthly-btn">Monthly</ToggleButton>
              <ToggleButton value="annual" data-testid="portal-billing-cycle-annual-btn">Annual</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {quote && (
            <Alert icon={false} severity="success" sx={{ mb: 2 }} data-testid="portal-billing-quote-box">
              Subtotal ₹{Number(quote.subtotal).toLocaleString("en-IN")}
              {quote.extra_users > 0 && ` (includes ${quote.extra_users} extra users)`}
              {" + "}GST {quote.tax_rate}% ₹{Number(quote.tax).toLocaleString("en-IN")} ={" "}
              <strong data-testid="portal-billing-total-text">
                ₹{Number(quote.total).toLocaleString("en-IN")}
              </strong>{" "}
              / {cycle === "annual" ? "year" : "month"}
            </Alert>
          )}

          <Button variant="contained" size="large" disabled={busy || !packageCode} onClick={subscribe}
            data-testid="portal-billing-subscribe-btn">
            {busy ? <CircularProgress size={26} color="inherit" /> : "Subscribe & pay"}
          </Button>
        </CardContent>
      </Card>

      <Card variant="outlined" data-testid="portal-billing-history-card">
        <CardContent>
          <Typography variant="h6" gutterBottom>Payment history</Typography>
          <Table size="small" data-testid="portal-billing-history-table">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Package</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Cycle</TableCell>
                <TableCell align="right">Total (₹)</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.payments.map((payment) => (
                <TableRow key={payment.id} data-testid={`portal-billing-payment-row-${payment.id}`}>
                  <TableCell>{new Date(payment.created_at).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>{payment.package}</TableCell>
                  <TableCell>{payment.seats}</TableCell>
                  <TableCell>{payment.cycle}</TableCell>
                  <TableCell align="right">{Number(payment.total).toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Chip size="small" label={payment.status}
                      color={payment.status === "paid" ? "success" : payment.status === "failed" ? "error" : "default"} />
                  </TableCell>
                </TableRow>
              ))}
              {summary.payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">No payments yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Snackbar open={toast !== null} autoHideDuration={3500} onClose={() => setToast(null)}
        message={toast} data-testid="portal-billing-toast" />
    </Box>
  );
}

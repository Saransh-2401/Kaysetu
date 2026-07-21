import LaunchIcon from "@mui/icons-material/Launch";
import VerifiedIcon from "@mui/icons-material/Verified";
import {
  AppBar, Box, Button, Card, CardContent, Chip, Container, Divider,
  Stack, Toolbar, Typography,
} from "@mui/material";
import Link from "next/link";

import type { PublicPackage } from "@/lib/api";

// SSR runs inside the container/pod — API_BASE_INTERNAL points at the backend
// service there; the browser-facing NEXT_PUBLIC_API_BASE is the fallback.
const API_BASE =
  process.env.API_BASE_INTERNAL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  "http://127.0.0.1:8000/api";

async function loadPackages(): Promise<PublicPackage[]> {
  try {
    const response = await fetch(`${API_BASE}/public/packages`, { cache: "no-store" });
    if (!response.ok) return [];
    return (await response.json()) as PublicPackage[];
  } catch {
    return [];
  }
}

const MODULE_LABELS: Record<string, string> = {
  TRACK: "Live Tracking", FIELD: "Field Sales", ORDERS: "Orders & Dispatch",
  DIST: "Distribution", INV: "Inventory", PROD: "Production", PURCH: "Procurement",
  BOOKS: "Accounts & GST", CRM: "Leads", ATT: "Attendance & Leave", TA: "Travel Allowance",
};

export default async function MarketingPage() {
  const packages = await loadPackages();
  const plans = packages.filter((p) => !p.is_addon);
  const addons = packages.filter((p) => p.is_addon);

  return (
    <Box data-testid="marketing-page-container">
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, letterSpacing: 1 }}>
            KAYSETU
          </Typography>
          <Button color="inherit" component={Link} href="/portal/login" data-testid="marketing-portal-login-btn">
            Sign in
          </Button>
          <Button
            variant="contained"
            color="secondary"
            component={Link}
            href="/signup"
            sx={{ ml: 1 }}
            data-testid="marketing-getstarted-btn"
          >
            Get started
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 8, textAlign: "center" }}>
        <Typography variant="h3" fontWeight={800} gutterBottom data-testid="marketing-hero-title">
          Run your field business, your way.
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 720, mx: "auto" }}>
          Tracking, field sales, orders, inventory, production and GST-ready accounts —
          sold as modules. Buy only what you need. Add the rest when you grow.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
          <Button variant="contained" size="large" component={Link} href="/signup" data-testid="marketing-hero-cta-btn">
            Start free trial
          </Button>
          <Button variant="outlined" size="large" component={Link} href="/portal/login" data-testid="marketing-hero-signin-btn">
            I already have an org code
          </Button>
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ pb: 10 }} id="pricing">
        <Typography variant="h4" textAlign="center" gutterBottom data-testid="pricing-section-title">
          Simple, modular pricing
        </Typography>
        <Typography textAlign="center" color="text.secondary" sx={{ mb: 5 }}>
          Every plan starts with a 14-day free trial. Prices in ₹ per month.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" },
          }}
          data-testid="pricing-plans-grid"
        >
          {plans.map((plan) => (
            <Card key={plan.code} variant="outlined" data-testid={`pricing-card-${plan.code}`} sx={{ display: "flex" }}>
              <CardContent sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
                <Typography variant="overline" color="secondary.dark">
                  {plan.code}
                </Typography>
                <Typography variant="h6">{plan.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 60 }}>
                  {plan.tagline}
                </Typography>
                <Typography variant="h4" sx={{ my: 1 }} data-testid={`pricing-price-${plan.code}`}>
                  ₹{Number(plan.base_price_monthly).toLocaleString("en-IN")}
                  <Typography component="span" variant="body2" color="text.secondary">
                    /mo
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {plan.included_users} users included · ₹{plan.per_user_price}/extra user
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 2 }}>
                  {plan.modules.map((m) => (
                    <Chip
                      key={m}
                      size="small"
                      icon={<VerifiedIcon />}
                      label={MODULE_LABELS[m] ?? m}
                      data-testid={`pricing-module-chip-${plan.code}-${m}`}
                    />
                  ))}
                </Stack>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ mt: "auto" }}
                  component={Link}
                  href={`/signup?package=${plan.code}`}
                  endIcon={<LaunchIcon />}
                  data-testid={`pricing-choose-btn-${plan.code}`}
                >
                  Choose {plan.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>

        {addons.length > 0 && (
          <Box sx={{ mt: 6 }}>
            <Typography variant="h6" gutterBottom>
              Add-ons
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} data-testid="pricing-addons-row">
              {addons.map((addon) => (
                <Chip
                  key={addon.code}
                  label={`${addon.name} — ₹${Number(addon.base_price_monthly).toLocaleString("en-IN")}/mo`}
                  variant="outlined"
                  data-testid={`pricing-addon-chip-${addon.code}`}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Container>

      <Box component="footer" sx={{ py: 4, bgcolor: "primary.main", color: "white", textAlign: "center" }}>
        <Typography variant="body2">© {new Date().getFullYear()} KaySetu · Made for Indian businesses</Typography>
      </Box>
    </Box>
  );
}

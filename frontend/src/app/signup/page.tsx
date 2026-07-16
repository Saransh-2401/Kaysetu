"use client";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Container,
  IconButton, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { api, ApiError, type PublicPackage } from "@/lib/api";

const INDUSTRIES = [
  { value: "manufacturing", label: "Manufacturing" },
  { value: "distribution", label: "Distribution & FMCG" },
  { value: "services", label: "Services / Insurance" },
  { value: "generic", label: "Other" },
];

interface SignupResult {
  org_code: string;
  status: string;
  trial_ends_at: string;
  portal_url: string;
  login_email: string;
}

function SignupForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [form, setForm] = useState({
    company_name: "",
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    password: "",
    package_code: params.get("package") ?? "P2",
    industry: "generic",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);

  useEffect(() => {
    api<PublicPackage[]>(null, "/public/packages")
      .then((all) => setPackages(all.filter((p) => !p.is_addon)))
      .catch(() => setPackages([]));
  }, []);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<SignupResult>(null, "/public/signup", { method: "POST", body: form });
      setResult(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Card data-testid="signup-success-card">
        <CardContent sx={{ textAlign: "center", py: 6 }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
          <Typography variant="h5" sx={{ mt: 2 }}>
            Your workspace is ready!
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Your organization code — your team signs in with it:
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ my: 2 }}>
            <Typography variant="h3" fontWeight={800} letterSpacing={2} data-testid="signup-orgcode-text">
              {result.org_code}
            </Typography>
            <IconButton
              onClick={() => navigator.clipboard.writeText(result.org_code)}
              aria-label="Copy organization code"
              data-testid="signup-orgcode-copy-btn"
            >
              <ContentCopyIcon />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Trial active until {new Date(result.trial_ends_at).toLocaleDateString("en-IN")}. We also
            emailed this to {result.login_email}.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push("/portal/login")}
            data-testid="signup-goto-portal-btn"
          >
            Sign in to your portal
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="signup-form-card">
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Start your 14-day free trial
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No card needed. Your workspace is created instantly.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="signup-error-alert">
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2}>
            <TextField label="Company name" required value={form.company_name} onChange={set("company_name")}
              inputProps={{ "data-testid": "signup-company-input" }} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Your name" required fullWidth value={form.owner_name} onChange={set("owner_name")}
                inputProps={{ "data-testid": "signup-name-input" }} />
              <TextField label="Phone" fullWidth value={form.owner_phone} onChange={set("owner_phone")}
                inputProps={{ "data-testid": "signup-phone-input" }} />
            </Stack>
            <TextField label="Work email" type="email" required value={form.owner_email} onChange={set("owner_email")}
              inputProps={{ "data-testid": "signup-email-input" }} />
            <TextField label="Password" type="password" required helperText="Minimum 8 characters"
              value={form.password} onChange={set("password")}
              inputProps={{ "data-testid": "signup-password-input", minLength: 8 }} />
            <TextField select label="Industry" value={form.industry} onChange={set("industry")}
              data-testid="signup-industry-select">
              {INDUSTRIES.map((industry) => (
                <MenuItem key={industry.value} value={industry.value} data-testid={`signup-industry-option-${industry.value}`}>
                  {industry.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Package" value={form.package_code} onChange={set("package_code")}
              data-testid="signup-package-select">
              {(packages.length ? packages : [{ code: form.package_code, name: form.package_code, base_price_monthly: "" } as PublicPackage]).map(
                (plan) => (
                  <MenuItem key={plan.code} value={plan.code} data-testid={`signup-package-option-${plan.code}`}>
                    {plan.name}
                    {plan.base_price_monthly ? ` — ₹${Number(plan.base_price_monthly).toLocaleString("en-IN")}/mo` : ""}
                  </MenuItem>
                ),
              )}
            </TextField>
            <Button type="submit" variant="contained" size="large" disabled={busy} data-testid="signup-submit-btn">
              {busy ? <CircularProgress size={26} color="inherit" /> : "Create my workspace"}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }} data-testid="signup-page-container">
      <Typography component={Link} href="/" variant="h6" sx={{ textDecoration: "none", color: "primary.main", letterSpacing: 1 }}>
        SALEXA
      </Typography>
      <Box sx={{ mt: 3 }}>
        <Suspense>
          <SignupForm />
        </Suspense>
      </Box>
    </Container>
  );
}

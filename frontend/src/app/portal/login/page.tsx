"use client";
import StorefrontIcon from "@mui/icons-material/Storefront";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Container, Stack, TextField, Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError, setSession, type PortalContext } from "@/lib/api";

type LoginResponse = PortalContext & { access: string; refresh: string };

export default function PortalLoginPage() {
  const router = useRouter();
  const [orgCode, setOrgCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<LoginResponse>(null, "/auth/tenant/login", {
        method: "POST",
        body: { org_code: orgCode.trim(), email: email.trim(), password },
      });
      setSession("portal", data, { user: data.user, org: data.org });
      router.push("/portal");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <Card sx={{ width: "100%" }} data-testid="portal-login-card">
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <StorefrontIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h5" gutterBottom>
            Sign in to Salexa
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Use the organization code your company received.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: "left" }} data-testid="portal-login-error-alert">
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label="Organization code" required placeholder="SLX-XXXXXX" value={orgCode}
                onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                inputProps={{ "data-testid": "portal-login-orgcode-input", style: { textTransform: "uppercase" } }} />
              <TextField label="Email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputProps={{ "data-testid": "portal-login-email-input" }} />
              <TextField label="Password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                inputProps={{ "data-testid": "portal-login-password-input" }} />
              <Button type="submit" variant="contained" size="large" disabled={busy}
                data-testid="portal-login-submit-btn">
                {busy ? <CircularProgress size={26} color="inherit" /> : "Sign in"}
              </Button>
            </Stack>
          </Box>
          <Typography variant="body2" sx={{ mt: 3 }}>
            New here?{" "}
            <Link href="/signup" data-testid="portal-login-signup-link">
              Start a free trial
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}

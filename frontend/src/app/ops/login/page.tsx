"use client";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Container, Stack, TextField, Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError, setSession } from "@/lib/api";

interface AdminLoginResponse {
  access: string;
  refresh: string;
  user: { id: number; email: string; full_name: string; admin_role: string };
}

export default function OpsLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<AdminLoginResponse>(null, "/auth/admin/login", {
        method: "POST",
        body: { email, password },
      });
      setSession("ops", data, data.user);
      router.push("/ops");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <Card sx={{ width: "100%" }} data-testid="ops-login-card">
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <AdminPanelSettingsIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h5" gutterBottom>
            KaySetu Ops Console
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Internal team only
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: "left" }} data-testid="ops-login-error-alert">
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label="Email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputProps={{ "data-testid": "ops-login-email-input" }} />
              <TextField label="Password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                inputProps={{ "data-testid": "ops-login-password-input" }} />
              <Button type="submit" variant="contained" size="large" disabled={busy} data-testid="ops-login-submit-btn">
                {busy ? <CircularProgress size={26} color="inherit" /> : "Sign in"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

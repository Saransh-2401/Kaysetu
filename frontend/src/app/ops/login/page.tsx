"use client";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LockIcon from "@mui/icons-material/LockOutlined";
import ShieldIcon from "@mui/icons-material/GppGood";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { enterSx } from "@/components/ui/kit";
import { RADIUS } from "@/theme";
import { api, ApiError, setSession } from "@/lib/api";

interface AdminLoginResponse {
  access: string;
  refresh: string;
  user: { id: number; email: string; full_name: string; admin_role: string };
}

export default function OpsLoginPage() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gold = theme.palette.secondary.main;
  const goldDark = theme.palette.secondary.dark;

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
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 6,
        position: "relative",
        overflow: "hidden",
        // Deep navy field with two soft gold glows — the console's front door
        // should feel like the operator side of the product, not the tenant app.
        background: `linear-gradient(150deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.primary.dark} 100%)`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "-14%",
          right: "-8%",
          width: 460,
          height: 460,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(gold, 0.22)} 0%, transparent 68%)`,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: "-18%",
          left: "-10%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(gold, 0.14)} 0%, transparent 68%)`,
        }}
      />

      <Box sx={{ position: "relative", width: "100%", maxWidth: 408, ...enterSx(0) }}>
        {/* Brand */}
        <Stack alignItems="center" spacing={0.5} sx={{ mb: 3 }}>
          <Typography
            variant="h4"
            sx={{
              fontSize: "2rem",
              letterSpacing: "0.06em",
              display: "flex",
              alignItems: "center",
              background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            KAYSETU
            <Box
              component="span"
              sx={{
                width: 7,
                height: 7,
                ml: 0.6,
                mb: 1.8,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${gold}, ${goldDark})`,
                boxShadow: `0 0 12px ${alpha(gold, 0.8)}`,
              }}
            />
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <ShieldIcon sx={{ fontSize: 14, color: alpha(gold, 0.85) }} />
            <Typography
              variant="overline"
              sx={{ color: alpha("#fff", 0.82), letterSpacing: "0.18em", fontSize: "0.62rem" }}
            >
              Ops Console
            </Typography>
          </Stack>
        </Stack>

        {/* Card */}
        <Box
          data-testid="ops-login-card"
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: RADIUS.lg,
            bgcolor: alpha("#fff", 0.97),
            border: `1px solid ${alpha(gold, 0.28)}`,
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.32)",
          }}
        >
          <Stack alignItems="center" spacing={1.25} sx={{ mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: RADIUS.md,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: theme.palette.primary.main,
                background: `linear-gradient(135deg, ${alpha(gold, 0.34)}, ${alpha(gold, 0.14)})`,
                border: `1px solid ${alpha(gold, 0.4)}`,
              }}
            >
              <AdminPanelSettingsIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                Sign in to continue
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Internal platform team only
              </Typography>
            </Box>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} data-testid="ops-login-error-alert">
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={submit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                required
                fullWidth
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                slotProps={{
                  htmlInput: { "data-testid": "ops-login-email-input", inputMode: "email" },
                }}
              />
              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                required
                fullWidth
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{
                  htmlInput: { "data-testid": "ops-login-password-input" },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          edge="end"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          data-testid="ops-login-password-toggle"
                        >
                          {showPassword ? (
                            <VisibilityOff sx={{ fontSize: 18 }} />
                          ) : (
                            <Visibility sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={busy || !email || !password}
                data-testid="ops-login-submit-btn"
                sx={{ height: 46, fontSize: "0.95rem" }}
              >
                {busy ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
              </Button>
            </Stack>
          </Box>

          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75} sx={{ mt: 2.5 }}>
            <LockIcon sx={{ fontSize: 13, color: "text.disabled" }} />
            <Typography variant="caption" color="text.disabled">
              Every action in this console is audit-logged.
            </Typography>
          </Stack>
        </Box>

        <Typography
          variant="caption"
          sx={{ display: "block", textAlign: "center", mt: 2.5, color: alpha("#fff", 0.7) }}
        >
          Tenant users sign in at app.kaysetu.in
        </Typography>
      </Box>
    </Box>
  );
}

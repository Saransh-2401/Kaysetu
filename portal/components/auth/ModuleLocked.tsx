"use client";
/**
 * Shown instead of a page whose sellable module the tenant has not bought.
 *
 * Deliberately an honest "locked" state rather than a silent redirect: the user
 * sees what the module does and how to get it, instead of a broken-looking page
 * full of 403s (which is what rendered before this guard existed).
 */
import { Box, Button, Paper, Stack, Typography, Chip, useTheme, alpha } from "@mui/material";
import { useRouter } from "next/navigation";
import { MODULE_META, type ModuleCode } from "@/lib/route-modules";

export default function ModuleLocked({ module }: { module: ModuleCode }) {
  const theme = useTheme();
  const router = useRouter();
  const meta = MODULE_META[module] ?? { name: module, description: "" };

  return (
    <Box
      data-testid="module-locked-screen"
      data-module={module}
      sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", p: 3 }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 560, width: "100%", p: { xs: 3, sm: 5 }, textAlign: "center", borderRadius: 4,
          border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
          position: "relative", overflow: "hidden",
          "&::before": {
            content: '""', position: "absolute", left: 0, right: 0, top: 0, height: 4,
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          },
        }}
      >
        <Box
          sx={{
            width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2.5,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            color: theme.palette.primary.main, fontSize: 30,
          }}
          aria-hidden
        >
          🔒
        </Box>

        <Chip
          label={`${module} · not in your plan`}
          size="small"
          sx={{ mb: 2, fontWeight: 700, bgcolor: alpha(theme.palette.secondary.main, 0.12), color: theme.palette.secondary.dark }}
        />

        <Typography variant="h5" fontWeight={800} gutterBottom sx={{ letterSpacing: "-0.02em" }}>
          {meta.name}
        </Typography>

        {meta.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 420, mx: "auto" }}>
            {meta.description}
          </Typography>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
          This section isn&apos;t part of your current plan. Add the{" "}
          <Box component="strong" sx={{ color: "text.primary" }}>{meta.name}</Box> module to unlock it.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            data-testid="module-locked-upgrade-btn"
            onClick={() => router.push("/billing")}
            sx={{ fontWeight: 700, px: 3 }}
          >
            View plans &amp; upgrade
          </Button>
          <Button
            variant="outlined"
            size="large"
            data-testid="module-locked-back-btn"
            onClick={() => router.back()}
            sx={{ fontWeight: 600, px: 3 }}
          >
            Go back
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

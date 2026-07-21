"use client";

import React from "react";
import { Box, Paper, Stack, Typography, Chip, useTheme, alpha } from "@mui/material";
import { LockIcon } from "@/components/icons";

/**
 * Shown in place of a feature that needs a module the tenant hasn't bought.
 * Instead of letting the UI call the endpoint and 403, we render a calm
 * "upgrade to unlock" panel — the feature is real, it's just not on the plan.
 *
 * Keep the message honest: upgrades are handled by the KaySetu team / the org
 * owner's plan, so we point there rather than faking a self-serve checkout.
 */
export default function ModuleUpgradeNotice({
    feature,
    moduleName,
    moduleCode,
    testId = "module-upgrade-notice",
    compact = false,
}: {
    /** What the user was trying to use, e.g. "Office Staff attendance". */
    feature: string;
    /** Human name of the module, e.g. "Attendance & Leave". */
    moduleName: string;
    /** Short code shown as a chip, e.g. "ATT". */
    moduleCode?: string;
    testId?: string;
    /** Tighter padding for use inside a tab/section rather than a whole page. */
    compact?: boolean;
}) {
    const theme = useTheme();
    const gold = theme.palette.secondary.main;

    return (
        <Box
            data-testid={testId}
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                py: compact ? 4 : 8,
                px: 2,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    maxWidth: 460,
                    width: "100%",
                    textAlign: "center",
                    p: compact ? 3 : 4,
                    borderRadius: 4,
                    border: `1px solid ${alpha(gold, 0.35)}`,
                    background: `linear-gradient(180deg, ${alpha(gold, 0.06)} 0%, ${alpha(
                        theme.palette.background.paper,
                        1
                    )} 60%)`,
                }}
            >
                <Stack alignItems="center" spacing={1.5}>
                    <Box
                        sx={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: `linear-gradient(135deg, ${gold} 0%, ${alpha(gold, 0.7)} 100%)`,
                            boxShadow: `0 8px 24px ${alpha(gold, 0.35)}`,
                        }}
                    >
                        <LockIcon sx={{ fontSize: 30, color: theme.palette.primary.main }} />
                    </Box>

                    {moduleCode && (
                        <Chip
                            label={`${moduleCode} module`}
                            size="small"
                            data-testid={`${testId}-module-chip`}
                            sx={{
                                fontWeight: 700,
                                letterSpacing: 0.4,
                                color: theme.palette.primary.main,
                                bgcolor: alpha(gold, 0.18),
                                border: `1px solid ${alpha(gold, 0.4)}`,
                            }}
                        />
                    )}

                    <Typography variant="h6" fontWeight={800}>
                        {feature} is locked
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
                        {feature} is part of the <strong>{moduleName}</strong> module, which isn&apos;t
                        included in your current plan. Upgrade your plan to unlock it.
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5, fontStyle: "italic" }}
                        data-testid={`${testId}-hint`}
                    >
                        Contact your account administrator to add the {moduleName} module.
                    </Typography>
                </Stack>
            </Paper>
        </Box>
    );
}

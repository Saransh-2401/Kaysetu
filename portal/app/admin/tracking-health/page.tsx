"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
    Box, Card, Chip, CircularProgress, IconButton, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography, alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { RefreshIcon, GpsFixedIcon } from "@/components/icons";
import { apiClient } from "@/lib/api-client";

interface AgentHealth {
    agent_id: number;
    agent_name: string;
    punched_in: boolean;
    last_location_at: string | null;
    last_location_min_ago: number | null;
    last_seen_min_ago: number | null;
    points_today: number;
    mock_detected: boolean;
    device_model: string;
    os_version: string;
    app_version: string;
    battery_opt_granted: boolean | null;
    location_permission: string | null;
    location_accuracy: string | null;
    watchdog_restarts_today: number;
    latest_event: string | null;
}

const ONLINE_WINDOW_MIN = 6;

function minAgo(m: number | null): string {
    if (m === null || m === undefined) return "never";
    if (m <= 0) return "just now";
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

export default function TrackingHealthPage() {
    const theme = useTheme();
    const [agents, setAgents] = useState<AgentHealth[]>([]);
    const [asOf, setAsOf] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res: any = await apiClient.get("/t/track/tracking-health");
            setAgents(res?.agents ?? []);
            setAsOf(res?.as_of ?? "");
            setError(null);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load tracking health");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(load, 30000); // auto-refresh every 30s
        return () => clearInterval(t);
    }, [load]);

    const online = agents.filter(
        (a) => a.last_location_min_ago !== null &&
            a.last_location_min_ago <= ONLINE_WINDOW_MIN).length;
    const issues = agents.filter(
        (a) => a.battery_opt_granted === false || a.mock_detected ||
            a.location_accuracy === "reduced" || a.watchdog_restarts_today > 0).length;

    const yesNo = (v: boolean | null, goodWhenTrue = true) => {
        if (v === null || v === undefined)
            return <Chip label="?" size="small" sx={{ height: 20 }} />;
        const good = goodWhenTrue ? v : !v;
        return (
            <Chip
                label={v ? "Yes" : "No"}
                size="small"
                sx={{
                    height: 20, fontWeight: 700,
                    bgcolor: good ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.error.main, 0.12),
                    color: good ? theme.palette.success.main : theme.palette.error.main,
                }}
            />
        );
    };

    return (
        <Box sx={{ p: 3 }} data-testid="tracking-health-page">
            <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
                <GpsFixedIcon color="primary" />
                <Typography variant="h5" fontWeight={800}>Live Tracking Health</Typography>
                <Tooltip title="Refresh">
                    <IconButton onClick={load} data-testid="tracking-health-refresh-btn">
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
                {asOf && (
                    <Typography variant="caption" color="text.secondary">
                        as of {new Date(asOf).toLocaleTimeString()} · auto-refreshes 30s
                    </Typography>
                )}
            </Stack>

            <Stack direction="row" spacing={1.5} mb={2} flexWrap="wrap">
                <Chip label={`${agents.length} punched in`} color="default" />
                <Chip label={`${online} online`} sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.main, fontWeight: 700 }} />
                <Chip label={`${agents.length - online} offline`} sx={{ bgcolor: alpha(theme.palette.error.main, 0.12), color: theme.palette.error.main, fontWeight: 700 }} />
                <Chip label={`${issues} with issues`} sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: theme.palette.warning.main, fontWeight: 700 }} />
            </Stack>

            {loading ? (
                <Stack alignItems="center" py={6}><CircularProgress /></Stack>
            ) : error ? (
                <Typography color="error">{error}</Typography>
            ) : agents.length === 0 ? (
                <Typography color="text.secondary" py={4}>No agents punched in today.</Typography>
            ) : (
                <TableContainer component={Card} variant="outlined">
                    <Table size="small" data-testid="tracking-health-table">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                                <TableCell>Agent</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Last upload</TableCell>
                                <TableCell align="right">Points</TableCell>
                                <TableCell>Device</TableCell>
                                <TableCell>Battery exempt</TableCell>
                                <TableCell>GPS perm</TableCell>
                                <TableCell>Accuracy</TableCell>
                                <TableCell align="right">Restarts</TableCell>
                                <TableCell>Mock</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {agents.map((a) => {
                                const isOnline = a.last_location_min_ago !== null &&
                                    a.last_location_min_ago <= ONLINE_WINDOW_MIN;
                                return (
                                    <TableRow
                                        key={a.agent_id}
                                        data-testid={`tracking-health-row-${a.agent_id}`}
                                        sx={{ bgcolor: isOnline ? "transparent" : alpha(theme.palette.error.main, 0.04) }}
                                    >
                                        <TableCell>
                                            <Typography fontWeight={600} fontSize={13}>{a.agent_name}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={isOnline ? "Online" : "Offline"}
                                                size="small"
                                                sx={{
                                                    height: 20, fontWeight: 700,
                                                    bgcolor: isOnline ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.text.disabled, 0.18),
                                                    color: isOnline ? theme.palette.success.main : theme.palette.text.secondary,
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{minAgo(a.last_location_min_ago)}</TableCell>
                                        <TableCell align="right">{a.points_today}</TableCell>
                                        <TableCell>
                                            <Tooltip title={`${a.os_version} · app ${a.app_version}`}>
                                                <Typography fontSize={12} noWrap maxWidth={150}>
                                                    {a.device_model || "—"}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>{yesNo(a.battery_opt_granted, true)}</TableCell>
                                        <TableCell>
                                            <Typography fontSize={12}
                                                color={a.location_permission === "always" ? "text.primary" : "error"}>
                                                {a.location_permission ?? "—"}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography fontSize={12}
                                                color={a.location_accuracy === "reduced" ? "error" : "text.primary"}>
                                                {a.location_accuracy ?? "—"}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography fontSize={12}
                                                color={a.watchdog_restarts_today > 0 ? "error" : "text.secondary"}
                                                fontWeight={a.watchdog_restarts_today > 0 ? 700 : 400}>
                                                {a.watchdog_restarts_today}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{a.mock_detected
                                            ? <Chip label="⚠ Mock" size="small" sx={{ height: 20, bgcolor: alpha(theme.palette.error.main, 0.12), color: theme.palette.error.main, fontWeight: 700 }} />
                                            : "—"}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}

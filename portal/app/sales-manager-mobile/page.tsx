"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
    Box, Typography, Stack, Avatar, Chip, CircularProgress,
    IconButton, Tooltip, useTheme, alpha, Divider,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { formatTime, formatWorkingHours } from "@/lib/office-attendance-api";
import { isAgentOnline as isOnline } from "@/lib/agentStatus";
import { RefreshIcon, LocationOnIcon, ExitToAppIcon, PeopleAltIcon, CheckCircleOutlineIcon, CancelOutlinedIcon, WifiIcon } from "@/components/icons";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentRecord {
    agent_id: number;
    agent_name: string;
    record_id: number | null;
    punch_in_time: string | null;
    punch_out_time: string | null;
    working_hours: number;
    punch_out_type: "manual" | "auto" | null;
    checked_out_by_name: string | null;
    last_seen: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateString(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
    "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];

function avatarColor(id: number) {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
    icon, label, value, color, bg,
}: {
    icon: React.ReactNode; label: string; value: number | string; color: string; bg: string;
}) {
    return (
        <Box
            data-animate-group
            sx={{
                flex: 1,
                borderRadius: "16px",
                p: 2,
                background: bg,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}
        >
            <Box sx={{ color, fontSize: 22 }}>{icon}</Box>
            <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1 }}>
                {value}
            </Typography>
            <Typography variant="caption" sx={{ color, opacity: 0.75, fontWeight: 600, textAlign: "center", fontSize: "0.68rem" }}>
                {label}
            </Typography>
        </Box>
    );
}

function AgentCard({
    agent, onCheckOut, onTrackLocation, checkingOut,
}: {
    agent: AgentRecord;
    onCheckOut: (id: number) => void;
    onTrackLocation: (id: number) => void;
    checkingOut: number | null;
}) {
    const theme = useTheme();
    const online = isOnline(agent.last_seen);
    const present = Boolean(agent.punch_in_time);
    const done = Boolean(agent.punch_out_time);
    const color = avatarColor(agent.agent_id);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
        >
            <Box
                sx={{
                    borderRadius: "20px",
                    background: theme.palette.background.paper,
                    boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
                    border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    overflow: "hidden",
                }}
            >
                {/* Top strip */}
                <Box sx={{ height: 4, background: present ? (done ? alpha(theme.palette.text.disabled, 0.3) : `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`) : alpha(theme.palette.error.main, 0.3) }} />

                <Box sx={{ p: 2 }}>
                    {/* Header row */}
                    <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
                        <Avatar
                            sx={{
                                width: 44,
                                height: 44,
                                bgcolor: alpha(color, 0.15),
                                color,
                                fontWeight: 800,
                                fontSize: "1rem",
                            }}
                        >
                            {getInitials(agent.agent_name)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                variant="subtitle2"
                                fontWeight={700}
                                noWrap
                                sx={{ lineHeight: 1.2 }}
                            >
                                {agent.agent_name}
                            </Typography>
                            <Stack direction="row" spacing={0.5} mt={0.4} flexWrap="wrap">
                                {/* Attendance status */}
                                <Chip
                                    label={!present ? "Absent" : done ? "Checked Out" : "Present"}
                                    size="small"
                                    sx={{
                                        height: 18,
                                        fontSize: "0.6rem",
                                        fontWeight: 700,
                                        bgcolor: !present
                                            ? alpha(theme.palette.error.main, 0.1)
                                            : done
                                            ? alpha(theme.palette.text.disabled, 0.1)
                                            : alpha(theme.palette.success.main, 0.12),
                                        color: !present
                                            ? "error.main"
                                            : done
                                            ? "text.disabled"
                                            : "success.dark",
                                    }}
                                />
                                {/* App status */}
                                <Chip
                                    label={online ? "Online" : "Offline"}
                                    size="small"
                                    sx={{
                                        height: 18,
                                        fontSize: "0.6rem",
                                        fontWeight: 700,
                                        bgcolor: online ? alpha("#4caf50", 0.12) : alpha(theme.palette.text.disabled, 0.08),
                                        color: online ? "success.dark" : "text.disabled",
                                    }}
                                />
                            </Stack>
                        </Box>

                        {/* Action buttons */}
                        <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Track Last Location">
                                <IconButton
                                    size="small"
                                    onClick={() => onTrackLocation(agent.agent_id)}
                                    sx={{
                                        width: 34, height: 34,
                                        bgcolor: alpha("#3b82f6", 0.1),
                                        color: "#3b82f6",
                                        borderRadius: "10px",
                                        "&:hover": { bgcolor: alpha("#3b82f6", 0.2) },
                                    }}
                                >
                                    <LocationOnIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Tooltip>
                            {present && !done ? (
                                <Tooltip title="Force Check Out">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled={checkingOut !== null}
                                            onClick={() => agent.record_id && onCheckOut(agent.record_id)}
                                            sx={{
                                                width: 34, height: 34,
                                                bgcolor: alpha(theme.palette.warning.main, 0.1),
                                                color: "warning.dark",
                                                borderRadius: "10px",
                                                "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.2) },
                                            }}
                                        >
                                            {checkingOut === agent.record_id
                                                ? <CircularProgress size={14} color="inherit" />
                                                : <ExitToAppIcon sx={{ fontSize: 18 }} />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            ) : (
                                <Box sx={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Typography variant="caption" color="text.disabled">—</Typography>
                                </Box>
                            )}
                        </Stack>
                    </Stack>

                    <Divider sx={{ mb: 1.5, opacity: 0.5 }} />

                    {/* Time row */}
                    <Stack direction="row" spacing={2}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                Punch In
                            </Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ color: present ? "success.dark" : "text.disabled", mt: 0.2 }}>
                                {formatTime(agent.punch_in_time) || "—"}
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                Punch Out
                            </Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ color: done ? "error.main" : "text.disabled", mt: 0.2 }}>
                                {formatTime(agent.punch_out_time) || "—"}
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                Hours
                            </Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ mt: 0.2 }}>
                                {agent.working_hours ? formatWorkingHours(agent.working_hours) : "—"}
                            </Typography>
                        </Box>
                    </Stack>
                </Box>
            </Box>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesManagerMobilePage() {
    const theme = useTheme();
    const today = toDateString(new Date());

    const [agents, setAgents] = useState<AgentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [checkingOut, setCheckingOut] = useState<number | null>(null);

    const fetchAgents = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const data = await apiClient.get<AgentRecord[]>(`/field-sales/admin-attendance/?date=${today}`);
            setAgents(Array.isArray(data) ? data : []);
        } catch {
            setAgents([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [today]);

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    // Live refresh every 30s for online status
    useEffect(() => {
        const id = setInterval(() => fetchAgents(true), 30000);
        return () => clearInterval(id);
    }, [fetchAgents]);

    const handleCheckOut = async (recordId: number) => {
        setCheckingOut(recordId);
        try {
            await apiClient.post(`/field-sales/admin-checkout/${recordId}/`, {});
            await fetchAgents(true);
        } finally {
            setCheckingOut(null);
        }
    };

    const handleTrackLocation = async (agentId: number) => {
        try {
            const data = await apiClient.get<{ latitude: number; longitude: number }>(
                `/field-sales/daily-reports/current-location/?agent_id=${agentId}`
            );
            if (data?.latitude && data?.longitude) {
                window.open(`https://maps.google.com/?q=${data.latitude},${data.longitude}`, "_blank");
            }
        } catch {
            // no location available — silently skip
        }
    };

    // Stats
    const present = agents.filter(a => a.punch_in_time).length;
    const absent = agents.length - present;
    const online = agents.filter(a => isOnline(a.last_seen)).length;

    const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

    return (
        <>
            <Box
                sx={{
                    maxWidth: 520,
                    mx: "auto",
                    px: { xs: 1.5, sm: 2 },
                    pb: 6,
                    pt: 1,
                }}
            >
                {/* ── Page Header ── */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
                    <Box>
                        <Typography variant="h5" fontWeight={800} lineHeight={1.1}>
                            My Team
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            {dateLabel}
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={() => fetchAgents(true)}
                        disabled={refreshing || loading}
                        sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            borderRadius: "12px",
                            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                        }}
                    >
                        <RefreshIcon
                            fontSize="small"
                            sx={{
                                color: "primary.main",
                                transition: "transform 0.4s",
                                transform: refreshing ? "rotate(360deg)" : "none",
                            }}
                        />
                    </IconButton>
                </Stack>

                {/* ── Summary Cards ── */}
                <Stack direction="row" spacing={1.5} mb={3}>
                    <StatCard
                        icon={<CheckCircleOutlineIcon fontSize="inherit" />}
                        label="Present"
                        value={loading ? "—" : present}
                        color="#16a34a"
                        bg="linear-gradient(135deg, #f0fdf4, #dcfce7)"
                    />
                    <StatCard
                        icon={<CancelOutlinedIcon fontSize="inherit" />}
                        label="Absent"
                        value={loading ? "—" : absent}
                        color="#dc2626"
                        bg="linear-gradient(135deg, #fff7f7, #fee2e2)"
                    />
                    <StatCard
                        icon={<WifiIcon fontSize="inherit" />}
                        label="Online"
                        value={loading ? "—" : online}
                        color="#2563eb"
                        bg="linear-gradient(135deg, #eff6ff, #dbeafe)"
                    />
                </Stack>

                {/* ── Agent count ── */}
                {!loading && (
                    <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                        <PeopleAltIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {agents.length} agent{agents.length !== 1 ? "s" : ""}
                        </Typography>
                    </Stack>
                )}

                {/* ── Agent Cards ── */}
                {loading ? (
                    <Stack alignItems="center" justifyContent="center" py={8}>
                        <CircularProgress size={36} />
                        <Typography variant="body2" color="text.secondary" mt={2}>
                            Loading team…
                        </Typography>
                    </Stack>
                ) : agents.length === 0 ? (
                    <Box
                        sx={{
                            textAlign: "center", py: 8,
                            borderRadius: "20px",
                            bgcolor: alpha(theme.palette.text.primary, 0.03),
                            border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`,
                        }}
                    >
                        <PeopleAltIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                        <Typography color="text.disabled" fontWeight={600}>
                            No agents assigned to you
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={1.5}>
                        <AnimatePresence>
                            {agents.map(agent => (
                                <AgentCard
                                    key={agent.agent_id}
                                    agent={agent}
                                    onCheckOut={handleCheckOut}
                                    onTrackLocation={handleTrackLocation}
                                    checkingOut={checkingOut}
                                />
                            ))}
                        </AnimatePresence>
                    </Stack>
                )}
            </Box>
        </>
    );
}

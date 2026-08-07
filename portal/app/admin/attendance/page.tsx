"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
    Box,
    Paper,
    Typography,
    Stack,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    TextField,
    CircularProgress,
    Avatar,
    Button,
    useTheme,
    alpha,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    LinearProgress,
    IconButton,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Alert,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { motion } from "framer-motion";
import { BadgeIcon, CalendarTodayIcon, ExitToAppIcon, DownloadIcon, EditIcon, HistoryIcon, CloseIcon } from "@/components/icons";
import { apiClient } from "@/lib/api-client";
import { authService } from "@/lib/auth-service";
import ModuleUpgradeNotice from "@/components/common/ModuleUpgradeNotice";
import { travelAllowanceService } from "@/lib/travel-allowance-service";
import { formatTime, formatWorkingHours } from "@/lib/office-attendance-api";
import { isAgentOnline, offlineLabel } from "@/lib/agentStatus";
import XLSXStyle from "xlsx-js-style";
import AgentDetailModal from "@/components/sales/AgentDetailModal";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentRecord {
    agent_id: number;
    agent_name: string;
    profile_image: string | null;
    record_id: number | null;
    punch_in_time: string | null;
    punch_out_time: string | null;
    working_hours: number;
    punch_out_type: "manual" | "auto" | null;
    checked_out_by_name: string | null;
    last_seen: string | null;
    last_location_at?: string | null;
    mock_detected?: boolean;
    has_edit_logs: boolean;
    allowance_basis?: string;
}

interface OfficeRecord {
    id: number;
    user_id: number;
    user_name: string;
    user_role: string;
    profile_image: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    working_hours: number;
    check_out_type: "manual" | "auto" | null;
    checked_out_by_name: string | null;
    checked_in: boolean;
    checked_out: boolean;
    has_edit_logs: boolean;
}

interface EditLogEntry {
    edited_by: string;
    edited_at: string;
    changes: Record<string, { old: string | number | null; new: string | number | null }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
    // Use local time components — avoids UTC shift in +05:30 and similar zones
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function toMonthString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

const ROLE_LABELS: Record<string, string> = {
    admin: "Administrator",
    mdo: "MDO",
    executive: "Executive",
    accounts_officer: "Accounts Officer",
    purchase_manager: "Purchase Manager",
    production_manager: "Production Manager",
    warehouse_manager: "Warehouse Manager",
    sales_manager: "Sales Manager",
    distributor: "Distributor",
};

// ─── Shared style tokens ─────────────────────────────────────────────────────
// One place for the table + chip language so both tabs render identically and
// nothing drifts into the "everything is a pill" look.

const RADIUS = "8px";

/** Compact, squared-off status chip — same metrics everywhere in the table. */
const chipSx = {
    height: 22,
    borderRadius: "6px",
    fontSize: "0.7rem",
    fontWeight: 600,
    "& .MuiChip-label": { px: 0.9 },
} as const;

/** Dense, ledger-style table: tinted uppercase header, hairline row rules. */
function tableSx(theme: Theme) {
    return {
        "& .MuiTableCell-root": {
            px: 1.75,
            py: 1.1,
            fontSize: "0.8125rem",
            whiteSpace: "nowrap",
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.45)}`,
        },
        "& .MuiTableHead-root .MuiTableCell-root": {
            py: 1.15,
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "text.secondary",
            bgcolor: alpha(theme.palette.primary.main, 0.035),
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        },
        "& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root": {
            borderBottom: 0,
        },
        "& .MuiTableBody-root .MuiTableRow-root:hover": {
            bgcolor: alpha(theme.palette.primary.main, 0.03),
        },
    } as const;
}

type Col = { key: string; align?: "left" | "center" | "right" };

const AGENT_COLS: Col[] = [
    { key: "Agent" },
    { key: "Punch In", align: "center" },
    { key: "Punch Out", align: "center" },
    { key: "Hours", align: "center" },
    { key: "Type", align: "center" },
    { key: "Checked Out By" },
    { key: "Status", align: "center" },
    { key: "App Status", align: "center" },
    { key: "TA Basis", align: "center" },
    { key: "Action", align: "right" },
];

const OFFICE_COLS: Col[] = [
    { key: "Name" },
    { key: "Role" },
    { key: "Check In", align: "center" },
    { key: "Check Out", align: "center" },
    { key: "Hours", align: "center" },
    { key: "Type", align: "center" },
    { key: "Checked Out By" },
    { key: "Status", align: "center" },
    { key: "Action", align: "right" },
];

function TableHeadRow({ cols }: { cols: Col[] }) {
    return (
        <TableHead>
            <TableRow>
                {cols.map((c) => (
                    <TableCell key={c.key} align={c.align ?? "left"}>{c.key}</TableCell>
                ))}
            </TableRow>
        </TableHead>
    );
}

// ─── Small UI components ─────────────────────────────────────────────────────

function AgentAvatar({ name, color, src }: { name: string; color: "primary" | "secondary"; src?: string | null }) {
    const theme = useTheme();
    const imgUrl = src ? (src.startsWith("http") ? src : `${process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api/v1", "") || "http://localhost:8000"}${src}`) : undefined;
    return (
        <Avatar src={imgUrl} variant="rounded" sx={{ width: 28, height: 28, borderRadius: "6px", fontSize: "0.7rem", bgcolor: alpha(theme.palette[color].main, 0.14), color: `${color}.main`, fontWeight: 700 }}>
            {(name || "?")[0].toUpperCase()}
        </Avatar>
    );
}

/** Neutral (absent / offline) chip tone that also works in dark mode. */
function useMutedChipSx() {
    const theme = useTheme();
    return {
        ...chipSx,
        bgcolor: alpha(theme.palette.text.primary, 0.06),
        color: "text.secondary",
    };
}

function StatusChip({ punchedIn, punchedOut }: { punchedIn: boolean; punchedOut: boolean }) {
    const theme = useTheme();
    const muted = useMutedChipSx();
    if (!punchedIn) return <Chip label="Absent" size="small" data-testid="attendance-status-absent" sx={muted} />;
    if (!punchedOut) return <Chip label="Present" size="small" data-testid="attendance-status-present" sx={{ ...chipSx, bgcolor: alpha(theme.palette.success.main, 0.14), color: "success.dark" }} />;
    return <Chip label="Done" size="small" data-testid="attendance-status-done" sx={{ ...chipSx, bgcolor: alpha(theme.palette.text.primary, 0.08), color: "text.secondary" }} />;
}

function OfficeStatusChip({ checkedIn }: { checkedIn: boolean }) {
    const theme = useTheme();
    const muted = useMutedChipSx();
    if (!checkedIn) return <Chip label="Absent" size="small" data-testid="attendance-office-status-absent" sx={muted} />;
    return <Chip label="Present" size="small" data-testid="attendance-office-status-present" sx={{ ...chipSx, bgcolor: alpha(theme.palette.success.main, 0.14), color: "success.dark" }} />;
}

function TypeChip({ type }: { type: "manual" | "auto" | null }) {
    const theme = useTheme();
    if (!type) return <Typography variant="body2" color="text.disabled">—</Typography>;
    return (
        <Chip label={type === "auto" ? "Auto" : "Manual"} size="small" data-testid={`attendance-type-${type}`}
            sx={{ ...chipSx, height: 20, fontSize: "0.66rem", bgcolor: type === "auto" ? alpha(theme.palette.warning.main, 0.14) : alpha(theme.palette.success.main, 0.14), color: type === "auto" ? "warning.dark" : "success.dark", fontWeight: 700 }}
        />
    );
}

function AppStatusChip({ lastSeen }: { lastSeen: string | null }) {
    const theme = useTheme();
    const muted = useMutedChipSx();
    if (!lastSeen) return <Chip label="Offline" size="small" data-testid="attendance-app-status-offline" sx={muted} />;
    const online = isAgentOnline(lastSeen);
    return (
        <Tooltip title={`Last seen: ${new Date(lastSeen).toLocaleString()}`}>
            <Chip
                label={online ? "Online" : offlineLabel(lastSeen)}
                size="small"
                data-testid={`attendance-app-status-${online ? "online" : "stale"}`}
                sx={online
                    ? { ...chipSx, bgcolor: alpha(theme.palette.success.main, 0.14), color: "success.dark", fontWeight: 700 }
                    : muted}
            />
        </Tooltip>
    );
}

function MockChip() {
    const theme = useTheme();
    return (
        <Tooltip title="Fake GPS / mock location detected today — flagged for review">
            <Chip
                label="Fake GPS"
                size="small"
                data-testid="attendance-mock-gps-chip"
                sx={{ ...chipSx, bgcolor: alpha(theme.palette.error.main, 0.12), color: "error.dark", fontWeight: 700 }}
            />
        </Tooltip>
    );
}

function IconBtn({ loading, disabled, onClick, title, testId }: { loading: boolean; disabled: boolean; onClick: () => void; title: string; testId: string }) {
    const theme = useTheme();
    return (
        <Tooltip title={title}>
            <span>
                <IconButton size="small" disabled={disabled} onClick={onClick} data-testid={testId}
                    sx={{ width: 28, height: 28, borderRadius: RADIUS, border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`, color: "warning.main", "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.08) } }}>
                    {loading ? <CircularProgress size={12} color="inherit" /> : <ExitToAppIcon sx={{ fontSize: 14 }} />}
                </IconButton>
            </span>
        </Tooltip>
    );
}

// ─── Helper: convert ISO to HH:MM for time input ───────────────────────────

function isoToTimeStr(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Combine a YYYY-MM-DD date string and HH:MM time string into an ISO string */
function timeToIso(dateStr: string, timeStr: string): string {
    if (!dateStr || !timeStr) return "";
    return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

function calcHoursFromTime(inTime: string, outTime: string): number {
    if (!inTime || !outTime) return 0;
    const [inH, inM] = inTime.split(":").map(Number);
    const [outH, outM] = outTime.split(":").map(Number);
    const diffMin = (outH * 60 + outM) - (inH * 60 + inM);
    return diffMin > 0 ? Math.round((diffMin / 60) * 100) / 100 : 0;
}

const CHANGE_LABELS: Record<string, string> = {
    punch_in_time: "Punch In",
    punch_out_time: "Punch Out",
    check_in_time: "Check In",
    check_out_time: "Check Out",
    working_hours: "Hours",
    punch_out_type: "Type",
    check_out_type: "Type",
    status: "Status",
};

function formatLogValue(val: string | number | null): string {
    if (val === null || val === "None" || val === "") return "—";
    if (typeof val === "number") return formatWorkingHours(val);
    if (typeof val === "string" && val.includes("T")) {
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return formatTime(val) || val;
        } catch { /* keep raw */ }
    }
    return String(val);
}

// ─── Edit Attendance Dialog ─────────────────────────────────────────────────

function EditAttendanceDialog({
    open, onClose, record, type, date, onSaved,
}: {
    open: boolean;
    onClose: () => void;
    record: { id: number | null; agentId?: number; name: string; inTime: string | null; outTime: string | null } | null;
    type: "agent" | "office";
    date: string;
    onSaved: () => void;
}) {
    const theme = useTheme();
    const [attStatus, setAttStatus] = useState<"present" | "absent">("present");
    const [timeIn, setTimeIn] = useState("");
    const [timeOut, setTimeOut] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open && record) {
            const isPresent = Boolean(record.inTime);
            setAttStatus(isPresent ? "present" : "absent");
            setTimeIn(isoToTimeStr(record.inTime));
            setTimeOut(isoToTimeStr(record.outTime));
            setError("");
        }
    }, [open, record]);

    const computedHours = calcHoursFromTime(timeIn, timeOut);
    const hasTimeError = timeIn && timeOut && computedHours <= 0;

    const handleSave = async () => {
        if (!record) return;
        setError("");

        if (attStatus === "present" && !timeIn) {
            setError(type === "agent" ? "Punch-in time is required." : "Check-in time is required.");
            return;
        }
        if (attStatus === "present" && timeIn && timeOut && computedHours <= 0) {
            setError(type === "agent" ? "Punch-out must be after punch-in." : "Check-out must be after check-in.");
            return;
        }

        setSaving(true);
        try {
            const body: Record<string, string | number> = { status: attStatus };
            if (attStatus === "present") {
                const inKey = type === "agent" ? "punch_in_time" : "check_in_time";
                const outKey = type === "agent" ? "punch_out_time" : "check_out_time";
                body[inKey] = timeToIso(date, timeIn);
                if (timeOut) body[outKey] = timeToIso(date, timeOut);
            }

            if (type === "agent" && !record.id) {
                body.agent_id = record.agentId!;
                body.date = date;
                await apiClient.patch(`/field-sales/admin-attendance/edit/`, body);
            } else {
                const url = type === "agent"
                    ? `/field-sales/admin-attendance/${record.id}/edit/`
                    : `/office-attendance/${record.id}/admin-edit/`;
                await apiClient.patch(url, body);
            }
            onSaved();
            onClose();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to save.";
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const inLabel = type === "agent" ? "Punch In" : "Check In";
    const outLabel = type === "agent" ? "Punch Out" : "Check Out";

    // Format date for display
    const displayDate = (() => {
        const [y, m, d] = date.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    })();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
            PaperProps={{ elevation: 0, sx: { borderRadius: "10px", border: `1px solid ${alpha(theme.palette.divider, 0.6)}` } }}>
            <Box sx={{ px: 3, pt: 2.5, pb: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>Edit Attendance</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                        <Typography variant="body2" fontWeight={600} color="text.primary">{record?.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{displayDate}</Typography>
                    </Stack>
                </Box>
                <IconButton size="small" onClick={onClose} sx={{ mt: -0.5, mr: -1 }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
            </Box>

            <Box sx={{ px: 3, pt: 2, pb: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px", py: 0.5, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{error}</Alert>}

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Status</InputLabel>
                    <Select value={attStatus} label="Status"
                        onChange={(e) => setAttStatus(e.target.value as "present" | "absent")}
                        sx={{ borderRadius: "8px" }}>
                        <MenuItem value="present">Present</MenuItem>
                        <MenuItem value="absent">Absent</MenuItem>
                    </Select>
                </FormControl>

                {attStatus === "present" && (
                    <>
                        <Stack direction="row" spacing={1.5} mb={1.5}>
                            <TextField
                                label={inLabel}
                                type="time"
                                size="small"
                                fullWidth
                                value={timeIn}
                                onChange={(e) => setTimeIn(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
                            />
                            <TextField
                                label={outLabel}
                                type="time"
                                size="small"
                                fullWidth
                                value={timeOut}
                                onChange={(e) => setTimeOut(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                error={Boolean(hasTimeError)}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
                            />
                        </Stack>
                        {timeIn && timeOut && !hasTimeError && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: "8px" }}>
                                <Typography variant="caption" color="text.secondary">Hours:</Typography>
                                <Typography variant="body2" fontWeight={700} color="primary.main">{formatWorkingHours(computedHours)}</Typography>
                                <Box sx={{ ml: "auto", px: 1, py: 0.25, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: "4px" }}>
                                    <Typography variant="caption" fontWeight={700} color="success.dark" sx={{ fontSize: "0.65rem" }}>MANUAL</Typography>
                                </Box>
                            </Box>
                        )}
                    </>
                )}

                {attStatus === "absent" && (
                    <Box sx={{ px: 1.5, py: 1.5, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: "8px", border: `1px solid ${alpha(theme.palette.info.main, 0.12)}` }}>
                        <Typography variant="caption" color="text.secondary" lineHeight={1.5}>
                            {inLabel}, {outLabel}, Hours, Type and Checked Out By will be cleared.
                        </Typography>
                    </Box>
                )}

                <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2.5}>
                    <Button onClick={onClose} disabled={saving} size="small"
                        sx={{ textTransform: "none", color: "text.secondary", borderRadius: "8px", px: 2 }}>
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving} size="small"
                        sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px", px: 2.5, boxShadow: "none", "&:hover": { boxShadow: "none" } }}>
                        {saving ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
                        {saving ? "Saving…" : "Save"}
                    </Button>
                </Stack>
            </Box>
        </Dialog>
    );
}

// ─── Edit Log Dialog ────────────────────────────────────────────────────────

function EditLogDialog({
    open, onClose, recordId, recordName, type,
}: {
    open: boolean;
    onClose: () => void;
    recordId: number | null;
    recordName: string;
    type: "agent" | "office";
}) {
    const theme = useTheme();
    const [logs, setLogs] = useState<EditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && recordId) {
            setLoading(true);
            const url = type === "agent"
                ? `/field-sales/admin-attendance/${recordId}/logs/`
                : `/office-attendance/${recordId}/logs/`;
            apiClient.get<EditLogEntry[]>(url)
                .then((data) => setLogs(Array.isArray(data) ? data : []))
                .catch(() => setLogs([]))
                .finally(() => setLoading(false));
        }
    }, [open, recordId, type]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ elevation: 0, sx: { borderRadius: "10px", border: `1px solid ${alpha(theme.palette.divider, 0.6)}` } }}>
            <Box sx={{ px: 3, pt: 2.5, pb: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>Edit History</Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.25}>{recordName}</Typography>
                </Box>
                <IconButton size="small" onClick={onClose} sx={{ mt: -0.5, mr: -1 }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
            </Box>

            <Box sx={{ px: 3, pt: 2, pb: 3 }}>
                {loading ? (
                    <Stack alignItems="center" py={4}><CircularProgress size={24} /></Stack>
                ) : logs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>No edit history found.</Typography>
                ) : (
                    <Stack spacing={1.5}>
                        {logs.slice().reverse().map((log, i) => {
                            const editDate = new Date(log.edited_at);
                            const dateStr = editDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                            const timeStr = editDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                            return (
                                <Box key={i} sx={{ p: 1.5, borderRadius: "8px", border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                                        <Stack direction="row" spacing={0.75} alignItems="center">
                                            <Avatar sx={{ width: 22, height: 22, fontSize: "0.6rem", bgcolor: alpha(theme.palette.warning.main, 0.12), color: "warning.dark", fontWeight: 700 }}>
                                                {log.edited_by[0]?.toUpperCase()}
                                            </Avatar>
                                            <Typography variant="caption" fontWeight={700}>{log.edited_by}</Typography>
                                        </Stack>
                                        <Typography variant="caption" color="text.disabled" fontSize="0.65rem">{dateStr}, {timeStr}</Typography>
                                    </Stack>
                                    <Stack spacing={0.75} sx={{ pl: 0.5 }}>
                                        {Object.entries(log.changes).map(([field, { old: oldVal, new: newVal }]) => (
                                            <Stack key={field} direction="row" spacing={0.75} alignItems="center" sx={{ minHeight: 22 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72, fontSize: "0.7rem" }}>
                                                    {CHANGE_LABELS[field] || field}
                                                </Typography>
                                                <Box sx={{ px: 0.75, py: 0.15, bgcolor: alpha(theme.palette.error.main, 0.08), borderRadius: "4px" }}>
                                                    <Typography variant="caption" color="error.dark" sx={{ fontSize: "0.65rem", textDecoration: "line-through" }}>
                                                        {formatLogValue(oldVal)}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem" }}>→</Typography>
                                                <Box sx={{ px: 0.75, py: 0.15, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: "4px" }}>
                                                    <Typography variant="caption" color="success.dark" sx={{ fontSize: "0.65rem", fontWeight: 600 }}>
                                                        {formatLogValue(newVal)}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>
                )}

                <Stack direction="row" justifyContent="flex-end" mt={2}>
                    <Button onClick={onClose} size="small"
                        sx={{ textTransform: "none", color: "text.secondary", borderRadius: "8px", px: 2 }}>
                        Close
                    </Button>
                </Stack>
            </Box>
        </Dialog>
    );
}

// ─── XLSX Styling helpers ─────────────────────────────────────────────────────

const HDR_BG   = "1E3A5F";   // deep navy
const HDR_FG   = "FFFFFF";
const ROW_EVEN = "FFFFFF";
const ROW_ODD  = "F0F4F8";
const BORDER_C = { rgb: "D1D5DB" };
const cellBorder = { top: { style: "thin" as const, color: BORDER_C }, bottom: { style: "thin" as const, color: BORDER_C }, left: { style: "thin" as const, color: BORDER_C }, right: { style: "thin" as const, color: BORDER_C } };
const hdrBorder = { top: { style: "thin" as const, color: { rgb: "2D4A73" } }, bottom: { style: "thin" as const, color: { rgb: "2D4A73" } }, left: { style: "thin" as const, color: { rgb: "2D4A73" } }, right: { style: "thin" as const, color: { rgb: "2D4A73" } } };

function makeSheet(
    header: string[],
    dataRows: (string | number)[][],
    colWidths: number[],
    statusIdx = -1,           // column index that holds "Present"/"Absent", -1 = none
    presentColIdx = -1,       // for overview: "Days Present" col index
    absentColIdx  = -1,       // for overview: "Days Absent"  col index
) {
    const ws = XLSXStyle.utils.aoa_to_sheet([header, ...dataRows]);
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));
    ws["!rows"] = [{ hpt: 26 }, ...dataRows.map(() => ({ hpt: 19 }))];

    // Header row
    header.forEach((_, c) => {
        const addr = XLSXStyle.utils.encode_cell({ r: 0, c });
        if (!ws[addr]) return;
        ws[addr].s = {
            font: { bold: true, color: { rgb: HDR_FG }, sz: 11 },
            fill: { patternType: "solid", fgColor: { rgb: HDR_BG } },
            alignment: { horizontal: "center", vertical: "center" },
            border: hdrBorder,
        };
    });

    // Data rows
    dataRows.forEach((row, r) => {
        const bg = r % 2 === 0 ? ROW_EVEN : ROW_ODD;
        row.forEach((_, c) => {
            const addr = XLSXStyle.utils.encode_cell({ r: r + 1, c });
            if (!ws[addr]) return;

            let fillRgb = bg;
            let fontRgb = "1F2937";
            let bold    = c === 0;

            const status = statusIdx >= 0 ? String(row[statusIdx] ?? "") : "";

            // Colour the entire row faintly by status
            if (statusIdx >= 0) {
                if (status === "Present") fillRgb = r % 2 === 0 ? "F0FDF4" : "DCFCE7";
                else if (status === "Absent") fillRgb = r % 2 === 0 ? "FFF7F7" : "FEE2E2";
            }

            // Status cell gets strong colour + bold
            if (c === statusIdx) {
                bold = true;
                if (status === "Present") { fillRgb = "BBF7D0"; fontRgb = "14532D"; }
                else if (status === "Absent") { fillRgb = "FECACA"; fontRgb = "7F1D1D"; }
                else { fillRgb = "E5E7EB"; fontRgb = "374151"; }
            }

            // Overview: Days Present = green, Days Absent = red
            if (c === presentColIdx && Number(row[c]) > 0) { fillRgb = "DCFCE7"; fontRgb = "14532D"; bold = true; }
            if (c === absentColIdx  && Number(row[c]) > 0) { fillRgb = "FEE2E2"; fontRgb = "7F1D1D"; bold = true; }

            ws[addr].s = {
                font: { sz: 10, bold, color: { rgb: fontRgb } },
                fill: { patternType: "solid", fgColor: { rgb: fillRgb } },
                alignment: { vertical: "center", horizontal: c === 0 ? "left" : "center" },
                border: cellBorder,
            };
        });
    });

    return ws;
}

// ─── XLSX Export ─────────────────────────────────────────────────────────────

async function generateExcel(
    month: string,
    isAgentTab: boolean,
    onProgress: (pct: number) => void
) {
    const [year, mon] = month.split("-").map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => toDateString(new Date(year, mon - 1, i + 1)));

    type DayData = { date: string; agents: AgentRecord[]; office: OfficeRecord[] };
    const results: DayData[] = [];

    for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        const [agentRes, officeRes] = await Promise.allSettled([
            apiClient.get<AgentRecord[]>(`/field-sales/admin-attendance/?date=${d}`),
            // Only the Office Staff sheet needs office data; skip it for the
            // Sales Agents export so non-ATT tenants never hit that endpoint.
            isAgentTab
                ? Promise.resolve([] as OfficeRecord[])
                : apiClient.get<OfficeRecord[]>(`/office-attendance/by-date/?date=${d}`),
        ]);
        results.push({
            date: d,
            agents: agentRes.status === "fulfilled" && Array.isArray(agentRes.value) ? agentRes.value : [],
            office: officeRes.status === "fulfilled" && Array.isArray(officeRes.value) ? officeRes.value : [],
        });
        onProgress(Math.round(((i + 1) / dates.length) * 90));
    }

    const wb = XLSXStyle.utils.book_new();

    // ── Overview sheet ────────────────────────────────────────────────────────
    if (isAgentTab) {
        const agentMap = new Map<string, { present: number; absent: number; totalHours: number }>();
        for (const { agents } of results)
            for (const a of agents) {
                if (!agentMap.has(a.agent_name)) agentMap.set(a.agent_name, { present: 0, absent: 0, totalHours: 0 });
                const e = agentMap.get(a.agent_name)!;
                if (a.punch_in_time) { e.present++; e.totalHours += a.working_hours || 0; } else e.absent++;
            }
        const header = ["Agent", "Days Present", "Days Absent", "Total Hours", "Avg Hours / Day"];
        const rows = Array.from(agentMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([name, e]) => [
            name, e.present, e.absent,
            e.totalHours ? formatWorkingHours(e.totalHours) : "0h",
            e.present > 0 ? formatWorkingHours(e.totalHours / e.present) : "—",
        ]);
        XLSXStyle.utils.book_append_sheet(wb, makeSheet(header, rows, [28, 14, 14, 14, 16], -1, 1, 2), "Overview");
    } else {
        const staffMap = new Map<string, { role: string; present: number; totalHours: number }>();
        for (const { office } of results)
            for (const s of office) {
                if (!staffMap.has(s.user_name)) staffMap.set(s.user_name, { role: s.user_role, present: 0, totalHours: 0 });
                const e = staffMap.get(s.user_name)!;
                e.present++; e.totalHours += s.working_hours || 0;
            }
        const header = ["Name", "Role", "Days Present", "Days Absent", "Total Hours", "Avg Hours / Day"];
        const rows = Array.from(staffMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([name, e]) => [
            name, ROLE_LABELS[e.role] || e.role, e.present, daysInMonth - e.present,
            e.totalHours ? formatWorkingHours(e.totalHours) : "0h",
            e.present > 0 ? formatWorkingHours(e.totalHours / e.present) : "—",
        ]);
        XLSXStyle.utils.book_append_sheet(wb, makeSheet(header, rows, [28, 20, 14, 14, 14, 16], -1, 2, 3), "Overview");
    }

    // ── Per-day sheets ────────────────────────────────────────────────────────
    for (const { date, agents, office } of results) {
        const [dy, dm, dd] = date.split("-").map(Number);
        const d = new Date(dy, dm - 1, dd);
        const sheetName = `${String(d.getDate()).padStart(2, "0")} ${DAY_NAMES[d.getDay()]}`;

        if (isAgentTab) {
            const header = ["Agent", "Punch In", "Punch Out", "Hours", "Type", "Checked Out By", "Status"];
            const rows = agents.map((a) => [
                a.agent_name,
                formatTime(a.punch_in_time) || "—",
                formatTime(a.punch_out_time) || "—",
                a.working_hours ? formatWorkingHours(a.working_hours) : "—",
                a.punch_out_type || "—",
                a.checked_out_by_name || "—",
                a.punch_in_time ? "Present" : "Absent",
            ]);
            XLSXStyle.utils.book_append_sheet(wb, makeSheet(header, rows, [28, 12, 12, 10, 10, 22, 10], 6), sheetName);
        } else {
            const header = ["Name", "Role", "Check In", "Check Out", "Hours", "Type", "Checked Out By", "Status"];
            const rows = office.map((s) => [
                s.user_name,
                ROLE_LABELS[s.user_role] || s.user_role,
                formatTime(s.check_in_time) || "—",
                formatTime(s.check_out_time) || "—",
                s.working_hours ? formatWorkingHours(s.working_hours) : "—",
                s.check_out_type || "—",
                s.checked_out_by_name || "—",
                s.checked_in ? "Present" : "Absent",
            ]);
            XLSXStyle.utils.book_append_sheet(wb, makeSheet(header, rows, [28, 20, 12, 12, 10, 10, 22, 10], 7), sheetName);
        }
    }

    onProgress(100);
    const label = isAgentTab ? "Sales_Agents" : "Office_Staff";
    XLSXStyle.writeFile(wb, `Attendance_${label}_${MONTH_NAMES[mon - 1]}_${year}.xlsx`);
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AttendancePage() {
    const theme = useTheme();
    const [tab, setTab] = useState(0);
    const [date, setDate] = useState(toDateString(new Date()));

    const [agents, setAgents] = useState<AgentRecord[]>([]);
    const [officeStaff, setOfficeStaff] = useState<OfficeRecord[]>([]);
    const [agentsLoading, setAgentsLoading] = useState(false);
    const [officeLoading, setOfficeLoading] = useState(false);
    const [checkingOut, setCheckingOut] = useState<number | null>(null);

    // User detail modal
    const [detailAgent, setDetailAgent] = useState<any>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    const openUserDetail = async (userId: number) => {
        try {
            setDetailLoading(true);
            const user = await apiClient.get<any>(`/auth/users/${userId}/`);
            setDetailAgent(user);
            setDetailOpen(true);
        } catch {
            // silently fail
        } finally {
            setDetailLoading(false);
        }
    };

    // Role — null = still loading
    const [userRole, setUserRole] = useState<string | null>(null);
    useEffect(() => {
        authService.getCurrentUser()
            .then((u) => {
                const role = u?.role ?? "admin";
                setUserRole(role);
                if (role !== "admin") setTab(0); // lock to Sales Agents for non-admins
            })
            .catch(() => setUserRole("admin"));
    }, []);
    const isAdmin = userRole === null || userRole === "admin";
    // The page has two independent halves: Sales Agents (field GPS punch = TRACK)
    // and Office Staff (office punch/leave = ATT). A tenant may own either, both,
    // or (via add-ons) just one. Gate each half on its module so we never call an
    // endpoint that 403s — the missing half shows an upgrade panel instead.
    const orgModules = authService.getOrgContext()?.modules ?? [];
    const trackEntitled = orgModules.includes("TRACK");
    const attEntitled = orgModules.includes("ATT");

    // Land on the first tab the tenant actually owns (ATT-only add-on → Office).
    useEffect(() => {
        if (userRole === null) return;
        if (!trackEntitled && attEntitled && isAdmin) setTab(1);
    }, [userRole, trackEntitled, attEntitled, isAdmin]);

    // Edit dialog state
    const [editOpen, setEditOpen] = useState(false);
    const [editRecord, setEditRecord] = useState<{ id: number | null; agentId?: number; name: string; inTime: string | null; outTime: string | null } | null>(null);
    const [editType, setEditType] = useState<"agent" | "office">("agent");

    // Log dialog state
    const [logOpen, setLogOpen] = useState(false);
    const [logRecordId, setLogRecordId] = useState<number | null>(null);
    const [logRecordName, setLogRecordName] = useState("");
    const [logType, setLogType] = useState<"agent" | "office">("agent");

    // Export state
    const [exportOpen, setExportOpen] = useState(false);
    const [exportMonth, setExportMonth] = useState(toMonthString(new Date()));
    const [exportLoading, setExportLoading] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    const fetchAgents = useCallback(async (d: string) => {
        setAgentsLoading(true);
        try {
            const data = await apiClient.get<AgentRecord[]>(`/field-sales/admin-attendance/?date=${d}`);
            setAgents(Array.isArray(data) ? data : []);
        } catch { setAgents([]); }
        finally { setAgentsLoading(false); }
    }, []);

    const fetchOfficeStaff = useCallback(async (d: string) => {
        setOfficeLoading(true);
        try {
            const data = await apiClient.get<OfficeRecord[]>(`/office-attendance/by-date/?date=${d}`);
            setOfficeStaff(Array.isArray(data) ? data : []);
        } catch { setOfficeStaff([]); }
        finally { setOfficeLoading(false); }
    }, []);

    useEffect(() => {
        if (userRole === null) return; // wait until role is known
        if (trackEntitled) fetchAgents(date);
        if (userRole === "admin" && attEntitled) fetchOfficeStaff(date);
    }, [date, userRole, trackEntitled, attEntitled, fetchAgents, fetchOfficeStaff]);

    // Auto-refresh agents every 30 s to keep App Status column live
    useEffect(() => {
        if (userRole === null || !trackEntitled) return;
        const id = setInterval(() => fetchAgents(date), 30000);
        return () => clearInterval(id);
    }, [date, userRole, trackEntitled, fetchAgents]);

    const handleAgentCheckOut = async (recordId: number) => {
        setCheckingOut(recordId);
        try { await apiClient.post(`/field-sales/admin-checkout/${recordId}/`, {}); await fetchAgents(date); }
        finally { setCheckingOut(null); }
    };

    const handleOfficeCheckOut = async (recordId: number) => {
        setCheckingOut(recordId);
        try { await apiClient.post(`/office-attendance/${recordId}/admin-checkout/`, {}); await fetchOfficeStaff(date); }
        finally { setCheckingOut(null); }
    };

    const handleEditAgent = (row: AgentRecord) => {
        setEditRecord({ id: row.record_id, agentId: row.agent_id, name: row.agent_name, inTime: row.punch_in_time, outTime: row.punch_out_time });
        setEditType("agent");
        setEditOpen(true);
    };

    const handleEditOffice = (row: OfficeRecord) => {
        setEditRecord({ id: row.id, name: row.user_name, inTime: row.check_in_time, outTime: row.check_out_time });
        setEditType("office");
        setEditOpen(true);
    };

    const handleLogAgent = (row: AgentRecord) => {
        if (!row.record_id) return;
        setLogRecordId(row.record_id);
        setLogRecordName(row.agent_name);
        setLogType("agent");
        setLogOpen(true);
    };

    const handleLogOffice = (row: OfficeRecord) => {
        setLogRecordId(row.id);
        setLogRecordName(row.user_name);
        setLogType("office");
        setLogOpen(true);
    };

    const handleEditSaved = () => {
        fetchAgents(date);
        if (isAdmin && attEntitled) fetchOfficeStaff(date);
    };

    const handleExport = async () => {
        setExportLoading(true);
        setExportProgress(0);
        try {
            if (attEntitled) {
                // Generate Sales Agents file (progress 0-45%)
                await generateExcel(exportMonth, true, (pct) => setExportProgress(Math.round(pct * 0.45)));
                // Generate Office Staff file (progress 45-100%)
                await generateExcel(exportMonth, false, (pct) => setExportProgress(45 + Math.round(pct * 0.55)));
            } else {
                // No ATT module — only the Sales Agents (TRACK) export is available.
                await generateExcel(exportMonth, true, (pct) => setExportProgress(pct));
            }
            setExportOpen(false);
        } finally {
            setExportLoading(false);
            setExportProgress(0);
        }
    };

    const presentAgents = agents.filter((a) => a.punch_in_time).length;
    const presentOffice = officeStaff.length;

    const [exportYear, exportMon] = exportMonth.split("-").map(Number);
    const exportMonthLabel = exportMonth ? `${MONTH_NAMES[exportMon - 1]} ${exportYear}` : "";

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

                    {/* ── Header ── */}
                    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={2} mb={2.5}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box sx={{ width: 38, height: 38, borderRadius: RADIUS, bgcolor: alpha(theme.palette.primary.main, 0.09), display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <BadgeIcon sx={{ fontSize: 20, color: "primary.main" }} />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.15rem", lineHeight: 1.3, letterSpacing: "-0.01em" }}>Attendance</Typography>
                                <Typography variant="caption" color="text.secondary">Track daily check-in / check-out for all staff</Typography>
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                                onClick={() => setExportOpen(true)}
                                data-testid="attendance-export-btn"
                                sx={{
                                    borderRadius: RADIUS, textTransform: "none", fontWeight: 600, fontSize: "0.8125rem",
                                    px: 1.75, py: 0.75, height: 36,
                                    borderWidth: 1, borderColor: alpha(theme.palette.primary.main, 0.35),
                                    "&:hover": { borderWidth: 1 },
                                }}
                            >
                                Export
                            </Button>
                            <TextField
                                type="date"
                                size="small"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                inputProps={{ "data-testid": "attendance-date-input" }}
                                InputProps={{ startAdornment: <CalendarTodayIcon sx={{ fontSize: 15, color: "text.secondary", mr: 0.75 }} /> }}
                                sx={{
                                    width: 168,
                                    "& .MuiOutlinedInput-root": { borderRadius: RADIUS, height: 36, fontSize: "0.8125rem", bgcolor: "background.paper" },
                                }}
                            />
                        </Stack>
                    </Stack>

                    {/* ── Tabs ── */}
                    <Paper elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: "10px", overflow: "hidden" }}>
                        <Tabs
                            value={tab}
                            onChange={(_, v) => setTab(v)}
                            sx={{
                                minHeight: 44,
                                px: 1.5,
                                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                                "& .MuiTab-root": { minHeight: 44, py: 0, px: 1.5, fontSize: "0.8125rem", fontWeight: 600, textTransform: "none", color: "text.secondary" },
                                "& .Mui-selected": { fontWeight: 700 },
                                "& .MuiTabs-indicator": { height: 2 },
                            }}
                        >
                            <Tab data-testid="attendance-tab-agents" label={<Stack direction="row" alignItems="center" spacing={0.75}><span>Sales Agents</span><Chip label={`${presentAgents}/${agents.length}`} size="small" sx={{ ...chipSx, height: 19, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha(theme.palette.text.primary, 0.07), color: "text.secondary" }} /></Stack>} />
                            {isAdmin && (
                                <Tab data-testid="attendance-tab-office" label={<Stack direction="row" alignItems="center" spacing={0.75}><span>Office Staff</span><Chip label={presentOffice} size="small" sx={{ ...chipSx, height: 19, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha(theme.palette.text.primary, 0.07), color: "text.secondary" }} /></Stack>} />
                            )}
                        </Tabs>

                        {/* Sales Agents — field GPS punch, needs the TRACK module */}
                        {tab === 0 && (
                            <Box data-testid="attendance-agents-panel">
                                {!trackEntitled ? (
                                    <ModuleUpgradeNotice
                                        feature="Sales Agent attendance"
                                        moduleName="Agent Live Tracking"
                                        moduleCode="TRACK"
                                        testId="attendance-agents-upgrade-notice"
                                        compact
                                    />
                                )
                                    : agentsLoading ? <Stack alignItems="center" py={7}><CircularProgress size={28} /></Stack>
                                    : agents.length === 0 ? <Stack alignItems="center" py={7}><Typography variant="body2" color="text.secondary">No sales agents found</Typography></Stack>
                                    : (
                                        <TableContainer sx={{ overflowX: "auto" }}>
                                            <Table size="small" sx={{ minWidth: 980, ...tableSx(theme) }}>
                                                <TableHeadRow cols={AGENT_COLS} />
                                                <TableBody>
                                                    {agents.map((row) => (
                                                        <TableRow key={row.agent_id} data-testid={`attendance-agent-row-${row.agent_id}`}>
                                                            <TableCell>
                                                                <Stack direction="row" alignItems="center" spacing={1.25}
                                                                    onClick={() => openUserDetail(row.agent_id)}
                                                                    data-testid={`attendance-agent-name-${row.agent_id}`}
                                                                    sx={{ cursor: "pointer", "&:hover .name": { color: "primary.main" } }}>
                                                                    <AgentAvatar name={row.agent_name} color="secondary" src={row.profile_image} />
                                                                    <Typography className="name" variant="body2" fontWeight={600} sx={{ fontSize: "0.8125rem", transition: "color .15s" }}>{row.agent_name}</Typography>
                                                                </Stack>
                                                            </TableCell>
                                                            <TableCell align="center">{formatTime(row.punch_in_time) || <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}</TableCell>
                                                            <TableCell align="center">{formatTime(row.punch_out_time) || <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}</TableCell>
                                                            <TableCell align="center" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{row.working_hours ? formatWorkingHours(row.working_hours) : <Box component="span" sx={{ color: "text.disabled", fontWeight: 400 }}>—</Box>}</TableCell>
                                                            <TableCell align="center"><TypeChip type={row.punch_out_type} /></TableCell>
                                                            <TableCell sx={{ color: "text.secondary" }}>{row.checked_out_by_name ?? "—"}</TableCell>
                                                            <TableCell align="center"><StatusChip punchedIn={Boolean(row.punch_in_time)} punchedOut={Boolean(row.punch_out_time)} /></TableCell>
                                                            <TableCell align="center">
                                                                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" flexWrap="wrap" useFlexGap>
                                                                    <AppStatusChip lastSeen={row.last_seen} />
                                                                    {row.mock_detected && <MockChip />}
                                                                </Stack>
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                {/* Travel-allowance distance basis for this day (admin sets at EOD). */}
                                                                {!row.record_id ? (
                                                                    <Box component="span" sx={{ color: "text.disabled" }}>—</Box>
                                                                ) : isAdmin ? (
                                                                    <FormControl size="small" sx={{ minWidth: 104 }}>
                                                                        <Select
                                                                            value={row.allowance_basis || ""}
                                                                            displayEmpty
                                                                            data-testid={`attendance-basis-select-${row.agent_id}`}
                                                                            onChange={async (e) => {
                                                                                const basis = e.target.value as "home" | "office" | "";
                                                                                try {
                                                                                    await travelAllowanceService.setBasis(row.agent_id, date, basis);
                                                                                    setAgents((prev) => prev.map((a) => a.agent_id === row.agent_id ? { ...a, allowance_basis: basis } : a));
                                                                                } catch { /* leave previous value on failure */ }
                                                                            }}
                                                                            sx={{ height: 30, borderRadius: "6px", fontSize: "0.75rem", "& .MuiSelect-select": { py: 0.5 } }}
                                                                        >
                                                                            <MenuItem value="" data-testid={`attendance-basis-none-${row.agent_id}`} sx={{ fontSize: "0.8125rem" }}>Not set</MenuItem>
                                                                            <MenuItem value="home" data-testid={`attendance-basis-home-${row.agent_id}`} sx={{ fontSize: "0.8125rem" }}>Home</MenuItem>
                                                                            <MenuItem value="office" data-testid={`attendance-basis-office-${row.agent_id}`} sx={{ fontSize: "0.8125rem" }}>Office</MenuItem>
                                                                        </Select>
                                                                    </FormControl>
                                                                ) : (
                                                                    <Chip size="small" variant="outlined" data-testid={`attendance-basis-chip-${row.agent_id}`}
                                                                        label={row.allowance_basis ? row.allowance_basis : "Not set"}
                                                                        sx={{ ...chipSx, textTransform: "capitalize" }} />
                                                                )}
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                                                                    {row.record_id && row.punch_in_time && !row.punch_out_time && (
                                                                        <IconBtn loading={checkingOut === row.record_id} disabled={checkingOut !== null} onClick={() => handleAgentCheckOut(row.record_id!)} title="Punch out this agent" testId={`attendance-agent-checkout-btn-${row.agent_id}`} />
                                                                    )}
                                                                    <Tooltip title="Edit attendance">
                                                                        <IconButton size="small" onClick={() => handleEditAgent(row)} data-testid={`attendance-agent-edit-btn-${row.agent_id}`}
                                                                            sx={{ width: 28, height: 28, border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`, borderRadius: RADIUS, "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                                                                            <EditIcon sx={{ fontSize: 14, color: "primary.main" }} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    {row.record_id && row.has_edit_logs && (
                                                                        <Tooltip title="View edit history">
                                                                            <IconButton size="small" onClick={() => handleLogAgent(row)} data-testid={`attendance-agent-history-btn-${row.agent_id}`}
                                                                                sx={{ width: 28, height: 28, border: `1px solid ${alpha(theme.palette.warning.main, 0.28)}`, borderRadius: RADIUS, "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.08) } }}>
                                                                                <HistoryIcon sx={{ fontSize: 14, color: "warning.main" }} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                </Stack>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                            </Box>
                        )}

                        {/* Office Staff — admin only; needs the ATT module */}
                        {isAdmin && tab === 1 && (
                            <Box data-testid="attendance-office-panel">
                                {!attEntitled ? (
                                    <ModuleUpgradeNotice
                                        feature="Office Staff attendance"
                                        moduleName="Attendance & Leave"
                                        moduleCode="ATT"
                                        testId="attendance-office-upgrade-notice"
                                        compact
                                    />
                                )
                                    : officeLoading ? <Stack alignItems="center" py={7}><CircularProgress size={28} /></Stack>
                                    : officeStaff.length === 0 ? <Stack alignItems="center" py={7}><Typography variant="body2" color="text.secondary">No check-in records for {date}</Typography></Stack>
                                    : (
                                        <TableContainer sx={{ overflowX: "auto" }}>
                                            <Table size="small" sx={{ minWidth: 900, ...tableSx(theme) }}>
                                                <TableHeadRow cols={OFFICE_COLS} />
                                                <TableBody>
                                                    {officeStaff.map((row) => (
                                                        <TableRow key={row.user_id} data-testid={`attendance-office-row-${row.user_id}`}>
                                                            <TableCell>
                                                                <Stack direction="row" alignItems="center" spacing={1.25}
                                                                    onClick={() => openUserDetail(row.user_id)}
                                                                    data-testid={`attendance-office-name-${row.user_id}`}
                                                                    sx={{ cursor: "pointer", "&:hover .name": { color: "primary.main" } }}>
                                                                    <AgentAvatar name={row.user_name} color="primary" src={row.profile_image} />
                                                                    <Typography className="name" variant="body2" fontWeight={600} sx={{ fontSize: "0.8125rem", transition: "color .15s" }}>{row.user_name}</Typography>
                                                                </Stack>
                                                            </TableCell>
                                                            <TableCell sx={{ color: "text.secondary" }}>{ROLE_LABELS[row.user_role] ?? row.user_role}</TableCell>
                                                            <TableCell align="center">{formatTime(row.check_in_time) || <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}</TableCell>
                                                            <TableCell align="center">{formatTime(row.check_out_time) || <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}</TableCell>
                                                            <TableCell align="center" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{row.working_hours ? formatWorkingHours(row.working_hours) : <Box component="span" sx={{ color: "text.disabled", fontWeight: 400 }}>—</Box>}</TableCell>
                                                            <TableCell align="center"><TypeChip type={row.check_out_type} /></TableCell>
                                                            <TableCell sx={{ color: "text.secondary" }}>{row.checked_out_by_name ?? "—"}</TableCell>
                                                            <TableCell align="center"><OfficeStatusChip checkedIn={row.checked_in} /></TableCell>
                                                            <TableCell align="right">
                                                                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                                                                    {row.checked_in && !row.checked_out && (
                                                                        <IconBtn loading={checkingOut === row.id} disabled={checkingOut !== null} onClick={() => handleOfficeCheckOut(row.id)} title="Check out this user" testId={`attendance-office-checkout-btn-${row.user_id}`} />
                                                                    )}
                                                                    <Tooltip title="Edit attendance">
                                                                        <IconButton size="small" onClick={() => handleEditOffice(row)} data-testid={`attendance-office-edit-btn-${row.user_id}`}
                                                                            sx={{ width: 28, height: 28, border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`, borderRadius: RADIUS, "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                                                                            <EditIcon sx={{ fontSize: 14, color: "primary.main" }} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    {row.has_edit_logs && (
                                                                        <Tooltip title="View edit history">
                                                                            <IconButton size="small" onClick={() => handleLogOffice(row)} data-testid={`attendance-office-history-btn-${row.user_id}`}
                                                                                sx={{ width: 28, height: 28, border: `1px solid ${alpha(theme.palette.warning.main, 0.28)}`, borderRadius: RADIUS, "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.08) } }}>
                                                                                <HistoryIcon sx={{ fontSize: 14, color: "warning.main" }} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                </Stack>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                            </Box>
                        )}
                    </Paper>
                </motion.div>
            </Box>

            {/* ── Edit Attendance Dialog ── */}
            <EditAttendanceDialog
                open={editOpen}
                onClose={() => setEditOpen(false)}
                record={editRecord}
                type={editType}
                date={date}
                onSaved={handleEditSaved}
            />

            {/* ── Edit Log Dialog ── */}
            <EditLogDialog
                open={logOpen}
                onClose={() => setLogOpen(false)}
                recordId={logRecordId}
                recordName={logRecordName}
                type={logType}
            />

            {/* ── Export Dialog ── */}
            <Dialog open={exportOpen} onClose={() => !exportLoading && setExportOpen(false)} maxWidth="xs" fullWidth
                PaperProps={{ elevation: 0, sx: { borderRadius: "10px", border: `1px solid ${alpha(theme.palette.divider, 0.6)}` } }}>
                <DialogTitle sx={{ fontWeight: 700, fontSize: "1.05rem", pb: 0 }}>
                    Export Attendance Report
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Exports <strong>two files</strong>: one for <strong>Sales Agents</strong> and one for <strong>Office Staff</strong>.
                        Each file has one sheet per day + an Overview sheet.
                    </Typography>
                    <TextField
                        label="Select Month"
                        type="month"
                        fullWidth
                        size="small"
                        value={exportMonth}
                        onChange={(e) => setExportMonth(e.target.value)}
                        disabled={exportLoading}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ "data-testid": "attendance-export-month-input" }}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}
                    />
                    {exportLoading && (
                        <Box mt={2.5}>
                            <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption" color="text.secondary">Fetching data…</Typography>
                                <Typography variant="caption" color="text.secondary">{exportProgress}%</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={exportProgress} sx={{ borderRadius: 2, height: 6 }} />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setExportOpen(false)} disabled={exportLoading} size="small" data-testid="attendance-export-cancel-btn"
                        sx={{ textTransform: "none", color: "text.secondary", borderRadius: RADIUS, px: 2 }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={handleExport}
                        disabled={exportLoading || !exportMonth}
                        data-testid="attendance-export-confirm-btn"
                        startIcon={exportLoading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
                        sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.8125rem", borderRadius: RADIUS, px: 2 }}
                    >
                        {exportLoading ? "Generating…" : `Export ${exportMonthLabel}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── User Detail Modal ── */}
            <AgentDetailModal
                open={detailOpen}
                onClose={() => { setDetailOpen(false); setDetailAgent(null); }}
                agent={detailAgent}
            />
        </>
    );
}

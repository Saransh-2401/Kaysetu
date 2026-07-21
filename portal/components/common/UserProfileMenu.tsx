"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
    Box,
    Typography,
    Avatar,
    Menu,
    MenuItem,
    Divider,
    ListItemIcon,
    useTheme,
    alpha,
    Button,
    Stack,
    Chip,
    CircularProgress,
} from "@mui/material";
import Link from "next/link";
import { UserProfile, authService } from "@/lib/auth-service";
import { KeyboardArrowDownIcon, SettingsIcon, LogoutIcon, HowToRegIcon, ExitToAppIcon, AccessTimeIcon } from "@/components/icons";
import {
    officeAttendanceApi,
    AttendanceStatus,
    formatWorkingHours,
    formatTime,
} from "@/lib/office-attendance-api";

// Roles that use the office attendance system
const OFFICE_ATTENDANCE_ROLES = new Set([
    "admin", "mdo", "executive",
    "accounts_officer",
    "purchase_manager",
    "production_manager",
    "warehouse_manager",
    "sales_manager",
    "distributor",
]);

export default function UserProfileMenu() {
    const theme = useTheme();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    // Attendance state
    const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
    const [attLoading, setAttLoading] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const userData = await authService.getCurrentUser();
                setUser(userData);
            } catch (error) {
                console.error("Failed to load user profile", error);
            }
        };
        loadUser();
    }, []);

    // Office attendance is the ATT module. Without it the check-in endpoints
    // 403, so the whole check-in UI is hidden rather than shown-then-failing.
    const attEntitled = (authService.getOrgContext()?.modules ?? []).includes("ATT");

    // Fetch today's attendance once user is loaded (only for applicable roles
    // in a tenant that actually bought office attendance)
    useEffect(() => {
        if (!user || !attEntitled || !OFFICE_ATTENDANCE_ROLES.has(user.role)) return;
        loadAttendance();
    }, [user, attEntitled]);

    const loadAttendance = useCallback(async () => {
        try {
            const data = await officeAttendanceApi.getToday();
            setAttendance(data);
        } catch {
            // silently ignore — attendance is non-critical
        }
    }, []);

    const handleCheckIn = async (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent menu close
        setAttLoading(true);
        try {
            await officeAttendanceApi.checkIn();
            await loadAttendance();
        } finally {
            setAttLoading(false);
        }
    };

    const handleCheckOut = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setAttLoading(true);
        try {
            await officeAttendanceApi.checkOut();
            await loadAttendance();
        } finally {
            setAttLoading(false);
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => setAnchorEl(null);

    const handleLogout = () => {
        handleClose();
        authService.logout();
        window.location.href = "/login";
    };

    const getInitials = (name: string) => {
        if (!name) return "U";
        return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
    };

    const roleLabels: Record<string, string> = {
        admin: "Administrator",
        sales_manager: "Sales Manager",
        sales_agent: "Sales Agent",
        warehouse_manager: "Warehouse Manager",
        production_manager: "Production Manager",
        purchase_manager: "Purchase Manager",
        accounts_officer: "Accounts Officer",
        distributor: "Distributor",
        mdo: "MDO",
        quality_manager: "Quality Manager",
    };

    if (!user) return null;

    // Show the office check-in UI only when the role uses it AND the tenant
    // actually has the ATT module — otherwise the check-in call 403s.
    const isOfficeRole = OFFICE_ATTENDANCE_ROLES.has(user.role) && attEntitled;
    const isCheckedIn  = Boolean(attendance?.checked_in);
    const isCheckedOut = Boolean(attendance?.checked_out);

    // Dot colour for the status indicator on the avatar
    const statusDotColor = isCheckedIn && !isCheckedOut
        ? theme.palette.success.main   // green — currently in office
        : isCheckedOut
            ? theme.palette.grey[400]  // grey — done for the day
            : undefined;               // no dot — not checked in yet

    return (
        <>
            {/* ── Trigger Button ── */}
            <Box
                onClick={handleClick}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    cursor: "pointer",
                    ml: 1,
                    p: 0.5,
                    pr: 1.5,
                    borderRadius: "50px",
                    transition: "all 0.2s",
                    "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.04) },
                }}
            >
                {/* Avatar with optional status dot */}
                <Box sx={{ position: "relative" }}>
                    <Avatar
                        src={user.profile_image || undefined}
                        alt={user.full_name || user.username}
                        data-testid="header-user-avatar-img"
                        sx={{
                            width: 36,
                            height: 36,
                            bgcolor: "secondary.main",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                        }}
                    >
                        {getInitials(user.full_name || user.username)}
                    </Avatar>
                    {isOfficeRole && statusDotColor && (
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: 1,
                                right: 1,
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                bgcolor: statusDotColor,
                                border: `1.5px solid ${theme.palette.background.paper}`,
                            }}
                        />
                    )}
                </Box>

                <Box sx={{ display: { xs: "none", sm: "block" } }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {user.full_name || user.username}
                    </Typography>
                    {/* Role + attendance status in one line */}
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                            {roleLabels[user.role] || user.role}
                        </Typography>
                        {isOfficeRole && isCheckedIn && !isCheckedOut && (
                            <Chip
                                label="IN"
                                size="small"
                                sx={{
                                    height: 14,
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    bgcolor: alpha(theme.palette.success.main, 0.12),
                                    color: "success.main",
                                    "& .MuiChip-label": { px: 0.6 },
                                }}
                            />
                        )}
                        {isOfficeRole && isCheckedOut && (
                            <Chip
                                label="OUT"
                                size="small"
                                sx={{
                                    height: 14,
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    bgcolor: alpha(theme.palette.grey[500], 0.12),
                                    color: "text.secondary",
                                    "& .MuiChip-label": { px: 0.6 },
                                }}
                            />
                        )}
                    </Stack>
                </Box>
                <KeyboardArrowDownIcon fontSize="small" color="action" />
            </Box>

            {/* ── Dropdown Menu ── */}
            <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={open}
                onClose={handleClose}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        overflow: "visible",
                        filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.1))",
                        mt: 1.5,
                        minWidth: 240,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        "&:before": {
                            content: '""',
                            display: "block",
                            position: "absolute",
                            top: 0,
                            right: 24,
                            width: 10,
                            height: 10,
                            bgcolor: "background.paper",
                            transform: "translateY(-50%) rotate(45deg)",
                            zIndex: 0,
                            borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        },
                    },
                }}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
                {/* User Info Header */}
                <Box sx={{ px: 2.5, py: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={700}>{user.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>
                </Box>
                <Divider />

                {/* ── Attendance Section ── */}
                {isOfficeRole && [
                    <Box key="att-section" sx={{ px: 2, py: 1.5 }} onClick={(e) => e.stopPropagation()}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.2}>
                                <Stack direction="row" alignItems="center" spacing={0.6}>
                                    <AccessTimeIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                                        Attendance
                                    </Typography>
                                </Stack>
                                {isCheckedIn && (
                                    <Chip
                                        label={isCheckedOut ? "Checked Out" : "Checked In"}
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: "0.65rem",
                                            fontWeight: 700,
                                            bgcolor: isCheckedOut
                                                ? alpha(theme.palette.grey[500], 0.1)
                                                : alpha(theme.palette.success.main, 0.1),
                                            color: isCheckedOut ? "text.secondary" : "success.main",
                                        }}
                                    />
                                )}
                            </Stack>

                            {/* State 1: Not checked in */}
                            {!isCheckedIn && (
                                <Button
                                    fullWidth
                                    variant="contained"
                                    size="small"
                                    color="success"
                                    startIcon={attLoading ? <CircularProgress size={14} color="inherit" /> : <HowToRegIcon />}
                                    onClick={handleCheckIn}
                                    disabled={attLoading}
                                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                                >
                                    {attLoading ? "Checking in…" : "Check In"}
                                </Button>
                            )}

                            {/* State 2: Checked in, not yet checked out */}
                            {isCheckedIn && !isCheckedOut && (
                                <Stack spacing={1}>
                                    <Typography variant="caption" color="text.secondary">
                                        Since {formatTime(attendance?.check_in_time ?? null)}
                                    </Typography>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        color="warning"
                                        startIcon={attLoading ? <CircularProgress size={14} color="inherit" /> : <ExitToAppIcon />}
                                        onClick={handleCheckOut}
                                        disabled={attLoading}
                                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                                    >
                                        {attLoading ? "Checking out…" : "Check Out"}
                                    </Button>
                                </Stack>
                            )}

                            {/* State 3: Fully done — show total hours */}
                            {isCheckedIn && isCheckedOut && (
                                <Stack spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="caption" color="text.secondary">Check In</Typography>
                                        <Typography variant="caption" fontWeight={600}>
                                            {formatTime(attendance?.check_in_time ?? null)}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="caption" color="text.secondary">
                                            Check Out{attendance?.check_out_type === "auto" ? " (Auto)" : ""}
                                        </Typography>
                                        <Typography variant="caption" fontWeight={600}>
                                            {formatTime(attendance?.check_out_time ?? null)}
                                        </Typography>
                                    </Stack>
                                    <Divider sx={{ my: 0.5 }} />
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                            Total Hours
                                        </Typography>
                                        <Chip
                                            label={formatWorkingHours(attendance?.working_hours ?? 0)}
                                            size="small"
                                            sx={{
                                                height: 20,
                                                fontSize: "0.7rem",
                                                fontWeight: 700,
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                color: "primary.main",
                                            }}
                                        />
                                    </Stack>
                                </Stack>
                            )}
                    </Box>,
                    <Divider key="att-divider" />,
                ]}

                {/* Profile Settings */}
                <MenuItem component={Link} href="/profile-settings">
                    <ListItemIcon>
                        <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    Profile Settings
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    Sign Out
                </MenuItem>
            </Menu>
        </>
    );
}

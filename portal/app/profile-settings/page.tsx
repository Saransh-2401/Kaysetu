"use client";
import React, { useState, useEffect } from "react";
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    Button,
    Avatar,
    Divider,
    Stack,
    useTheme,
    alpha,
    CircularProgress,
    IconButton,
    InputAdornment,
    Alert,
    Snackbar,
    Chip,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { PersonIcon, LockIcon, VisibilityIcon as Visibility, VisibilityOffIcon as VisibilityOff, EmailIcon, PhoneIcon, BadgeIcon, SecurityIcon, ShieldIcon, ContactPageIcon } from "@/components/icons";

import { authService, UserProfile } from "@/lib/auth-service";
import { formatDRFError } from "@/lib/utils";

export default function ProfileSettingsPage() {
    const theme = useTheme();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Password state
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Feedback state
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const data = await authService.getCurrentUser();
            setUser(data);
        } catch (error) {
            console.error("Error fetching profile:", error);
            showSnackbar("Failed to load profile data", "error");
        } finally {
            setLoading(false);
        }
    };

    const showSnackbar = (message: string, severity: "success" | "error") => {
        setSnackbar({ open: true, message, severity });
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (newPassword !== confirmPassword) {
            showSnackbar("New passwords do not match", "error");
            return;
        }

        if (newPassword.length < 8) {
            showSnackbar("Password must be at least 8 characters long", "error");
            return;
        }

        try {
            setSaving(true);
            await authService.changePassword(user.id, oldPassword, newPassword, confirmPassword);
            showSnackbar("Password changed successfully", "success");
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            console.error("Error changing password:", error);
            showSnackbar(formatDRFError(error) || "Failed to change password", "error");
        } finally {
            setSaving(false);
        }
    };

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            admin: "Administrator",
            sales_manager: "Sales Manager",
            sales_agent: "Sales Agent",
            distributor: "Distributor",
            warehouse_manager: "Warehouse Manager",
            production_manager: "Production Manager",
            purchase_manager: "Purchase Manager",
            accounts_officer: "Accounts Officer",
        };
        return labels[role] || role;
    };

    if (loading) {
        return (
            <>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 70%)` }}>
                    <CircularProgress thickness={5} size={60} />
                </Box>
            </>
        );
    }

    const cardStyles = {
        p: { xs: 3, md: 5 },
        borderRadius: 6,
        background: theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`
            : `linear-gradient(135deg, #ffffff 0%, ${alpha('#f8f9fa', 0.8)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        boxShadow: theme.palette.mode === 'dark'
            ? '0 20px 40px rgba(0,0,0,0.3)'
            : '0 20px 40px rgba(0,0,0,0.05)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
    };

    const readOnlyFieldStyles = {
        '& .MuiOutlinedInput-root': {
            borderRadius: 1,
            backgroundColor: alpha(theme.palette.action.disabledBackground, 0.05),
            '& fieldset': {
                borderColor: alpha(theme.palette.divider, 0.2),
            },
            '&:hover fieldset': {
                borderColor: alpha(theme.palette.divider, 0.2),
            },
            '&.Mui-disabled': {
                color: theme.palette.text.primary,
                WebkitTextFillColor: theme.palette.text.primary,
                '& fieldset': {
                    borderColor: alpha(theme.palette.divider, 0.1),
                },
            },
        },
        '& .MuiInputLabel-root.Mui-disabled': {
            color: theme.palette.text.secondary,
        },
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
    };

    return (
        <>
            <Box sx={{
                minHeight: 'calc(100vh - 100px)',
                py: { xs: 4, md: 8 },
                px: 2
            }}>
                <Box sx={{ maxWidth: '1100px', mx: 'auto' }}>
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <Paper elevation={0} sx={cardStyles}>
                            <Grid container spacing={6}>
                                {/* Left Side: Profile Info */}
                                <Grid size={{ xs: 12, md: 5 }}>
                                    <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2.5 }}>
                                        <Avatar
                                            sx={{
                                                width: 90,
                                                height: 90,
                                                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                                                color: '#fff',
                                                fontSize: '2.2rem',
                                                fontWeight: 800,
                                                boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
                                                border: `3px solid #fff`
                                            }}
                                        >
                                            {user?.full_name?.charAt(0) || user?.username?.charAt(0) || "U"}
                                        </Avatar>
                                        <Box>
                                            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                                                {user?.full_name || user?.username}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, opacity: 0.8 }}>
                                                {getRoleLabel(user?.role || "")}
                                            </Typography>
                                            <Chip
                                                icon={<ShieldIcon sx={{ fontSize: '0.9rem !important' }} />}
                                                label="Verified Member"
                                                size="small"
                                                sx={{
                                                    bgcolor: alpha(theme.palette.success.main, 0.08),
                                                    color: 'success.main',
                                                    fontWeight: 700,
                                                    height: 24,
                                                    borderRadius: 1.5
                                                }}
                                            />
                                        </Box>
                                    </Box>

                                    <Divider sx={{ mb: 4, opacity: 0.5 }} />

                                    <Stack spacing={2.5}>
                                        <Box display="flex" alignItems="center" gap={1.2} mb={1}>
                                            <ContactPageIcon color="primary" sx={{ opacity: 0.8, fontSize: '1.2rem' }} />
                                            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                                                Public Identity
                                            </Typography>
                                        </Box>

                                        <TextField
                                            fullWidth
                                            label="Display Name"
                                            value={user?.full_name || ""}
                                            disabled
                                            size="small"
                                            sx={readOnlyFieldStyles}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <PersonIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                        <TextField
                                            fullWidth
                                            label="Registered Email"
                                            value={user?.email || ""}
                                            disabled
                                            size="small"
                                            sx={readOnlyFieldStyles}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <EmailIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                        <TextField
                                            fullWidth
                                            label="User Handle"
                                            value={user?.username || ""}
                                            disabled
                                            size="small"
                                            sx={readOnlyFieldStyles}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <BadgeIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                        <TextField
                                            fullWidth
                                            label="Contact Number"
                                            value={user?.phone || "Not specified"}
                                            disabled
                                            size="small"
                                            sx={readOnlyFieldStyles}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <PhoneIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                    </Stack>

                                    <Box sx={{ mt: 4 }}>
                                        <Alert severity="info" variant="outlined" sx={{ borderRadius: 2, py: 0.5, borderStyle: 'dashed', backgroundColor: 'transparent' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                                Identity details are managed by Admin and cannot be edited locally.
                                            </Typography>
                                        </Alert>
                                    </Box>
                                </Grid>

                                {/* Right Side: Security */}
                                <Grid
                                    size={{ xs: 12, md: 7 }}
                                    sx={{
                                        pl: { md: 6 },
                                        borderLeft: { md: `1px solid ${alpha(theme.palette.divider, 0.1)}` }
                                    }}
                                >
                                    <form onSubmit={handlePasswordChange}>
                                        <Box display="flex" alignItems="center" gap={2} mb={4}>
                                            <Box sx={{
                                                p: 1.2,
                                                borderRadius: 2,
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                color: 'primary.main',
                                                display: 'flex'
                                            }}>
                                                <SecurityIcon fontSize="small" />
                                            </Box>
                                            <Box>
                                                <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em' }}>
                                                    Security & Privacy
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Manage your account security and authentication
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Divider sx={{ mb: 4, opacity: 0.5 }} />

                                        <Stack spacing={3}>
                                            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                                                Update Credentials
                                            </Typography>

                                            <TextField
                                                fullWidth
                                                label="Current Password"
                                                type={showOldPassword ? "text" : "password"}
                                                value={oldPassword}
                                                onChange={(e) => setOldPassword(e.target.value)}
                                                required
                                                size="small"
                                                placeholder="Verification required"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <LockIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.6 }} />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton onClick={() => setShowOldPassword(!showOldPassword)} edge="end" size="small">
                                                                {showOldPassword ? <VisibilityOff sx={{ fontSize: '1rem' }} /> : <Visibility sx={{ fontSize: '1rem' }} />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />

                                            <TextField
                                                fullWidth
                                                label="New Secure Password"
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                required
                                                size="small"
                                                placeholder="Create new password"
                                                helperText="Must be at least 8 characters"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <LockIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.6 }} />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end" size="small">
                                                                {showNewPassword ? <VisibilityOff sx={{ fontSize: '1rem' }} /> : <Visibility sx={{ fontSize: '1rem' }} />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />

                                            <TextField
                                                fullWidth
                                                label="Confirm New Password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                required
                                                size="small"
                                                placeholder="Repeat new password"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <LockIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.6 }} />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small">
                                                                {showConfirmPassword ? <VisibilityOff sx={{ fontSize: '1rem' }} /> : <Visibility sx={{ fontSize: '1rem' }} />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />

                                            <Box sx={{ mt: 2 }}>
                                                <Button
                                                    type="submit"
                                                    variant="contained"
                                                    fullWidth
                                                    disabled={saving}
                                                    sx={{
                                                        borderRadius: 2,
                                                        py: 1.5,
                                                        fontWeight: 800,
                                                        textTransform: 'none',
                                                        letterSpacing: '0.01em',
                                                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                                                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.35)}`,
                                                        '&:hover': {
                                                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                                                            transform: 'translateY(-1px)',
                                                            boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.45)}`,
                                                        },
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    }}
                                                >
                                                    {saving ? <CircularProgress size={20} color="inherit" /> : "Verify Identity & Update"}
                                                </Button>
                                            </Box>
                                        </Stack>
                                    </form>
                                </Grid>
                            </Grid>
                        </Paper>
                    </motion.div>
                </Box>
            </Box>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    elevation={6}
                    variant="filled"
                    sx={{
                        width: '100%',
                        borderRadius: 1,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                        fontWeight: 600
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
}

"use client";
import { Box, Container, Typography, Grid, Stack, Button, alpha, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import { CheckCircleOutlineIcon, LocationOnIcon, SpeedIcon, SignalCellularAltIcon } from "@/components/icons";

const features = [
    "GPS-Verified Check-ins",
    "Real-time Order Collection",
    "Route Optimization",
    "Offline Data Support",
    "Performance Dashboards",
    "Inventory Visibility",
];

export default function SalesAppShowcase() {
    const theme = useTheme();

    return (
        <Box sx={{ py: { xs: 10, md: 15 }, bgcolor: "#050505", color: "#fff", position: "relative", overflow: "hidden" }}>
            <Box className="fancy-grid dark" sx={{ position: "absolute", inset: 0, opacity: 0.1, zIndex: 0 }} />

            <Typography
                variant="h1"
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.05,
                    fontSize: { xs: '10rem', md: '25rem' },
                    fontWeight: 900,
                    zIndex: 0,
                    color: alpha("#fff", 0.1),
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                }}
            >
                MOBILE
            </Typography>
            <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
                <Grid container spacing={8} alignItems="center" justifyContent="center">
                    <Grid size={{ xs: 12, lg: 6 }} order={{ xs: 2, lg: 1 }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8 }}
                        >
                            <Box
                                sx={{
                                    position: "relative",
                                    maxWidth: 600,
                                    mx: "auto",
                                }}
                            >
                                {/* Background Shadow Glow */}
                                <Box
                                    sx={{
                                        position: "absolute",
                                        top: "10%",
                                        left: "10%",
                                        right: "10%",
                                        bottom: "10%",
                                        background: alpha(theme.palette.secondary.main, 0.1),
                                        filter: "blur(70px)",
                                        borderRadius: "50%",
                                        zIndex: 0,
                                    }}
                                />

                                {/* Smartphone Visual Container */}
                                <Box
                                    sx={{
                                        width: '320px',
                                        height: '640px',
                                        bgcolor: '#0A0A0A',
                                        borderRadius: 8,
                                        border: `12px solid #1A1A1A`,
                                        boxShadow: `0 40px 100px -20px ${alpha("#000", 0.8)}`,
                                        mx: 'auto',
                                        position: 'relative',
                                        zIndex: 1,
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Phone Notch */}
                                    <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '40%', height: '24px', bgcolor: '#1A1A1A', borderRadius: '0 0 16px 16px' }} />

                                    {/* App Content Simulation */}
                                    <Box sx={{ mt: 5, p: 3 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                                            <Typography variant="h6" fontWeight={800} color="secondary">Visits</Typography>
                                            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: alpha(theme.palette.secondary.main, 0.15) }} />
                                        </Stack>

                                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.secondary.main, 0.1), border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`, mb: 3 }}>
                                            <Typography variant="caption" color="secondary.light" fontWeight={800}>NEXT APPOINTMENT</Typography>
                                            <Typography variant="subtitle1" fontWeight={800} color="#fff">Royal Palace Hotel</Typography>
                                            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                                                <LocationOnIcon sx={{ fontSize: 14, color: alpha("#fff", 0.5) }} />
                                                <Typography variant="caption" color={alpha("#fff", 0.5)}>2.4 km away</Typography>
                                            </Stack>
                                        </Box>

                                        <Typography variant="subtitle2" fontWeight={800} gutterBottom color="#fff">Today's Performance</Typography>
                                        <Grid container spacing={1.5}>
                                            {[1, 2, 3, 4].map(i => (
                                                <Grid key={i} size={{ xs: 6 }}>
                                                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha("#fff", 0.05), border: `1px solid ${alpha("#fff", 0.1)}` }}>
                                                        <Typography variant="caption" color={alpha("#fff", 0.5)}>Metric {i}</Typography>
                                                        <Typography variant="subtitle2" fontWeight={800} color="#fff">₹4,200</Typography>
                                                    </Box>
                                                </Grid>
                                            ))}
                                        </Grid>

                                        <Box sx={{ position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)', width: '80%' }}>
                                            <Button
                                                variant="contained"
                                                fullWidth
                                                sx={{
                                                    borderRadius: '16px',
                                                    py: 1.5,
                                                    background: 'linear-gradient(135deg, #D4AF37 0%, #AA8222 100%)',
                                                    color: '#000',
                                                    fontWeight: 900,
                                                    letterSpacing: '0.05em',
                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                    boxShadow: `0 8px 20px ${alpha('#D4AF37', 0.3)}, inset 0 2px 0 rgba(255,255,255,0.3)`,
                                                    "&:hover": {
                                                        background: 'linear-gradient(135deg, #E5C354 0%, #C19A2B 100%)',
                                                        transform: "scale(1.03) translateY(-2px)",
                                                        boxShadow: `0 12px 25px ${alpha('#D4AF37', 0.5)}, inset 0 2px 0 rgba(255,255,255,0.4)`,
                                                    },
                                                    "&:active": {
                                                        transform: "scale(0.98) translateY(0)",
                                                    },
                                                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                                }}
                                            >
                                                Start Check-in
                                            </Button>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Floating Elements Around */}
                                <Box sx={{ position: 'absolute', top: '15%', right: '5%', bgcolor: alpha("#fff", 0.05), border: `1px solid ${alpha("#fff", 0.1)}`, backdropFilter: 'blur(10px)', p: 1.5, borderRadius: 2, zIndex: 2, display: { xs: 'none', md: 'block' } }}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <SignalCellularAltIcon sx={{ color: '#4CAF50' }} />
                                        <Typography variant="caption" fontWeight={700} color="#fff">98% Sync Score</Typography>
                                    </Stack>
                                </Box>
                                <Box sx={{ position: 'absolute', bottom: '25%', left: '5%', bgcolor: alpha("#fff", 0.05), border: `1px solid ${alpha("#fff", 0.1)}`, backdropFilter: 'blur(10px)', p: 1.5, borderRadius: 2, zIndex: 2, display: { xs: 'none', md: 'block' } }}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <SpeedIcon sx={{ color: 'secondary.main' }} />
                                        <Typography variant="caption" fontWeight={700} color="#fff">Instant Reporting</Typography>
                                    </Stack>
                                </Box>
                            </Box>
                        </motion.div>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 6 }} order={{ xs: 1, lg: 2 }}>
                        <Stack spacing={4}>
                            <Box>
                                <Typography variant="caption" color="secondary.main" fontWeight={900} sx={{ letterSpacing: '0.2em' }}>MOBILE POWER</Typography>
                                <Typography
                                    variant="h2"
                                    sx={{
                                        color: "#fff",
                                        fontWeight: 800,
                                        fontSize: { xs: "2.5rem", md: "3.5rem" },
                                        letterSpacing: "-0.02em",
                                        mt: 1
                                    }}
                                >
                                    Designed for the<br />
                                    <Box component="span" sx={{ color: 'secondary.main' }}>Field Sales Hero</Box>
                                </Typography>
                            </Box>

                            <Typography variant="h6" color={alpha("#fff", 0.6)} sx={{ fontWeight: 400, lineHeight: 1.7 }}>
                                Empower your sales force with a specialized mobile experience that works as hard as they do.
                                Complete with GPS verification, offline order logging, and instant performance metrics.
                            </Typography>

                            <Grid container spacing={2}>
                                {features.map((feature, index) => (
                                    <Grid key={index} size={{ xs: 12, sm: 6 }}>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <CheckCircleOutlineIcon sx={{ color: "secondary.main" }} />
                                            <Typography variant="subtitle1" fontWeight={600} color="#fff">
                                                {feature}
                                            </Typography>
                                        </Stack>
                                    </Grid>
                                ))}
                            </Grid>


                        </Stack>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}

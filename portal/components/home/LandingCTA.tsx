"use client";
import { Box, Container, Typography, Button, Stack, alpha, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import { ArrowForwardIcon } from "@/components/icons";

export default function LandingCTA() {
    const theme = useTheme();

    return (
        <Box sx={{ py: 15, bgcolor: "#050505", position: "relative", overflow: "hidden" }}>
            {/* Section Decoration */}
            <Box className="fancy-grid dark" sx={{ position: "absolute", inset: 0, opacity: 0.1, zIndex: 0 }} />

            <Typography
                variant="h1"
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.05,
                    fontSize: { xs: '6rem', md: '15rem' },
                    fontWeight: 900,
                    zIndex: 0,
                    color: alpha("#fff", 0.1),
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                }}
            >
                GROWTH
            </Typography>

            {/* Decorative Background Glow */}
            <Box
                sx={{
                    position: "absolute",
                    top: "0",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "100%",
                    height: "100%",
                    background: `radial-gradient(circle at center, ${alpha("#d4af37", 0.05)} 0%, transparent 60%)`,
                    zIndex: 0,
                }}
            />

            <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                >
                    <Stack spacing={4} alignItems="center">
                        <Typography
                            variant="h2"
                            sx={{
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: { xs: "2.5rem", md: "4rem" },
                                letterSpacing: "-0.03em",
                            }}
                        >
                            Ready to Orchestrate <br />
                            <Box component="span" sx={{ color: "#d4af37" }}>Your Growth?</Box>
                        </Typography>

                        <Typography variant="h6" sx={{ color: alpha("#fff", 0.6), fontWeight: 400, maxWidth: 600 }}>
                            Join the elite league of enterprises using KaySetu to digitize,
                            automate, and scale their operations globally.
                        </Typography>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 2, width: { xs: '100%', sm: 'auto' } }}>
                            <Button
                                variant="contained"
                                size="large"
                                endIcon={<ArrowForwardIcon />}
                                sx={{
                                    py: 2,
                                    px: 6,
                                    fontSize: '1.1rem',
                                    fontWeight: 900,
                                    bgcolor: "#d4af37",
                                    borderRadius: 10,
                                    '&:hover': {
                                        bgcolor: "#fff",
                                    }
                                }}
                            >
                                Get Started Now
                            </Button>
                            <Button
                                variant="outlined"
                                size="large"
                                sx={{
                                    py: 2,
                                    px: 6,
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    borderColor: alpha("#d4af37", 0.3),
                                    color: "#d4af37",
                                    borderRadius: 10,
                                    '&:hover': {
                                        borderColor: "#d4af37",
                                        bgcolor: alpha("#d4af37", 0.05)
                                    }
                                }}
                            >
                                Request a Demo
                            </Button>
                        </Stack>

                        <Typography variant="caption" sx={{ color: alpha('#fff', 0.4), mt: 4, letterSpacing: '0.1em', fontWeight: 600 }}>
                            NO CREDIT CARD REQUIRED • PREMIUM ENTERPRISE SUPPORT
                        </Typography>
                    </Stack>
                </motion.div>
            </Container>
        </Box>
    );
}

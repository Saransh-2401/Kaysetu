"use client";
import { Box, Container, Typography, Grid, Stack, alpha, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import { SmartphoneIcon, WarehouseIcon, FactoryIcon, AccountBalanceIcon, TrendingUpIcon } from "@/components/icons";

import ElectricBorder from "@/components/ui/electric-border";

const flowSteps = [
    {
        title: "Production Planning",
        description: "Low stock triggers manufacturing work orders. Track production stages from raw material to finished good.",
        icon: <FactoryIcon fontSize="large" />,
        color: "#D4AF37",
    },
    {
        title: "Field Sales Capture",
        description: "Sales agents use our GPS-integrated mobile app to record visits and collect orders in real-time.",
        icon: <SmartphoneIcon fontSize="large" />,
        color: "#D4AF37",
    },
    {
        title: "Warehouse Fulfillment",
        description: "Orders instantly sync with the warehouse for picking, packing, and automated inventory adjustment.",
        icon: <WarehouseIcon fontSize="large" />,
        color: "#D4AF37",
    },
    {
        title: "Automated Ledgering",
        description: "Every transaction automatically hits the accounting module, generating invoices and ledger entries.",
        icon: <AccountBalanceIcon fontSize="large" />,
        color: "#D4AF37",
    },
];

export default function EcosystemFlow() {
    const theme = useTheme();

    return (
        <Box sx={{ py: { xs: 10, md: 15 }, bgcolor: "#050505", color: "#fff", position: "relative", overflow: "hidden" }}>
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
                    fontSize: { xs: '10rem', md: '25rem' },
                    fontWeight: 900,
                    zIndex: 0,
                    color: alpha("#fff", 0.1),
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                }}
            >
                PROCESS
            </Typography>
            <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
                <Stack spacing={2} sx={{ mb: 8, textAlign: "center", alignItems: "center" }}>
                    <Typography
                        variant="h2"
                        sx={{
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: { xs: "2.5rem", md: "3.5rem", lg: "4rem" },
                            letterSpacing: "-0.03em",
                            lineHeight: 1.2,
                        }}
                    >
                        The Full Circle Ecosystem
                    </Typography>
                    <Typography
                        variant="h6"
                        sx={{ color: alpha("#fff", 0.6), maxWidth: 700, fontWeight: 400, opacity: 0.8 }}
                    >
                        From the field to the balance sheet, KaySetu automates every heartbeat of your business operations.
                    </Typography>
                </Stack>

                <Grid container spacing={4} justifyContent="center" alignItems="stretch">
                    {flowSteps.map((step, index) => (
                        <Grid key={index} size={{ xs: 12, md: 6, lg: 3 }}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                viewport={{ once: true }}
                                style={{ height: "100%" }}
                            >
                                <ElectricBorder
                                    color="#d4af37"
                                    speed={1.5}
                                    chaos={0.4}
                                    thickness={2}
                                    style={{ height: "100%", borderRadius: '16px' }}
                                >
                                    <Box
                                        sx={{
                                            p: 4,
                                            height: "100%",
                                            minHeight: { xs: "auto", lg: 320 },
                                            borderRadius: '16px',
                                            bgcolor: alpha("#fff", 0.03),
                                            border: `1px solid ${alpha("#fff", 0.05)}`,
                                            backdropFilter: "blur(10px)",
                                            transition: "all 0.4s ease",
                                            display: "flex",
                                            flexDirection: "column",
                                            "&:hover": {
                                                transform: "translateY(-5px)",
                                                bgcolor: alpha("#fff", 0.06),
                                            },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 60,
                                                height: 60,
                                                borderRadius: 2,
                                                bgcolor: alpha("#d4af37", 0.1),
                                                color: "#d4af37",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                mb: 3,
                                            }}
                                        >
                                            {step.icon}
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: "#fff" }}>
                                            {step.title}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: alpha("#fff", 0.6), lineHeight: 1.6 }}>
                                            {step.description}
                                        </Typography>
                                    </Box>
                                </ElectricBorder>
                            </motion.div>
                        </Grid>
                    ))}
                </Grid>


                {/* Visual Connector / Value Line */}
                <Box sx={{ mt: 10, p: 4, borderRadius: 3, bgcolor: alpha(theme.palette.secondary.main, 0.05), border: `1px dashed ${alpha(theme.palette.secondary.main, 0.3)}` }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center" justifyContent="center">
                        <TrendingUpIcon color="secondary" sx={{ fontSize: 40 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', textAlign: 'center' }}>
                            Reduce operational friction by up to 45% with integrated workflows.
                        </Typography>
                    </Stack>
                </Box>
            </Container>
        </Box>
    );
}

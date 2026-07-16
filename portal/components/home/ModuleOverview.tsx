"use client";
import { Box, Container, Typography, alpha, Grid, Card, CardContent } from "@mui/material";
import { AdminPanelSettingsIcon as AdminPanelSettings, ShoppingCartIcon as ShoppingCart, WarehouseIcon as Warehouse, FactoryIcon as Factory, AccountBalanceIcon as AccountBalance, GroupsIcon as Groups } from "@/components/icons";
import ElectricBorder from "@/components/ui/electric-border";

const modules = [
    {
        title: "Executive Control",
        description: "High-level analytics and multi-client management for stakeholders.",
        icon: <AdminPanelSettings />,
        role: "Admin & Executive",
    },
    {
        title: "Procurement Engine",
        description: "Streamlined purchase orders and supplier management system.",
        icon: <ShoppingCart />,
        role: "Purchase & Supply",
    },
    {
        title: "Inventory Intelligence",
        description: "Stock tracking across multiple warehouses with real-time sync.",
        icon: <Warehouse />,
        role: "Logistics & Store",
    },
    {
        title: "Production Mastery",
        description: "Manage work orders, bills of materials, and factory output.",
        icon: <Factory />,
        role: "Manufacturing",
    },
    {
        title: "Financial Integrity",
        description: "Automated billing, invoicing, and comprehensive ledger management.",
        icon: <AccountBalance />,
        role: "Accounts & Finance",
    },
    {
        title: "Customer Success",
        description: "Full CRM suite for managing client relationships and history.",
        icon: <Groups />,
        role: "Sales & CRM",
    },
];

export default function ModuleOverview() {
    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "#050505",
                color: "#fff",
                position: "relative",
                overflow: "hidden",
                py: 10
            }}
        >
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
                MODULES
            </Typography>

            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                {/* Header Section */}
                <Box sx={{ textAlign: "center", mb: 8 }}>
                    <Typography
                        variant="h2"
                        sx={{
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: { xs: "2.5rem", md: "3.5rem" },
                            letterSpacing: "-0.02em",
                            mb: 3
                        }}
                    >
                        Built for Industry Leaders
                    </Typography>
                    <Typography
                        variant="h6"
                        sx={{ color: alpha("#fff", 0.6), maxWidth: 800, fontWeight: 400, mx: 'auto' }}
                    >
                        Every department, every role, every process – unified in one elegant platform.
                    </Typography>
                </Box>

                {/* Grid Layout */}
                <Grid container spacing={4}>
                    {modules.map((module, index) => (
                        <Grid key={index} size={{ xs: 12, md: 6 }}>
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
                                        borderRadius: '16px',
                                        bgcolor: alpha("#fff", 0.03),
                                        border: `1px solid ${alpha("#fff", 0.05)}`,
                                        backdropFilter: "blur(10px)",
                                        transition: "all 0.4s ease",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        textAlign: "center",
                                        "&:hover": {
                                            transform: "translateY(-5px)",
                                            bgcolor: alpha("#fff", 0.06),
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 70,
                                            height: 70,
                                            borderRadius: 2,
                                            bgcolor: alpha("#d4af37", 0.1),
                                            color: "#d4af37",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            mb: 3,
                                        }}
                                    >
                                        <Box sx={{ "& svg": { fontSize: "2.1875rem" } }}>
                                            {module.icon}
                                        </Box>
                                    </Box>

                                    <Typography
                                        variant="h6"
                                        component="h3"
                                        gutterBottom
                                        sx={{ fontWeight: 800, color: "#fff" }}
                                    >
                                        {module.title}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mb: 2, fontWeight: 'bold', color: "#d4af37", textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem' }}>
                                        {module.role}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: alpha("#fff", 0.6), lineHeight: 1.6 }}>
                                        {module.description}
                                    </Typography>
                                </Box>
                            </ElectricBorder>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
}

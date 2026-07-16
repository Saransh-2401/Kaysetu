"use client";
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
} from "@mui/material";
import { AdminPanelSettingsIcon, DirectionsRunIcon, SupervisorAccountIcon, LocalShippingIcon, WarehouseIcon, AccountBalanceIcon, ShoppingCartIcon, FactoryIcon } from "@/components/icons";
import Link from "next/link";

const dashboards = [
  {
    title: "Admin Dashboard",
    icon: <AdminPanelSettingsIcon fontSize="large" />,
    role: "System Admin",
    href: "/admin",
  },
  {
    title: "Sales Agent",
    icon: <DirectionsRunIcon fontSize="large" />,
    role: "Field Sales",
    href: "/sales-agent",
  },
  {
    title: "Sales Manager",
    icon: <SupervisorAccountIcon fontSize="large" />,
    role: "Sales Team Lead",
    href: "/sales-manager",
  },
  {
    title: "Distributor",
    icon: <LocalShippingIcon fontSize="large" />,
    role: "External Partner",
    href: "/distributor",
  },
  {
    title: "Warehouse Manager",
    icon: <WarehouseIcon fontSize="large" />,
    role: "Inventory Control",
    href: "/warehouse",
  },
  {
    title: "Accounts Officer",
    icon: <AccountBalanceIcon fontSize="large" />,
    role: "Finance & Billing",
    href: "/accounts",
  },
  {
    title: "Purchase Manager",
    icon: <ShoppingCartIcon fontSize="large" />,
    role: "Procurement",
    href: "/purchase",
  },
  {
    title: "Production Manager",
    icon: <FactoryIcon fontSize="large" />,
    role: "Manufacturing",
    href: "/production",
  },
];

export default function DashboardGrids() {
  return (
    <Box sx={{ py: 10, bgcolor: "background.paper" }}>
      <Container maxWidth="lg">
        <Typography
          variant="h3"
          component="h2"
          align="center"
          gutterBottom
          sx={{ fontWeight: "bold", mb: 6 }}
        >
          Select Your Portal
        </Typography>
        {/* Using Grid v2 syntax (size prop) as per project setup */}
        <Grid container spacing={4}>
          {dashboards.map((dash, index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
              <Link href={dash.href}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "transform 0.2s",
                    "&:hover": {
                      transform: "translateY(-5px)",
                      boxShadow: 6,
                    },
                  }}
                >
                  <CardActionArea
                    sx={{
                      flexGrow: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      p: 3,
                      textAlign: "center",
                    }}
                  >
                    <Box
                      sx={{
                        mb: 2,
                        p: 2,
                        borderRadius: "50%",
                        bgcolor: "primary.light",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {dash.icon}
                    </Box>
                    <CardContent>
                      <Typography
                        variant="h6"
                        component="h3"
                        gutterBottom
                        sx={{ fontWeight: 600 }}
                      >
                        {dash.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {dash.role}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Link>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

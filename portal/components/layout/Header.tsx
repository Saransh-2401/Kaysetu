"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  alpha,
  Stack,
} from "@mui/material";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  // Removed navigation items as per user request
  const navItems: string[] = [];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);



  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "transparent",
          backgroundImage: "none",
          top: scrolled ? 10 : 20,
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1100,
          backdropFilter: "none !important",
          borderBottom: "none !important"
        }}
      >
        <Container maxWidth="xl" sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 800,
              bgcolor: "#0A0A0A", // Solid background, no glass
              borderRadius: "100px",
              border: `1px solid ${alpha("#fff", 0.1)}`,
              px: { xs: 2, md: 4 },
              py: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: scrolled ? `0 20px 40px ${alpha("#000", 0.5)}` : "none",
            }}
          >
            <Toolbar disableGutters sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
              {/* --- LOGO --- */}
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography
                  variant="h5"
                  noWrap
                  component="a"
                  href="/"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                  }}
                >
                  KAYSETU
                </Typography>
              </Box>

              {/* --- ACTIONS --- */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Link
                  href="/login"
                  className="cursor-target"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#FFFFFF",
                    color: "#000000",
                    padding: "10px 32px",
                    borderRadius: "50px",
                    textDecoration: "none",
                    fontWeight: "900",
                    fontSize: "0.95rem",
                    transition: "all 0.3s ease",
                    border: "none",
                    zIndex: 100
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#F0F0F0")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                >
                  Get Started
                </Link>
              </Stack>
            </Toolbar>
          </Box>
        </Container>
      </AppBar>
    </>
  );
}


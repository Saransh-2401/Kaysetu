"use client";
import React from "react";
import { Box, Grid, Typography, Stack, useTheme, alpha } from "@mui/material";
import { motion } from "framer-motion";
import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  imageSrc: string;
  linkText?: string;
  linkUrl?: string;
  linkActionText?: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
  imageSrc,
  linkText,
  linkUrl,
  linkActionText,
}: AuthLayoutProps) {
  const theme = useTheme();

  return (
    <Grid container sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* --- Left Side: Form Section --- */}
      <Grid
        size={{ xs: 12, md: 5, lg: 4 }}
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          p: { xs: 4, md: 8 },
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Animated Form Container */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Logo */}
          <Box sx={{ mb: 6 }}>
            <Typography
              variant="h4"
              sx={{
                color: "primary.main",
                fontFamily: theme.typography.h4.fontFamily, // Cinzel
                fontWeight: 700,
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
              }}
            >
              KAYSETU
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  bgcolor: "secondary.main",
                  borderRadius: "50%",
                  ml: 1,
                  mb: 1,
                }}
              />
            </Typography>
          </Box>

          {/* Header Text */}
          <Box sx={{ mb: 5 }}>
            <Typography
              variant="h3"
              sx={{ fontWeight: 800, mb: 1, color: "text.primary" }}
            >
              {title}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>

          {/* The Form */}
          {children}

          {/* Footer Link */}
          {linkText && linkUrl && linkActionText && (
            <Box sx={{ mt: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {linkText}{" "}
                <Link
                  href={linkUrl}
                  style={{
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {linkActionText}
                </Link>
              </Typography>
            </Box>
          )}
        </motion.div>

        {/* Copyright */}
        <Box sx={{ mt: "auto", pt: 5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", textAlign: "center" }}
          >
            © {new Date().getFullYear()} KaySetu Inc. Privacy & Terms.
          </Typography>
        </Box>
      </Grid>

      {/* --- Right Side: Hero Image --- */}
      <Grid
        size={{ xs: false, md: 7, lg: 8 }}
        sx={{
          position: "relative",
          backgroundImage: `url(${imageSrc})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: { xs: "none", md: "block" },
        }}
      >
        {/* Overlay Gradient */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(to right, ${theme.palette.background.default
              } 0%, ${alpha(theme.palette.primary.main, 0.4)} 100%)`,
          }}
        />

        {/* Floating Text on Image (Optional) */}
        <Box
          sx={{
            position: "absolute",
            bottom: 80,
            left: 80,
            maxWidth: 500,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <Typography
              variant="h2"
              color="white"
              sx={{
                fontWeight: 700,
                mb: 2,
                textShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              Manage with Precision.
            </Typography>
            <Typography variant="h6" color="rgba(255,255,255,0.8)">
              Join 500+ luxury enterprises scaling their operations with KaySetu.
            </Typography>
          </motion.div>
        </Box>
      </Grid>
    </Grid>
  );
}

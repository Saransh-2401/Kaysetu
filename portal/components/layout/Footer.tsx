"use client";
import React from "react";
import { alpha, useTheme, Box, Container, Typography } from "@mui/material";
import { FlipText } from "@/components/ui/flip-text";
import { DottedSurface } from "@/components/ui/dotted-surface";

export default function Footer() {
  const footerMuted = "#F1F5F9";

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: "#050505",
        color: "#fff",
        py: 12,
        position: 'relative',
        overflow: 'hidden',
        minHeight: '400px',
      }}
    >
      <DottedSurface className="opacity-100" />

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 20 }}>
        {/* Big Brand Text as per screenshot */}
        <Box sx={{ textAlign: 'center' }}>
          <FlipText
            className="text-[4rem] sm:text-[8rem] md:text-[12rem] font-black tracking-[0.05em] leading-none select-none mb-8 opacity-90 text-white"
            duration={2.2}
            delay={0}
          >
            SALEXA
          </FlipText>
          <Box>
            <Typography variant="caption" sx={{ color: alpha(footerMuted, 0.4), letterSpacing: '0.4em', textTransform: 'uppercase', fontWeight: 600 }}>
              © {new Date().getFullYear()} Salexa Enterprise • Built for Excellence
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

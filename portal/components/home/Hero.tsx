"use client";
import React, { useRef, useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  Stack,
  Chip,
  useTheme,
  alpha,
  Grid,
} from "@mui/material";
import Link from "next/link";
import { ArrowForwardIcon } from "@/components/icons";
import { motion } from "framer-motion";
import TargetCursor from "@/components/ui/target-cursor";
import RotatingText from "@/components/ui/rotating-text";

export default function Hero() {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestVersion = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';
        const response = await fetch(`${baseUrl}/core/app-versions/latest/`);
        if (response.ok) {
          const data = await response.json();
          if (data.download_url) {
            setDownloadUrl(data.download_url);
          }
        }
      } catch (err) {
        console.error("Failed to fetch latest app version:", err);
      }
    };
    fetchLatestVersion();
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        background: `linear-gradient(to bottom, #0F0F0F 0%, #050505 100%)`,
        color: "#fff",
        overflow: "hidden",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        pt: { xs: 12, md: 10, lg: 12 },
        pb: { xs: 4, md: 4, lg: 2 },
      }}
    >
      <TargetCursor />

      {/* --- High-End Background System --- */}
      <Box className="fancy-grid dark" sx={{ position: "absolute", inset: 0, opacity: 0.1, zIndex: 0 }} />


      {/* --- Light Rays Effect --- */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        <Box
          sx={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200%',
            height: '150%',
            background: `radial-gradient(ellipse at 50% 0%, ${alpha(theme.palette.secondary.main, 0.2)} 0%, transparent 60%)`,
            opacity: 0.6,
          }}
        />
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, rotate: -20 + i * 10 }}
            animate={{
              opacity: [0.1, 0.4, 0.1],
              x: [0, 50, 0],
            }}
            transition={{
              duration: 12 + i * 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              top: '-10%',
              left: `${20 + i * 15}%`,
              width: '2px',
              height: '120%',
              background: `linear-gradient(to bottom, ${alpha(theme.palette.secondary.main, 0.5)}, transparent)`,
              boxShadow: `0 0 40px ${alpha(theme.palette.secondary.main, 0.3)}`,
              transformOrigin: 'top',
              filter: 'blur(30px)'
            }}
          />
        ))}
      </Box>

      {/* Floating Modernist Elements (The "Bits") */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0.1, 0.3, 0.1],
            y: [0, -60, 0],
            x: [0, 30, 0],
            rotate: [0, 180]
          }}
          transition={{
            duration: 10 + i * 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            position: "absolute",
            width: 10 + i * 10,
            height: 10 + i * 10,
            border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
            top: `${20 + i * 10}%`,
            left: `${10 + (i % 4) * 25}%`,
            zIndex: 1,
            pointerEvents: 'none'
          }}
        />
      ))}

      <Container maxWidth="xl" sx={{ position: "relative", zIndex: 2 }}>
        <Grid container spacing={8} alignItems="center">
          {/* Left Content */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
                  <Stack spacing={{ xs: 2, md: 3, lg: 4 }}>
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Chip
                    label="2026 ENTERPRISE EDITION"
                    sx={{
                      bgcolor: alpha(theme.palette.secondary.main, 0.1),
                      color: theme.palette.secondary.main,
                      fontWeight: 900,
                      px: {xs: 1.5, md: 2},
                      py: {xs: 2, md: 2.5},
                      letterSpacing: '0.3em',
                      border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                      fontSize: {xs: '0.65rem', md: '0.75rem'},
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                </motion.div>

                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: "2.5rem", md: "3rem", lg: "3.5rem", xl: "4.5rem" },
                    fontWeight: 900,
                    color: "#fff",
                    letterSpacing: "-0.06em",
                    lineHeight: 0.9,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start'
                  }}
                >
                  <Box component="span">ENGINEERING</Box>
                  <RotatingText
                    texts={["ABSOLUTE FLOW", "PREMIUM CRM", "GLOBAL GROWTH", "LOGISTICS SDK", "DATA INSIGHTS"]}
                    mainClassName="bg-[#D4AF37] text-[#000] px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl inline-flex overflow-hidden mt-3"
                    staggerFrom="last"
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "-120%", opacity: 0 }}
                    staggerDuration={0.025}
                    splitBy="characters"
                    rotationInterval={3000}
                    transition={{ type: "spring", damping: 30, stiffness: 400 }}
                    elementLevelClassName="leading-none"
                  />
                </Typography>

                <Typography
                  variant="h5"
                  sx={{
                    color: alpha("#fff", 0.6),
                    maxWidth: 600,
                    lineHeight: { xs: 1.4, md: 1.5 },
                    fontSize: { xs: "1rem", md: "1.1rem", lg: "1.2rem" },
                    fontWeight: 400,
                    borderLeft: `3px solid ${theme.palette.secondary.main}`,
                    pl: { xs: 2.5, md: 4 }
                  }}
                >
                  The unified ecosystem for multi-billion dollar verticals.
                  Sales, Logistics, and Intelligence in a single high-performance orbit.
                </Typography>

                {downloadUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <a href={downloadUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <Button
                        variant="contained"
                        size="large"
                        endIcon={<ArrowForwardIcon />}
                        sx={{
                          background: 'linear-gradient(135deg, #D4AF37 0%, #AA8222 100%)',
                          color: '#000',
                          fontWeight: 900,
                          fontSize: { xs: '0.9rem', md: '1rem' },
                          letterSpacing: '0.05em',
                          px: { xs: 4, md: 6 },
                          py: { xs: 2 },
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          boxShadow: `0 10px 30px ${alpha('#D4AF37', 0.3)}, inset 0 2px 0 rgba(255,255,255,0.3)`,
                          "&:hover": {
                            background: 'linear-gradient(135deg, #E5C354 0%, #C19A2B 100%)',
                            transform: "scale(1.03) translateY(-3px)",
                            boxShadow: `0 15px 40px ${alpha('#D4AF37', 0.5)}, inset 0 2px 0 rgba(255,255,255,0.4)`,
                          },
                          "&:active": {
                            transform: "scale(0.98) translateY(0)",
                          },
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      >
                        DOWNLOAD LATEST APP
                      </Button>
                    </a>
                  </motion.div>
                )}

                <Stack direction="row" spacing={{ xs: 4, md: 6, lg: 8 }} sx={{ pt: { xs: 2, md: 4 } }}>
                  <Box className="cursor-target">
                    <Typography variant="h2" sx={{ fontWeight: 900, color: "#fff", fontSize: { xs: '2.5rem', md: '3rem', lg: '3.5rem' } }}>1.2B+</Typography>
                    <Typography variant="caption" color="secondary.main" sx={{ letterSpacing: '0.2em', fontWeight: 900, fontSize: { xs: '0.65rem', md: '0.75rem' } }}>REVENUE ORCHESTRATED</Typography>
                  </Box>
                  <Box className="cursor-target">
                    <Typography variant="h2" sx={{ fontWeight: 900, color: "#fff", fontSize: { xs: '2.5rem', md: '3rem', lg: '3.5rem' } }}>0.2ms</Typography>
                    <Typography variant="caption" color="secondary.main" sx={{ letterSpacing: '0.2em', fontWeight: 900, fontSize: { xs: '0.65rem', md: '0.75rem' } }}>SYNC LATENCY</Typography>
                  </Box>
                </Stack>
              </Stack>
            </motion.div>
          </Grid>

          {/* Right Visual (Modernist 3D Scene) */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ position: 'relative' }}
              className="cursor-target"
            >
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '1/1',
                  borderRadius: 4,
                  bgcolor: alpha("#fff", 0.02),
                  backdropFilter: 'blur(40px)',
                  border: `1px solid ${alpha('#fff', 0.1)}`,
                  boxShadow: `0 40px 120px ${alpha("#000", 0.5)}`,
                  p: 4,
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Box sx={{ position: 'absolute', inset: 0, border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`, m: 3, pointerEvents: 'none' }} />

                <Stack spacing={6} sx={{ width: '100%' }}>
                  <Box sx={{ width: '60px', height: '2px', bgcolor: theme.palette.secondary.main }} />
                  <Grid container spacing={3}>
                    {[...Array(4)].map((_, i) => (
                      <Grid key={i} size={{ xs: 6 }}>
                        <Box sx={{ p: 4, borderRadius: 2, border: `1px solid ${alpha('#fff', 0.1)}`, bgcolor: alpha('#fff', 0.03) }}>
                          <Box sx={{ width: '30%', height: 12, bgcolor: alpha(theme.palette.secondary.main, 0.2), mb: 3 }} />
                          <Box sx={{ width: '100%', height: 8, bgcolor: '#fff', opacity: 0.5 }} />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                  <Box sx={{ width: '100%', height: 200, borderRadius: 2, border: `1px solid ${alpha('#fff', 0.1)}`, position: 'relative', overflow: 'hidden', bgcolor: alpha('#000', 0.2) }}>
                    <motion.div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.secondary.main, 0.3)}, transparent)`,
                        transform: 'skewX(-20deg)'
                      }}
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                    />
                  </Box>
                </Stack>
              </Box>

              <motion.div
                animate={{ y: [0, -40, 0], rotate: [0, 10, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: 'absolute',
                  top: '-10%',
                  right: '-10%',
                  width: 140,
                  height: 140,
                  background: alpha(theme.palette.secondary.main, 0.1),
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.4)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
              >
                <div style={{ width: 12, height: 12, background: theme.palette.secondary.main, borderRadius: '50%', boxShadow: `0 0 20px ${theme.palette.secondary.main}` }} />
              </motion.div>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

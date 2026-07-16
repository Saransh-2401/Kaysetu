"use client";
import React from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  useTheme,
  alpha,
  Stack,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { HomeIcon, ArrowBackIcon, SearchOffIcon } from "@/components/icons";

export default function NotFound() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          textAlign: "center",
          py: 4,
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <Box
            sx={{
              position: "relative",
              width: 180,
              height: 180,
              borderRadius: "50%",
              bgcolor: alpha(theme.palette.error.main, 0.05),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 4,
              border: `1px dashed ${alpha(theme.palette.error.main, 0.2)}`,
            }}
          >
            <SearchOffIcon
              sx={{
                fontSize: 80,
                color: theme.palette.error.main,
                opacity: 0.8,
              }}
            />

            {/* Decorative Blurs */}
            <Box
              sx={{
                position: "absolute",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`,
                animation: "ripple 2s infinite ease-out",
                "@keyframes ripple": {
                  "0%": { transform: "scale(0.8)", opacity: 1 },
                  "100%": { transform: "scale(1.5)", opacity: 0 },
                },
              }}
            />
          </Box>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <Typography
            variant="h1"
            fontWeight={900}
            sx={{
              fontSize: { xs: "6rem", md: "10rem" },
              lineHeight: 0.8,
              opacity: 0.1,
              userSelect: "none",
              color: "text.primary",
            }}
          >
            404
          </Typography>

          <Typography
            variant="h3"
            fontWeight={800}
            gutterBottom
            sx={{ mt: -2, mb: 2 }}
          >
            Page Not Found
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 500, mx: "auto", mb: 6, lineHeight: 1.6 }}
          >
            We've explored the deep ends of our database but couldn't find the
            page you were looking for. It might have been moved or deleted.
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="center"
          >
            <Button
              variant="outlined"
              size="large"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.back()}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 1,
                fontSize: "1rem",
                borderColor: alpha(theme.palette.divider, 0.2),
                color: "text.primary",
                "&:hover": {
                  borderColor: "text.primary",
                  bgcolor: "transparent",
                },
              }}
            >
              Go Back
            </Button>
            <Button
              variant="contained"
              size="large"
              startIcon={<HomeIcon />}
              onClick={() => router.push("/")}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 1,
                fontSize: "1rem",
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                boxShadow: `0px 8px 20px ${alpha(
                  theme.palette.primary.main,
                  0.3
                )}`,
              }}
            >
              Back to Dashboard
            </Button>
          </Stack>
        </motion.div>
      </Box>
    </Container>
  );
}

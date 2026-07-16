"use client";
import React, { useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  useTheme,
  alpha,
  Paper,
  Stack,
} from "@mui/material";
import { motion } from "framer-motion";
import { RefreshIcon, WarningAmberIcon, SupportAgentIcon } from "@/components/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const theme = useTheme();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <Container maxWidth="sm">
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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Box
            sx={{
              width: 100,
              height: 100,

              bgcolor: alpha(theme.palette.warning.main, 0.1),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 3,
              boxShadow: `0 0 0 8px ${alpha(theme.palette.warning.main, 0.05)}`,
            }}
          >
            <WarningAmberIcon
              sx={{ fontSize: 50, color: theme.palette.warning.main }}
            />
          </Box>
        </motion.div>

        <Typography variant="h4" fontWeight={800} gutterBottom>
          Something went wrong
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, maxWidth: 450, lineHeight: 1.6 }}
        >
          An unexpected error has occurred. Our team has been notified. Please
          try refreshing the page or contact support if the issue persists.
        </Typography>

        {/* Error Details Box */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            width: "100%",
            p: 2,
            bgcolor: alpha(theme.palette.background.paper, 0.5),
            borderRadius: 1,
            mb: 4,
            borderStyle: "dashed",
            textAlign: "left",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            display="block"
            mb={0.5}
          >
            ERROR DETAILS
          </Typography>
          <Typography
            variant="body2"
            fontFamily="monospace"
            color="error.main"
            sx={{ wordBreak: "break-word" }}
          >
            {error.message || "Unknown Application Error"}
          </Typography>
          {error.digest && (
            <Typography
              variant="caption"
              color="text.disabled"
              display="block"
              mt={1}
            >
              Digest: {error.digest}
            </Typography>
          )}
        </Paper>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            size="large"
            startIcon={<SupportAgentIcon />}
            sx={{
              borderRadius: 1,
              px: 3,
              borderColor: alpha(theme.palette.divider, 0.5),
              color: "text.primary",
            }}
          >
            Contact Support
          </Button>
          <Button
            variant="contained"
            size="large"
            startIcon={<RefreshIcon />}
            onClick={() => reset()}
            sx={{
              borderRadius: 1,
              px: 4,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              boxShadow: `0px 8px 16px ${alpha(
                theme.palette.primary.main,
                0.2
              )}`,
            }}
          >
            Try Again
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}

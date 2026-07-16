"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Stack,
  CircularProgress,
  Alert,
  InputAdornment,
  useTheme,
  alpha,
  IconButton,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { EmailIcon, LockIcon, VerifiedIcon, RefreshIcon, CloseIcon } from "@/components/icons";

interface EmailOTPModalProps {
  open: boolean;
  onClose: () => void;
  onVerify: () => void;
  email: string;
  actionType: "update" | "delete" | "create";
  actionDescription: string;
}

export default function EmailOTPModal({
  open,
  onClose,
  onVerify,
  email,
  actionType,
  actionDescription,
}: EmailOTPModalProps) {
  const theme = useTheme();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Auto-send OTP when modal opens
  useEffect(() => {
    if (open && !otpSent) {
      handleSendOTP();
    }
  }, [open]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async () => {
    setSendingOTP(true);
    setError("");

    // Simulate API call to send OTP
    setTimeout(() => {
      setOtpSent(true);
      setSendingOTP(false);
      setCountdown(60); // 60 second cooldown
      // In production, call your API here
      // await sendOTPEmail(email, actionType);
    }, 1500);
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    // Simulate API call to verify OTP
    setTimeout(() => {
      // Demo: accept "123456" as valid OTP
      if (otp === "123456") {
        setSuccess(true);
        setTimeout(() => {
          onVerify();
          handleClose();
        }, 1000);
      } else {
        setError("Invalid OTP. Please try again.");
        setLoading(false);
      }
    }, 1500);
  };

  const handleClose = () => {
    setOtp("");
    setError("");
    setSuccess(false);
    setOtpSent(false);
    setCountdown(0);
    onClose();
  };

  const getActionColor = () => {
    switch (actionType) {
      case "delete":
        return theme.palette.error.main;
      case "update":
        return theme.palette.warning.main;
      case "create":
        return theme.palette.success.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const getActionIcon = () => {
    switch (actionType) {
      case "delete":
        return "🗑️";
      case "update":
        return "✏️";
      case "create":
        return "➕";
      default:
        return "🔐";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 1,
          overflow: "visible",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          pb: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: alpha(getActionColor(), 0.1),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
            }}
          >
            {getActionIcon()}
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Email Verification Required
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Confirm critical company setting changes
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Box
                sx={{
                  textAlign: "center",
                  py: 4,
                }}
              >
                <VerifiedIcon
                  sx={{
                    fontSize: 80,
                    color: "success.main",
                    mb: 2,
                  }}
                />
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Verification Successful!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Processing your request...
                </Typography>
              </Box>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Stack spacing={3}>
                {/* Action Description */}
                <Alert
                  severity={
                    actionType === "delete"
                      ? "error"
                      : actionType === "update"
                        ? "warning"
                        : "info"
                  }
                  sx={{ borderRadius: 2 }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {actionDescription}
                  </Typography>
                </Alert>

                {/* Email Display */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    border: `1px solid ${alpha(
                      theme.palette.primary.main,
                      0.1
                    )}`,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <EmailIcon color="primary" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        OTP sent to
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {email}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                {/* OTP Input */}
                <TextField
                  fullWidth
                  label="Enter 6-Digit OTP"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(value);
                    setError("");
                  }}
                  placeholder="000000"
                  disabled={loading || !otpSent}
                  error={!!error}
                  helperText={error || "Check your email for the OTP code"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      fontSize: "1.2rem",
                      letterSpacing: "0.5em",
                      textAlign: "center",
                    },
                  }}
                  inputProps={{
                    maxLength: 6,
                    style: { textAlign: "center", letterSpacing: "0.5em" },
                  }}
                  autoFocus
                />

                {/* Resend OTP */}
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Didn't receive the code?
                  </Typography>
                  <Button
                    size="small"
                    startIcon={
                      sendingOTP ? (
                        <CircularProgress size={16} />
                      ) : (
                        <RefreshIcon />
                      )
                    }
                    onClick={handleSendOTP}
                    disabled={countdown > 0 || sendingOTP}
                    sx={{ borderRadius: 2 }}
                  >
                    {countdown > 0
                      ? `Resend in ${countdown}s`
                      : sendingOTP
                        ? "Sending..."
                        : "Resend OTP"}
                  </Button>
                </Box>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      {!success && (
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={handleClose}
            color="inherit"
            disabled={loading}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerifyOTP}
            variant="contained"
            disabled={!otp || otp.length !== 6 || loading}
            startIcon={
              loading ? <CircularProgress size={20} color="inherit" /> : null
            }
            sx={{
              borderRadius: 2,
              minWidth: 120,
              bgcolor: getActionColor(),
              "&:hover": {
                bgcolor: alpha(getActionColor(), 0.8),
              },
            }}
          >
            {loading ? "Verifying..." : "Verify & Proceed"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

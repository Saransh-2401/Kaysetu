"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  Stack,
  Avatar,
  Chip,
  Divider,
  alpha,
  useTheme,
  Grid,
} from "@mui/material";
import { CloseIcon, EditTwoToneIcon, DeleteTwoToneIcon, EmailIcon, PhoneIcon, CalendarMonthIcon, LocationOnIcon, BadgeIcon, CreditCardIcon, LocalOfferIcon } from "@/components/icons";

interface AgentDetailModalProps {
  open: boolean;
  onClose: () => void;
  agent: any;
  /** When provided, an Edit action button is shown in the modal footer. */
  onEdit?: () => void;
  /** When provided, a Delete action button is shown in the modal footer. */
  onDelete?: () => void;
}

const parseOperatingCities = (val?: string | string[] | null): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return [val];
  }
};

export default function AgentDetailModal({ open, onClose, agent, onEdit, onDelete }: AgentDetailModalProps) {
  const theme = useTheme();

  if (!agent) return null;

  const getImageUrl = (imagePath: string | null | undefined) => {
    if (!imagePath) return "";
    if (imagePath.startsWith("http")) return imagePath;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api/v1", "") || "http://localhost:8000";
    return `${baseUrl}${imagePath}`;
  };

  const formatRole = (role: string) =>
    role?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "";

  const cities = parseOperatingCities(agent.operating_city);
  const tags = Array.isArray(agent.tags) ? agent.tags : [];
  const profileUrl = getImageUrl(agent.profile_image);
  const aadhaarUrl = getImageUrl(agent.aadhaar_card);
  const panUrl = getImageUrl(agent.pan_card);

  const NOT_FOUND_SVG = (label: string) =>
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90' viewBox='0 0 120 90'%3E%3Crect width='120' height='90' rx='8' fill='%23f5f5f5'/%3E%3Cpath d='M42 25h36a4 4 0 014 4v32a4 4 0 01-4 4H42a4 4 0 01-4-4V29a4 4 0 014-4z' fill='none' stroke='%23ccc' stroke-width='2'/%3E%3Ccircle cx='50' cy='40' r='5' fill='%23ccc'/%3E%3Cpath d='M38 61l12-14 8 9 6-5 18 10' fill='none' stroke='%23ccc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ctext x='60' y='82' text-anchor='middle' font-family='Arial' font-size='9' fill='%23999'%3E${encodeURIComponent(label)}%3C/text%3E%3C/svg%3E`;

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>, label: string) => {
    const img = e.currentTarget;
    img.src = NOT_FOUND_SVG(label);
    img.style.objectFit = "contain";
    img.style.padding = "16px";
  };

  const formatAadhaar = (val: string) => {
    const cleaned = val.replace(/\D/g, "");
    const match = cleaned.match(/(\d{0,4})(\d{0,4})(\d{0,4})/);
    if (match) return [match[1], match[2], match[3]].filter(Boolean).join(" ");
    return cleaned;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}
    >
      {/* Header with gradient */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          pt: 4,
          pb: 5,
          px: 3,
          position: "relative",
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            color: "white",
            bgcolor: alpha("#fff", 0.15),
            "&:hover": { bgcolor: alpha("#fff", 0.25) },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            src={profileUrl}
            sx={{
              width: 72,
              height: 72,
              border: "3px solid white",
              fontSize: "1.5rem",
              fontWeight: 800,
              bgcolor: alpha("#fff", 0.2),
            }}
          >
            {(agent.full_name || agent.username || "")
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={800} color="white" sx={{ lineHeight: 1.2 }}>
              {agent.full_name || agent.username}
            </Typography>
            <Typography variant="body2" sx={{ color: alpha("#fff", 0.8), mt: 0.3 }}>
              {formatRole(agent.role || "Sales Agent")}
            </Typography>
            <Chip
              label={agent.status || "Active"}
              size="small"
              sx={{
                mt: 0.5,
                fontWeight: 700,
                fontSize: "0.65rem",
                height: 20,
                bgcolor: agent.status === "Active" ? alpha("#4caf50", 0.9) : alpha("#9e9e9e", 0.9),
                color: "white",
              }}
            />
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ pt: 3, pb: 3 }}>
        {/* Contact Info */}
        <Stack spacing={1.5} mb={3}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <EmailIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" fontWeight={600}>{agent.email || "—"}</Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <PhoneIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" fontWeight={600}>{agent.phone || "—"}</Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CalendarMonthIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" fontWeight={600}>
              Joined {agent.date_joined
                ? new Date(agent.date_joined).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                : "—"}
            </Typography>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Operating Cities & Tags */}
        <Stack spacing={2} mb={3}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <LocationOnIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                Operating Cities
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {cities.length > 0 ? cities.map((c) => (
                <Chip key={c} label={c} size="small" variant="outlined" sx={{ fontWeight: 600, borderRadius: 1 }} />
              )) : (
                <Typography variant="body2" color="text.secondary">Not assigned</Typography>
              )}
            </Stack>
          </Box>

          {tags.length > 0 && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <LocalOfferIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                  Tags
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {tags.map((t: string) => (
                  <Chip key={t} label={t} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600, borderRadius: 1 }} />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* KYC Info */}
        <Stack spacing={1.5} mb={3}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
            KYC Details
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <BadgeIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" fontWeight={600}>
              Aadhaar: {agent.aadhaar_number ? formatAadhaar(agent.aadhaar_number) : "—"}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CreditCardIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" fontWeight={600}>
              PAN: {agent.pan_number || "—"}
            </Typography>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Uploaded Documents */}
        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" display="block" mb={1.5}>
          Uploaded Documents
        </Typography>

        <Grid container spacing={2}>
          {/* Aadhaar Card */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                borderRadius: 1.5,
                overflow: "hidden",
                bgcolor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              {aadhaarUrl ? (
                <Box
                  component="a"
                  href={aadhaarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: "block", textDecoration: "none" }}
                >
                  <Box
                    component="img"
                    src={aadhaarUrl}
                    alt="Aadhaar Card"
                    onError={(e: any) => handleImgError(e, "Aadhaar Not Found")}
                    sx={{
                      width: "100%",
                      height: 140,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </Box>
              ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ height: 140 }}>
                  <Box
                    component="img"
                    src={NOT_FOUND_SVG("Aadhaar Not Found")}
                    alt="Aadhaar Not Found"
                    sx={{ width: 120, height: 90, opacity: 0.8 }}
                  />
                </Stack>
              )}
              <Box sx={{ p: 1, textAlign: "center" }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">Aadhaar Card</Typography>
              </Box>
            </Box>
          </Grid>

          {/* PAN Card */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                borderRadius: 1.5,
                overflow: "hidden",
                bgcolor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              {panUrl ? (
                <Box
                  component="a"
                  href={panUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: "block", textDecoration: "none" }}
                >
                  <Box
                    component="img"
                    src={panUrl}
                    alt="PAN Card"
                    onError={(e: any) => handleImgError(e, "PAN Not Found")}
                    sx={{
                      width: "100%",
                      height: 140,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </Box>
              ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ height: 140 }}>
                  <Box
                    component="img"
                    src={NOT_FOUND_SVG("PAN Not Found")}
                    alt="PAN Not Found"
                    sx={{ width: 120, height: 90, opacity: 0.8 }}
                  />
                </Stack>
              )}
              <Box sx={{ p: 1, textAlign: "center" }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">PAN Card</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

      </DialogContent>

      {(onEdit || onDelete) && (
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
          {onEdit && (
            <Button
              variant="contained"
              startIcon={<EditTwoToneIcon fontSize="small" />}
              onClick={onEdit}
              sx={{
                fontWeight: 700,
                textTransform: "none",
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              }}
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteTwoToneIcon fontSize="small" />}
              onClick={onDelete}
              sx={{ fontWeight: 700, textTransform: "none" }}
            >
              Delete
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}

"use client";
import ConstructionIcon from "@mui/icons-material/Construction";
import { Box, Typography } from "@mui/material";

export default function TrackingPlaceholderPage() {
  return (
    <Box sx={{ textAlign: "center", py: 10 }} data-testid="portal-tracking-placeholder-container">
      <ConstructionIcon sx={{ fontSize: 56 }} color="secondary" />
      <Typography variant="h5" gutterBottom>
        Live Tracking is being built
      </Typography>
      <Typography color="text.secondary">
        Your plan includes this module — the live map, attendance and route replay land here next.
      </Typography>
    </Box>
  );
}

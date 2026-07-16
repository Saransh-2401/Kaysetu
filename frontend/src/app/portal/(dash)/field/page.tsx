"use client";
import ConstructionIcon from "@mui/icons-material/Construction";
import { Box, Typography } from "@mui/material";

export default function FieldPlaceholderPage() {
  return (
    <Box sx={{ textAlign: "center", py: 10 }} data-testid="portal-field-placeholder-container">
      <ConstructionIcon sx={{ fontSize: 56 }} color="secondary" />
      <Typography variant="h5" gutterBottom>
        Field Sales is being built
      </Typography>
      <Typography color="text.secondary">
        Your plan includes this module — beat plans, visits, orders and targets land here next.
      </Typography>
    </Box>
  );
}

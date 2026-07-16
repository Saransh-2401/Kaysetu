"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Avatar,
  Chip,
  Divider,
  Grid,
  Button,
  IconButton,
  CircularProgress,
  Rating,
  alpha,
  useTheme,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { ArrowBackIcon, LocalShippingIcon, PhoneIcon, EmailIcon, BadgeIcon, ReceiptLongIcon, HomeWorkIcon, Inventory2Icon, EditTwoToneIcon } from "@/components/icons";
import { purchaseService, Supplier, PurchaseOrder } from "@/lib/purchase-service";

const formatGroup = (g?: string | null) =>
  g ? g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

export default function SupplierProfilePage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [posLoading, setPosLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const data = await purchaseService.getSupplier(id);
        if (active) setSupplier(data);
      } catch (e) {
        if (active) setError("Could not load this supplier.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        setPosLoading(true);
        const res = await purchaseService.getPurchaseOrders({
          supplier: String(id),
          ordering: "-order_date",
          page_size: "50",
        });
        if (active) setPurchaseOrders(res.results || []);
      } catch (e) {
        if (active) setPurchaseOrders([]);
      } finally {
        if (active) setPosLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const poStatusColor = (status?: string): "success" | "error" | "warning" | "default" => {
    if (status === "approved") return "success";
    if (status === "cancelled" || status === "rejected") return "error";
    if (status === "pending" || status === "draft") return "warning";
    return "default";
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !supplier) {
    return (
      <Box sx={{ p: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 2, textTransform: "none" }}>
          Back
        </Button>
        <Typography color="error">{error || "Supplier not found."}</Typography>
      </Box>
    );
  }

  const initials = (supplier.supplier_name || "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: React.ReactNode }) => (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ color: "text.secondary", mt: 0.3 }}>{icon}</Box>
      <Box>
        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {value ?? "—"}
        </Typography>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }} className="page-enter">
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ textTransform: "none" }}>
          Back
        </Button>
        <Tooltip title="Edit in Supplier Master">
          <Button
            variant="outlined"
            startIcon={<EditTwoToneIcon />}
            onClick={() => router.push(`/suppliers?edit=${supplier.id}`)}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Edit
          </Button>
        </Tooltip>
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", mb: 3 }}>
        <Box
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            px: 3,
            py: 4,
          }}
        >
          <Stack direction="row" spacing={2.5} alignItems="center">
            <Avatar sx={{ width: 80, height: 80, bgcolor: alpha("#fff", 0.2), border: "3px solid white", fontSize: "1.6rem", fontWeight: 800 }}>
              {initials || <LocalShippingIcon />}
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight={800} color="white">
                {supplier.supplier_name}
              </Typography>
              {supplier.business_name && (
                <Typography variant="body2" sx={{ color: alpha("#fff", 0.85) }}>
                  {supplier.business_name}
                </Typography>
              )}
              <Stack direction="row" spacing={1} mt={1}>
                <Chip
                  label={supplier.supplier_code || "No code"}
                  size="small"
                  sx={{ bgcolor: alpha("#fff", 0.2), color: "white", fontWeight: 700 }}
                />
                <Chip
                  label={supplier.is_active ? "Active" : "Inactive"}
                  size="small"
                  sx={{ bgcolor: supplier.is_active ? alpha("#4caf50", 0.9) : alpha("#9e9e9e", 0.9), color: "white", fontWeight: 700 }}
                />
              </Stack>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <InfoRow icon={<PhoneIcon fontSize="small" />} label="Phone" value={supplier.phone} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <InfoRow icon={<EmailIcon fontSize="small" />} label="Email" value={supplier.email} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <InfoRow icon={<BadgeIcon fontSize="small" />} label="Group" value={formatGroup(supplier.supplier_group)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <InfoRow icon={<ReceiptLongIcon fontSize="small" />} label="GST / Tax ID" value={supplier.tax_id} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <InfoRow icon={<ReceiptLongIcon fontSize="small" />} label="Payment Terms" value={supplier.payment_terms} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <InfoRow
                icon={<BadgeIcon fontSize="small" />}
                label="Quality Rating"
                value={<Rating value={Number(supplier.quality_rating) || 0} precision={0.5} size="small" readOnly />}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <InfoRow icon={<HomeWorkIcon fontSize="small" />} label="Billing Address" value={supplier.billing_address} />
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {Array.isArray(supplier.supplied_items_details) && supplier.supplied_items_details.length > 0 && (
        <Paper elevation={0} sx={{ borderRadius: 3, p: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <Inventory2Icon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={800}>
              Supplied Items ({supplier.supplied_items_details.length})
            </Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {supplier.supplied_items_details.map((it: any) => (
              <Chip
                key={it.id}
                label={`${it.item_name} (${it.item_code})`}
                variant="outlined"
                onClick={() => router.push(`/items?highlight=${it.id}`)}
                sx={{ fontWeight: 600, borderRadius: 1.5 }}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* PURCHASE ORDER HISTORY */}
      <Paper elevation={0} sx={{ borderRadius: 3, p: 3, mt: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ReceiptLongIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={800}>
              Purchase Order History{!posLoading ? ` (${purchaseOrders.length})` : ""}
            </Typography>
          </Stack>
          {purchaseOrders.length > 0 && (
            <Button
              size="small"
              onClick={() => router.push(`/purchase-orders?supplier=${supplier.id}`)}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              View all →
            </Button>
          )}
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {posLoading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={26} />
          </Stack>
        ) : purchaseOrders.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", py: 2 }}>
            No purchase orders have been raised for this supplier yet.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary" } }}>
                  <TableCell>PO Number</TableCell>
                  <TableCell>Order Date</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Receipt</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow
                    key={po.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => router.push(`/purchase-orders?highlight=${po.id}`)}
                  >
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{po.po_number}</TableCell>
                    <TableCell>{po.order_date ? new Date(po.order_date).toLocaleDateString("en-IN") : "—"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      ₹{Number(po.total || 0).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell sx={{ textTransform: "capitalize" }}>
                      {(po.receipt_status || "—").replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={(po.status || "").replace(/_/g, " ")}
                        size="small"
                        color={poStatusColor(po.status)}
                        sx={{ fontWeight: 600, textTransform: "capitalize" }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

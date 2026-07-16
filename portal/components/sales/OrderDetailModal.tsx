import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Divider,
    Grid,
    Stack,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    alpha,
    useTheme,
    Stepper,
    Step,
    StepLabel,
    StepConnector,
    stepConnectorClasses,
    styled,
    Card,
    CardContent,
} from "@mui/material";
import { CloseIcon, AssignmentIcon, WatchLaterIcon, HistoryIcon, Inventory2Icon, LocalShippingIcon, PaidIcon, CheckCircleIcon, PersonIcon, CalendarMonthIcon } from "@/components/icons";
import { SalesOrder } from "@/lib/sales-service";

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.alternativeLabel}`]: {
        top: 22,
    },
    [`&.${stepConnectorClasses.active}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            backgroundImage: `linear-gradient( 95deg,${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 120%)`,
        },
    },
    [`&.${stepConnectorClasses.completed}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            backgroundImage: `linear-gradient( 95deg,${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 120%)`,
        },
    },
    [`& .${stepConnectorClasses.line}`]: {
        height: 3,
        border: 0,
        backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.divider,
        borderRadius: 1,
    },
}));

const ColorlibStepIconRoot = styled("div")<{
    ownerState: { completed?: boolean; active?: boolean };
}>(({ theme, ownerState }) => ({
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.grey[400],
    zIndex: 1,
    color: "#fff",
    width: 50,
    height: 50,
    display: "flex",
    borderRadius: "50%",
    justifyContent: "center",
    alignItems: "center",
    ...(ownerState.active && {
        backgroundImage: `linear-gradient( 136deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
        boxShadow: "0 4px 10px 0 rgba(0,0,0,0.25)",
    }),
    ...(ownerState.completed && {
        backgroundImage: `linear-gradient( 136deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
    }),
}));

function ColorlibStepIcon(props: any) {
    const { active, completed, className, icon } = props;

    const icons: { [index: string]: React.ReactElement } = {
        1: <AssignmentIcon />,
        2: <Inventory2Icon />,
        3: <LocalShippingIcon />,
        4: <CheckCircleIcon />,
    };

    return (
        <ColorlibStepIconRoot ownerState={{ completed, active }} className={className}>
            {icons[String(icon)]}
        </ColorlibStepIconRoot>
    );
}

interface OrderDetailModalProps {
    open: boolean;
    onClose: () => void;
    order: SalesOrder | null;
}

export default function OrderDetailModal({ open, onClose, order }: OrderDetailModalProps) {
    const theme = useTheme();

    if (!order) return null;

    const toTitleCase = (str: string) => {
        return str
            .replace(/_/g, " ")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
    };

    const getFulfillmentLabel = (status: string) => {
        return toTitleCase(status);
    };

    const getFulfillmentColor = (status: string) => {
        switch (status) {
            case "delivered":
                return "success";
            case "in_transit":
                return "info";
            case "packed":
                return "warning";
            case "processing":
                return "secondary";
            default:
                return "default";
        }
    };

    const getPaymentLabel = (status: string) => {
        return toTitleCase(status);
    };

    const getPaymentColor = (status: string) => {
        switch (status) {
            case "paid":
                return "success";
            case "partially_paid":
                return "warning";
            case "unpaid":
                return "error";
            default:
                return "default";
        }
    };

    const steps = [
        { label: "Order Placed", status: "order_confirmed" },
        { label: "Packed", status: "packed" },
        { label: "In Transit", status: "in_transit" },
        { label: "Delivered", status: "delivered" },
    ];

    const getActiveStep = () => {
        const status = order.fulfillment_status;
        if (status === "delivered") return 4;
        if (status === "in_transit") return 3;
        if (status === "packed") return 2;
        if (status === "order_confirmed" || status === "processing") return 1;
        return 0;
    };

    const formatAddress = (address: any) => {
        if (!address) return "";
        let addrObj = address;
        if (typeof address === "string") {
            try {
                addrObj = JSON.parse(address);
            } catch (e) {
                return address;
            }
        }

        if (addrObj.formatted) return addrObj.formatted;

        const parts = [
            addrObj.address_line1,
            addrObj.address_line2,
            addrObj.city,
            addrObj.state,
            addrObj.pincode
        ].filter(Boolean);

        return parts.join(", ");
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
            <DialogTitle component="div" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 3 }}>
                <Box>
                    <Typography variant="h6" fontWeight={800}>Order Details: {order.order_number}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        ID: #{order.id} | Created on {new Date(order.order_date).toLocaleDateString()}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                    {/* Order Info Cards */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card variant="outlined" sx={{ borderRadius: 1, height: '100%', bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                    <PersonIcon color="primary" fontSize="small" />
                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Customer Details</Typography>
                                </Box>
                                <Typography variant="h6" fontWeight={800}>{order.customer_name}</Typography>
                                {order.shipping_address && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        {formatAddress(order.shipping_address)}
                                    </Typography>
                                )}
                                <Divider sx={{ my: 2 }} />
                                <Stack direction="row" spacing={2} justifyContent="space-between">
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">Payment Status</Typography>
                                        <Chip
                                            label={getPaymentLabel(order.payment_status)}
                                            size="small"
                                            color={getPaymentColor(order.payment_status) as any}
                                            sx={{ fontWeight: 700 }}
                                        />
                                    </Box>
                                    <Box textAlign="right">
                                        <Typography variant="caption" color="text.secondary" display="block">Fulfillment</Typography>
                                        <Chip
                                            label={getFulfillmentLabel(order.fulfillment_status)}
                                            size="small"
                                            color={getFulfillmentColor(order.fulfillment_status) as any}
                                            variant="outlined"
                                            sx={{ fontWeight: 700 }}
                                        />
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card variant="outlined" sx={{ borderRadius: 1, height: '100%', bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                    <AssignmentIcon color="primary" fontSize="small" />
                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Order Summary</Typography>
                                </Box>
                                <Stack spacing={1}>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2">Subtotal</Typography>
                                        <Typography variant="body2" fontWeight={600}>₹{Number(order.subtotal).toLocaleString()}</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2">Tax Amount</Typography>
                                        <Typography variant="body2" fontWeight={600}>₹{Number(order.tax_amount).toLocaleString()}</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2">Discount</Typography>
                                        <Typography variant="body2" fontWeight={600} color="error.main">-₹{Number(order.discount_amount).toLocaleString()}</Typography>
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="subtitle1" fontWeight={700}>Total</Typography>
                                        <Typography variant="subtitle1" fontWeight={800} color="primary.main">₹{Number(order.total).toLocaleString()}</Typography>
                                    </Box>
                                    {order.advance_amount && order.advance_amount > 0 && (
                                        <Box display="flex" justifyContent="space-between" sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
                                            <Typography variant="body2" color="success.main" fontWeight={600}>Advance Paid</Typography>
                                            <Typography variant="body2" color="success.main" fontWeight={700}>₹{Number(order.advance_amount).toLocaleString()}</Typography>
                                        </Box>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Stepper Timeline */}
                    <Grid size={{ xs: 12 }}>
                        <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={4}>
                                    <WatchLaterIcon color="primary" fontSize="small" />
                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Order Status Timeline</Typography>
                                </Box>
                                <Stepper alternativeLabel activeStep={getActiveStep()} connector={<ColorlibConnector />}>
                                    {steps.map((step, index) => (
                                        <Step key={step.label}>
                                            <StepLabel StepIconComponent={ColorlibStepIcon} icon={index + 1}>
                                                {step.label}
                                            </StepLabel>
                                        </Step>
                                    ))}
                                </Stepper>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Items Table */}
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, ml: 0.5 }}>
                            <Inventory2Icon fontSize="inherit" color="primary" /> Order Items
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                            <Table size="small">
                                <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Rate</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Tax %</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {order.items?.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{item.product_name || item.item_name}</TableCell>
                                            <TableCell>{item.item_code || item.hsn_code || '-'}</TableCell>
                                            <TableCell align="right">{item.quantity}</TableCell>
                                            <TableCell align="right">₹{Number(item.rate).toLocaleString()}</TableCell>
                                            <TableCell align="right">{item.tax_percentage}%</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>₹{Number(item.total_amount || item.amount).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>

                    {/* Activity Logs */}
                    <Grid size={{ xs: 12 }}>
                        <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                    <HistoryIcon color="primary" fontSize="small" />
                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Activity Logs</Typography>
                                </Box>
                                <Stack divider={<Divider flexItem />} spacing={0}>
                                    {order.logs && order.logs.length > 0 ? (
                                        [...order.logs].reverse().map((log: any, idx: number) => (
                                            <Box key={idx} sx={{ py: 1.5 }}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={700}>
                                                            {log.notes || `Status changed from ${toTitleCase(log.from_status)} to ${toTitleCase(log.to_status)}`}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                            By: {log.changed_by_name || "System"} • {new Date(log.changed_at).toLocaleString('en-IN', {
                                                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                                                            })}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={toTitleCase(log.to_status)}
                                                        size="small"
                                                        variant="outlined"
                                                        color={getFulfillmentColor(log.to_status) as any}
                                                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }}
                                                    />
                                                </Stack>
                                            </Box>
                                        ))
                                    ) : (
                                        <Box sx={{ py: 3, textAlign: 'center' }}>
                                            <Typography variant="caption" color="text.disabled">No logs recorded yet.</Typography>
                                        </Box>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
                <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

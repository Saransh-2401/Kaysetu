"use client";

import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Box,
    Typography,
    Stack,
    CircularProgress,
    Alert,
    alpha,
    useTheme,
    TextField,
    Chip,
} from "@mui/material";
import { CloseIcon, RouteIcon, AccessTimeIcon, SpeedIcon } from "@/components/icons";
import { apiClient } from "../../lib/api-client";
import { loadGoogleMapsScript } from "../../lib/google-maps-loader";


// Declare Google Maps types
declare global {
    interface Window {
        google: any;
    }
}

interface DayRouteModalProps {
    open: boolean;
    onClose: () => void;
    agentId: number;
    agentName: string;
}

interface RouteData {
    agent_id: number;
    agent_name: string;
    date: string;
    punch_in_time: string | null;
    punch_out_time: string | null;
    total_points: number;
    mock_detected?: boolean;
    mock_point_count?: number;
    location_points: Array<{
        timestamp: string;
        lat: number;
        lng: number;
        accuracy: number;
        is_mocked?: boolean;
        suspect?: boolean;
        speed?: number; // m/s, when the app reported it
        heading?: number;
        motion_state?: string; // 'stationary' | 'walking' | 'driving'
    }>;
}

export default function AgentDayRouteModal({
    open,
    onClose,
    agentId,
    agentName,
}: DayRouteModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [routeData, setRouteData] = useState<RouteData | null>(null);
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split("T")[0]
    );

    useEffect(() => {
        if (open && agentId && selectedDate) {
            fetchDayRoute();
        }
    }, [open, agentId, selectedDate]);

    const fetchDayRoute = async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await apiClient.get<RouteData>(
                "/field-sales/daily-reports/day-route/",
                {
                    agent_id: agentId.toString(),
                    date: selectedDate,
                }
            );

            setRouteData(data);
        } catch (err: any) {
            setError(err.message || "Failed to load route data");
            setRouteData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (routeData && open) {
            initializeMap();
        }
    }, [routeData, open]);

    const initializeMap = () => {
        if (!routeData || routeData.location_points.length === 0) return;

        loadGoogleMapsScript(() => {
            // Safety check for race conditions
            if (!(window as any).google?.maps?.Map) {
                setTimeout(() => renderMap(), 200);
            } else {
                renderMap();
            }
        });
    };


    const renderMap = () => {
        if (!routeData || routeData.location_points.length === 0) return;

        const mapElement = document.getElementById("day-route-map");
        if (!mapElement) return;

        // Defensive: order chronologically even if the API didn't.
        const points = [...routeData.location_points].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Connect EVERY tracking point in chronological order so the dots form
        // one continuous route — Start (S) on the first point, End (E) on the
        // last. The backend already dropped low-accuracy fixes, near-duplicates
        // and interior spikes. Flagged points stay red + labelled in the tooltip.
        const linePoints = points;

        try {
            const map = new window.google.maps.Map(mapElement, {
                center: { lat: linePoints[0].lat, lng: linePoints[0].lng },
                zoom: 13,
                disableDefaultUI: false,
                styles: [
                    {
                        featureType: "poi",
                        elementType: "labels",
                        stylers: [{ visibility: "off" }],
                    },
                ],
            });

            // Fit map bounds to the trustworthy points so a single stray outlier
            // can't zoom the whole map out.
            const bounds = new window.google.maps.LatLngBounds();
            linePoints.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
            map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });

            // Path coordinates from the filtered, chronological points only.
            const pathCoordinates = linePoints.map((p) => ({
                lat: p.lat,
                lng: p.lng,
            }));

            // Draw the route polyline
            const routePath = new window.google.maps.Polyline({
                path: pathCoordinates,
                geodesic: true,
                strokeColor: theme.palette.primary.main,
                strokeOpacity: 0.8,
                strokeWeight: 4,
            });
            routePath.setMap(map);

            // Shared InfoWindow for point details
            const infoWindow = new window.google.maps.InfoWindow();

            // Add a dot marker for EVERY lat/lng point (red if mocked/suspect)
            points.forEach((point, index) => {
                const flagged = Boolean(point.is_mocked || point.suspect);
                const marker = new window.google.maps.Marker({
                    position: { lat: point.lat, lng: point.lng },
                    map: map,
                    title: flagged ? `Point ${index + 1} — Mock/Spoofed` : `Point ${index + 1}`,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: flagged ? 8 : 7,
                        fillColor: flagged ? "#d32f2f" : "#2196F3",
                        fillOpacity: 0.95,
                        strokeColor: "#ffffff",
                        strokeWeight: 2,
                    },
                    zIndex: flagged ? 5 : 1,
                });

                // Show details on hover.
                const time = new Date(point.timestamp).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                });
                const speedKmh =
                    typeof point.speed === "number" && point.speed >= 0
                        ? `${(point.speed * 3.6).toFixed(0)} km/h`
                        : null;
                const motion = point.motion_state
                    ? point.motion_state.charAt(0).toUpperCase() +
                      point.motion_state.slice(1)
                    : null;
                const flagHtml = flagged
                    ? `<br/><span style="color:#d32f2f;font-weight:700;">⚠ ${point.is_mocked ? "Mock location" : "Impossible jump"}</span>`
                    : "";
                const html = `<div style="font-family:sans-serif;padding:4px 2px;min-width:150px;line-height:1.55;">
                        <strong>Point ${index + 1}</strong><br/>
                        <span style="color:#555;">Time:</span> ${time}<br/>
                        ${motion ? `<span style="color:#555;">Status:</span> ${motion}<br/>` : ""}
                        ${speedKmh ? `<span style="color:#555;">Speed:</span> ${speedKmh}<br/>` : ""}
                        <span style="color:#555;">Accuracy:</span> ${point.accuracy?.toFixed(0) ?? "N/A"}m${flagHtml}
                    </div>`;
                marker.addListener("mouseover", () => {
                    infoWindow.setContent(html);
                    infoWindow.open(map, marker);
                });
                marker.addListener("mouseout", () => {
                    infoWindow.close();
                });
            });

            // Start (green) + either a live "current position" marker (agent
            // still punched in) or an End (red) marker (day complete). With a
            // single point we draw only the start, so S and E don't stack on the
            // exact same spot — which previously hid S and showed only "E".
            const isActive = !routeData.punch_out_time;
            const singlePoint = pathCoordinates.length <= 1;
            const lastPos = pathCoordinates[pathCoordinates.length - 1];

            new window.google.maps.Marker({
                position: pathCoordinates[0],
                map: map,
                title: singlePoint ? (isActive ? "Current location" : "Location") : "Start",
                label: { text: "S", color: "white", fontWeight: "bold" },
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 14,
                    fillColor: "#4caf50",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 3,
                },
                zIndex: 10,
            });

            if (!singlePoint) {
                new window.google.maps.Marker({
                    position: lastPos,
                    map: map,
                    title: isActive ? "Current position (live)" : "End",
                    label: isActive
                        ? undefined
                        : { text: "E", color: "white", fontWeight: "bold" },
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: isActive ? 9 : 14,
                        fillColor: isActive ? "#2196F3" : "#f44336",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: isActive ? 4 : 3,
                    },
                    zIndex: 11,
                });
            }
        } catch (err) {
            console.error("Error rendering route map:", err);
            setError("Error initializing Google Maps. Please ensure Maps JavaScript API is enabled.");
        }
    };



    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 1,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    pb: 2,
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <RouteIcon color="primary" />
                    <Typography variant="h6" fontWeight={800}>
                        Day Route Tracker
                    </Typography>
                </Stack>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Date Selector & Agent Info */}
                <Box
                    sx={{
                        p: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    }}
                >
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="h6" fontWeight={700} gutterBottom>
                                    {agentName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Select a date to view the complete route
                                </Typography>
                            </Box>
                            <TextField
                                type="date"
                                size="small"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                InputProps={{
                                    sx: {
                                        bgcolor: "white",
                                        borderRadius: 2,
                                        fontWeight: 600,
                                        minWidth: 160,
                                        boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                                        '&:hover': {
                                            boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.12)}`,
                                        }
                                    },
                                }}
                            />
                        </Stack>
                    </Stack>
                </Box>

                {loading && (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            minHeight: 500,
                            gap: 2,
                        }}
                    >
                        <CircularProgress size={48} thickness={4} />
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                            Loading route data...
                        </Typography>
                    </Box>
                )}

                {error && (
                    <Box sx={{ p: 3 }}>
                        <Alert
                            severity="error"
                            sx={{
                                borderRadius: 2,
                                boxShadow: `0 2px 8px ${alpha(theme.palette.error.main, 0.15)}`,
                            }}
                        >
                            {error}
                        </Alert>
                    </Box>
                )}

                {routeData && !loading && (
                    <Box>
                        {/* Enhanced Stats Header */}
                        <Box
                            sx={{
                                p: 2.5,
                                bgcolor: alpha(theme.palette.background.default, 0.6),
                                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                            }}
                        >
                            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
                                <Chip
                                    icon={<AccessTimeIcon fontSize="small" />}
                                    label={`${routeData.total_points} tracking point${routeData.total_points === 1 ? "" : "s"}`}
                                    size="medium"
                                    sx={{
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        color: theme.palette.primary.main,
                                        fontWeight: 700,
                                        borderRadius: 2,
                                        px: 1,
                                        '& .MuiChip-icon': {
                                            color: theme.palette.primary.main,
                                        }
                                    }}
                                />
                                {routeData.punch_in_time && routeData.punch_out_time && (
                                    <Chip
                                        icon={<SpeedIcon fontSize="small" />}
                                        label={`${new Date(routeData.punch_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(routeData.punch_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                                        size="medium"
                                        sx={{
                                            bgcolor: alpha(theme.palette.success.main, 0.1),
                                            color: theme.palette.success.main,
                                            fontWeight: 700,
                                            borderRadius: 2,
                                            px: 1,
                                            '& .MuiChip-icon': {
                                                color: theme.palette.success.main,
                                            }
                                        }}
                                    />
                                )}
                                {routeData.punch_in_time && !routeData.punch_out_time && (
                                    <Chip
                                        label="Still Active"
                                        size="medium"
                                        sx={{
                                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                                            color: theme.palette.warning.main,
                                            fontWeight: 700,
                                            borderRadius: 2,
                                            px: 1,
                                        }}
                                    />
                                )}
                                {routeData.mock_detected && (
                                    <Chip
                                        label={`⚠ Fake GPS — ${routeData.mock_point_count ?? 0} point(s) flagged`}
                                        size="medium"
                                        sx={{
                                            bgcolor: alpha(theme.palette.error.main, 0.12),
                                            color: theme.palette.error.main,
                                            fontWeight: 700,
                                            borderRadius: 2,
                                            px: 1,
                                        }}
                                    />
                                )}
                            </Stack>
                        </Box>

                        {/* Map Container */}
                        <Box
                            id="day-route-map"
                            sx={{
                                width: "100%",
                                height: 550,
                                bgcolor: alpha(theme.palette.divider, 0.05),
                                position: 'relative',
                            }}
                        />

                        {/* Enhanced Legend */}
                        <Box
                            sx={{
                                p: 2.5,
                                background: `linear-gradient(to right, ${alpha(theme.palette.background.default, 0.9)}, ${alpha(theme.palette.background.default, 0.6)})`,
                                borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                            }}
                        >
                            <Stack direction="row" spacing={4} justifyContent="center" flexWrap="wrap">
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 16,
                                            height: 16,
                                            borderRadius: "50%",
                                            bgcolor: "#4caf50",
                                            border: "3px solid white",
                                            boxShadow: `0 2px 8px ${alpha("#4caf50", 0.4)}`,
                                        }}
                                    />
                                    <Typography variant="body2" fontWeight={700} color="text.primary">
                                        Start Point
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 16,
                                            height: 16,
                                            borderRadius: "50%",
                                            bgcolor: "#f44336",
                                            border: "3px solid white",
                                            boxShadow: `0 2px 8px ${alpha("#f44336", 0.4)}`,
                                        }}
                                    />
                                    <Typography variant="body2" fontWeight={700} color="text.primary">
                                        End Point
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 28,
                                            height: 5,
                                            bgcolor: theme.palette.primary.main,
                                            borderRadius: 1,
                                            boxShadow: `0 2px 6px ${alpha(theme.palette.primary.main, 0.3)}`,
                                        }}
                                    />
                                    <Typography variant="body2" fontWeight={700} color="text.primary">
                                        Route Path
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: "#2196F3",
                                            border: "2px solid white",
                                            boxShadow: `0 2px 6px ${alpha("#2196F3", 0.4)}`,
                                        }}
                                    />
                                    <Typography variant="body2" fontWeight={700} color="text.primary">
                                        Tracking Points
                                    </Typography>
                                </Stack>
                                {routeData.mock_detected && (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Box
                                            sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: "50%",
                                                bgcolor: "#d32f2f",
                                                border: "2px solid white",
                                                boxShadow: `0 2px 6px ${alpha("#d32f2f", 0.4)}`,
                                            }}
                                        />
                                        <Typography variant="body2" fontWeight={700} color="text.primary">
                                            Fake / Spoofed
                                        </Typography>
                                    </Stack>
                                )}
                            </Stack>
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}

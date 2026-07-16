"use client";

import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Box,
    Typography,
    Chip,
    Stack,
    CircularProgress,
    Alert,
    alpha,
    useTheme,
} from "@mui/material";
import { CloseIcon, RefreshIcon, MyLocationIcon, AccessTimeIcon } from "@/components/icons";
import { apiClient } from "../../lib/api-client";
import { loadGoogleMapsScript } from "../../lib/google-maps-loader";


// Declare Google Maps types
declare global {
    interface Window {
        google: any;
    }
}

interface AgentLocationModalProps {
    open: boolean;
    onClose: () => void;
    agentId: number;
    agentName: string;
}

interface LocationData {
    agent_id: number;
    agent_name: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy: number;
    time_ago: string;
    is_mocked?: boolean;
    mock_detected?: boolean;
}

export default function AgentLocationModal({
    open,
    onClose,
    agentId,
    agentName,
}: AgentLocationModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locationData, setLocationData] = useState<LocationData | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        if (open && agentId) {
            fetchCurrentLocation();
        }
    }, [open, agentId]);

    const fetchCurrentLocation = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const data = await apiClient.get<LocationData>(
                "/field-sales/daily-reports/current-location/",
                { agent_id: agentId.toString() }
            );

            setLocationData(data);
        } catch (err: any) {
            setError(err.message || "Failed to load location");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (locationData && open) {
            initializeMap();
        }
    }, [locationData, open]);

    const initializeMap = () => {
        if (!locationData) return;

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
        if (!locationData) return;

        const mapElement = document.getElementById("agent-location-map");
        if (!mapElement) return;

        try {
            const map = new window.google.maps.Map(mapElement, {
                center: { lat: locationData.latitude, lng: locationData.longitude },
                zoom: 15,
                disableDefaultUI: false,
                styles: [
                    {
                        featureType: "poi",
                        elementType: "labels",
                        stylers: [{ visibility: "off" }],
                    },
                ],
            });

            // Add marker for agent location using standard Marker (red if mocked)
            const flagged = Boolean(locationData.is_mocked);
            new window.google.maps.Marker({
                position: { lat: locationData.latitude, lng: locationData.longitude },
                map: map,
                title: flagged ? `${locationData.agent_name} — Fake GPS` : locationData.agent_name,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: flagged ? "#d32f2f" : theme.palette.primary.main,
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 3,
                },
            });

            // Add accuracy circle
            new window.google.maps.Circle({
                map: map,
                center: { lat: locationData.latitude, lng: locationData.longitude },
                radius: locationData.accuracy,
                fillColor: theme.palette.primary.main,
                fillOpacity: 0.1,
                strokeColor: theme.palette.primary.main,
                strokeOpacity: 0.3,
                strokeWeight: 1,
            });

            setMapLoaded(true);
        } catch (err) {
            console.error("Error rendering map:", err);
            setError("Error initializing Google Maps. Please ensure Maps JavaScript API is enabled.");
        }
    };



    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
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
                    <MyLocationIcon color="primary" />
                    <Typography variant="h6" fontWeight={800}>
                        Current Location
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <IconButton
                        onClick={() => fetchCurrentLocation(true)}
                        size="small"
                        disabled={refreshing}
                        title="Refresh location"
                    >
                        <RefreshIcon
                            fontSize="small"
                            sx={{
                                animation: refreshing ? "spin 1s linear infinite" : "none",
                                "@keyframes spin": {
                                    "0%": { transform: "rotate(0deg)" },
                                    "100%": { transform: "rotate(360deg)" },
                                },
                            }}
                        />
                    </IconButton>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {loading && (
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            minHeight: 400,
                        }}
                    >
                        <CircularProgress />
                    </Box>
                )}

                {error && (
                    <Box sx={{ p: 3 }}>
                        <Alert severity="error">{error}</Alert>
                    </Box>
                )}

                {locationData && !loading && (
                    <Box>
                        {/* Agent Info Header */}
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: alpha(theme.palette.primary.main, 0.05),
                                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                {locationData.agent_name}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                                <Chip
                                    icon={<AccessTimeIcon fontSize="small" />}
                                    label={locationData.time_ago}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                />
                                {(locationData.is_mocked || locationData.mock_detected) && (
                                    <Chip
                                        label={locationData.is_mocked ? "Fake GPS (live)" : "Fake GPS earlier"}
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                    />
                                )}
                            </Stack>
                        </Box>

                        {/* Map Container */}
                        <Box
                            id="agent-location-map"
                            sx={{
                                width: "100%",
                                height: 400,
                                bgcolor: alpha(theme.palette.divider, 0.05),
                            }}
                        />

                        {/* Location Details */}
                        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                            <Stack spacing={1}>
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                        Latitude
                                    </Typography>
                                    <Typography variant="body2" fontWeight={700}>
                                        {locationData.latitude.toFixed(6)}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                        Longitude
                                    </Typography>
                                    <Typography variant="body2" fontWeight={700}>
                                        {locationData.longitude.toFixed(6)}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                        Accuracy
                                    </Typography>
                                    <Typography variant="body2" fontWeight={700}>
                                        ±{locationData.accuracy.toFixed(0)}m
                                    </Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                        Last Updated
                                    </Typography>
                                    <Typography variant="body2" fontWeight={700}>
                                        {new Date(locationData.timestamp).toLocaleString()}
                                    </Typography>
                                </Stack>
                            </Stack>
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}

import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    TextField,
    InputAdornment,
    Typography,
} from "@mui/material";
import { SearchIcon, CloseIcon, MyLocationIcon } from "@/components/icons";
import { loadGoogleMapsScript } from "../../lib/google-maps-loader";


interface MapLocationPickerProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (location: {
        lat: number;
        lng: number;
        address: string;
        city?: string;
        state?: string;
        pincode?: string;
    }) => void;
    initialLat?: number;
    initialLng?: number;
}

const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
    open,
    onClose,
    onConfirm,
    initialLat = 28.6139,
    initialLng = 77.2090,
}) => {
    const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
    const [marker, setMarker] = useState<any>(null);
    const [currentLocation, setCurrentLocation] = useState({
        lat: initialLat,
        lng: initialLng,
        address: "",
        city: "",
        state: "",
        pincode: ""
    });
    const mapSearchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && !googleMapsLoaded) {
            loadGoogleMapsScript(() => {
                setGoogleMapsLoaded(true);
                injectStyles();
            });
        }
    }, [open, googleMapsLoaded]);


    const injectStyles = () => {
        const styleId = "google-maps-pac-style";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.innerHTML = `
        .pac-container { z-index: 10000 !important; background-color: #fff; border-top: 1px solid #d9d9d9; font-family: Arial, sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin-top: 2px; }
        .pac-item { padding: 8px 10px; cursor: pointer; border-bottom: 1px solid #eee; }
        .pac-item:hover { background-color: #f7f7f7; }
        .pac-item-query { font-size: 14px; color: #333; }
      `;
            document.head.appendChild(style);
        }
    };

    useEffect(() => {
        if (open && googleMapsLoaded) {
            const interval = setInterval(() => {
                const mapDiv = document.getElementById("google-map-picker");
                if (mapDiv) {
                    clearInterval(interval);
                    const pos = {
                        lat: Number(currentLocation.lat) || 28.6139,
                        lng: Number(currentLocation.lng) || 77.2090
                    };
                    const newMap = new (window as any).google.maps.Map(mapDiv, {
                        center: pos,
                        zoom: 15,
                        mapTypeControl: false,
                    });
                    const newMarker = new (window as any).google.maps.Marker({
                        position: pos,
                        map: newMap,
                        draggable: true,
                    });

                    setMarker(newMarker);

                    const input = mapSearchRef.current;
                    if (input) {
                        const google = (window as any).google;
                        const autocomplete = new google.maps.places.Autocomplete(input);
                        autocomplete.bindTo("bounds", newMap);

                        autocomplete.addListener("place_changed", () => {
                            const place = autocomplete.getPlace();
                            if (!place || !place.geometry || !place.geometry.location) return;

                            if (place.geometry.viewport) {
                                newMap.fitBounds(place.geometry.viewport);
                            } else {
                                newMap.setCenter(place.geometry.location);
                                newMap.setZoom(17);
                            }
                            newMarker.setPosition(place.geometry.location);

                            // Extract address components
                            let city = "";
                            let state = "";
                            let pincode = "";

                            if (place.address_components) {
                                for (const component of place.address_components) {
                                    const types = component.types;
                                    if (types.includes("locality")) {
                                        city = component.long_name;
                                    } else if (types.includes("administrative_area_level_1")) {
                                        state = component.long_name;
                                    } else if (types.includes("postal_code")) {
                                        pincode = component.long_name;
                                    }
                                }
                            }

                            setCurrentLocation({
                                lat: place.geometry.location.lat(),
                                lng: place.geometry.location.lng(),
                                address: place.formatted_address || '',
                                city,
                                state,
                                pincode
                            });
                        });
                    }

                    newMap.addListener("click", (e: any) => {
                        const lat = e.latLng.lat();
                        const lng = e.latLng.lng();
                        newMarker.setPosition(e.latLng);

                        // For clicks, we might not have the full address info immediately
                        // But we keep the current address components if they were set
                        setCurrentLocation(prev => ({
                            ...prev,
                            lat,
                            lng
                        }));
                    });

                    newMarker.addListener("dragend", (e: any) => {
                        const lat = e.latLng.lat();
                        const lng = e.latLng.lng();
                        setCurrentLocation(prev => ({
                            ...prev,
                            lat,
                            lng
                        }));
                    });
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [open, googleMapsLoaded]);

    const handleConfirm = () => {
        if (marker) {
            const pos = marker.getPosition();
            if (pos) {
                onConfirm({
                    lat: Number(pos.lat().toFixed(6)),
                    lng: Number(pos.lng().toFixed(6)),
                    address: currentLocation.address,
                    city: currentLocation.city,
                    state: currentLocation.state,
                    pincode: currentLocation.pincode
                });
            }
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Select Business Location
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ minHeight: 450, position: 'relative', p: 0 }}>
                <Box sx={{ p: 2, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, bgcolor: 'transparent' }}>
                    <TextField
                        fullWidth
                        inputRef={mapSearchRef}
                        placeholder="Search location or pincode..."
                        inputProps={{ autoComplete: 'off' }}
                        variant="outlined"
                        size="small"
                        sx={{
                            bgcolor: 'white',
                            borderRadius: 1,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { border: 'none' },
                            }
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
                <Box id="google-map-picker" sx={{ width: '100%', height: 450 }} />
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ flex: 1, ml: 1 }}>
                    {currentLocation.lat ? `Lat: ${Number(currentLocation.lat).toFixed(4)}, Lng: ${Number(currentLocation.lng).toFixed(4)}` : 'Click on map or drag marker'}
                </Typography>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleConfirm} startIcon={<MyLocationIcon />}>Confirm Location</Button>
            </DialogActions>
        </Dialog>
    );
};

export default MapLocationPicker;

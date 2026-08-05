"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  Grid,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  MenuItem,
  useTheme,
  alpha,
  Divider,
  Switch,
  FormControlLabel,
  InputAdornment,
  CircularProgress,
  Snackbar,
  Alert,
  Autocomplete,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import { motion } from "framer-motion";

// Icons
import { DomainIcon, SaveIcon, UploadIcon, LocationOnIcon, ReceiptLongIcon, PaletteIcon, BusinessIcon, LanguageIcon, PhoneIcon, EmailIcon, CalendarTodayIcon, SearchIcon, MyLocationIcon, CloseIcon, AccessTimeIcon, EventRepeatIcon } from "@/components/icons";
import EmailOTPModal from "@/components/common/EmailOTPModal";
import { coreService, Company } from "@/lib/core-service";
import { loadGoogleMapsScript } from "@/lib/google-maps-loader";

// --- COMPONENTS ---

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => (
  <Paper
    data-animate-group
    elevation={0}
    sx={{
      p: 2.5,
      bgcolor: "background.paper",
      display: "flex",
      alignItems: "center",
      gap: 2,
      border: "none",
      boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
      height: "100%",
    }}
  >
    <Avatar
      variant="rounded"
      sx={{
        bgcolor: alpha(color, 0.1),
        color: color,
        width: 50,
        height: 50,
        borderRadius: 1,
      }}
    >
      {icon}
    </Avatar>
    <Box>
      <Typography variant="h6" fontWeight={700}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        {title}
      </Typography>
    </Box>
  </Paper>
);

export default function CompanySettingsPage() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // State
  const [company, setCompany] = useState<Partial<Company>>({
    name: "",
    registration_number: "",
    tax_id: "",
    email: "",
    phone: "",
    website: "",
    logo: "",
    default_currency: "USD",
    timezone: "UTC-5 (EST)",
    date_format: "DD/MM/YYYY",
    country: "",
    full_address: "",
    latitude: undefined,
    longitude: undefined,
    fiscal_month_start: 4,
    fiscal_day_start: 1,
    office_start_time: "09:00",
    office_end_time: "18:00",
  });

  const [mapOpen, setMapOpen] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [marker, setMarker] = useState<any>(null);
  const mapSearchRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGoogleMapsScript(() => setGoogleMapsLoaded(true));

    // Ensure Google Places autocomplete dropdown appears above MUI Dialog
    const style = document.createElement('style');
    style.innerHTML = `
      .pac-container {
        z-index: 10000 !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (mapOpen && googleMapsLoaded) {
      const interval = setInterval(() => {
        const mapDiv = document.getElementById("google-map-company");
        const input = mapSearchRef.current;
        if (mapDiv && input) {
          clearInterval(interval);
          const initialPos = {
            lat: Number(company.latitude) || 28.6139,
            lng: Number(company.longitude) || 77.2090
          };
          const newMap = new (window as any).google.maps.Map(mapDiv, {
            center: initialPos,
            zoom: 12,
            mapTypeControl: false,
          });
          const newMarker = new (window as any).google.maps.Marker({
            position: initialPos,
            map: newMap,
            draggable: true,
          });
          setMarker(newMarker);

          const google = (window as any).google;

          // Configure autocomplete with proper options
          const autocomplete = new google.maps.places.Autocomplete(input, {
            types: ['geocode', 'establishment'],
            fields: ['formatted_address', 'geometry', 'name', 'address_components']
          });

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
            setCompany(prev => ({
              ...prev,
              full_address: place.formatted_address || place.name || ''
            }));
          });

          // Reverse geocode a LatLng and update the address field
          const reverseGeocode = (latLng: any) => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: latLng }, (results: any, status: any) => {
              if (status === "OK" && results && results[0]) {
                setCompany(prev => ({
                  ...prev,
                  full_address: results[0].formatted_address || ''
                }));
                // Update the search box text too
                if (input) input.value = results[0].formatted_address || '';
              }
            });
          };

          // Map click → move marker + reverse geocode
          newMap.addListener("click", (e: any) => {
            newMarker.setPosition(e.latLng);
            reverseGeocode(e.latLng);
          });

          // Marker drag end → reverse geocode
          newMarker.addListener("dragend", () => {
            reverseGeocode(newMarker.getPosition());
          });
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [mapOpen, googleMapsLoaded]);

  // Helper function to extract city from address (client-side)
  const extractCityFromAddress = (fullAddress: string): string => {
    if (!fullAddress) return '';

    // Common Indian states to avoid extracting them as cities
    const indianStates = [
      'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh',
      'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka',
      'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
      'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana',
      'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'india'
    ];

    // Split by comma to get address components
    const parts = fullAddress.split(',').map(p => p.trim()).filter(p => p);

    if (parts.length < 2) return '';

    // Strategy 1: Find the component that comes before a state name
    for (let i = 0; i < parts.length - 1; i++) {
      const currentPart = parts[i].toLowerCase();
      const nextPart = parts[i + 1].toLowerCase();

      // Check if next part contains a state name
      const isNextState = indianStates.some(state => nextPart.includes(state));
      const isCurrentState = indianStates.some(state => currentPart.includes(state));

      if (isNextState && !isCurrentState) {
        // Remove PIN code if present
        let city = parts[i].replace(/\s*[-–]?\s*\d{6}.*$/, '').trim();
        // Remove common non-city keywords
        city = city.replace(/\b(circle|nagar|colony|block|sector|area|road|street|marg)\b/gi, '').trim();

        if (city && city.length > 2 && !/^\d+$/.test(city)) {
          return city;
        }
      }
    }

    // Strategy 2: Look for city before PIN code pattern
    const pinMatch = fullAddress.match(/,\s*([A-Za-z\s]+?)\s*[-–]?\s*\d{6}/);
    if (pinMatch && pinMatch[1]) {
      const city = pinMatch[1].trim();
      if (!indianStates.includes(city.toLowerCase()) && city.length > 2) {
        return city;
      }
    }

    // Strategy 3: Get the second-to-last or third-to-last component
    for (let i = parts.length - 1; i >= Math.max(0, parts.length - 4); i--) {
      const part = parts[i];
      const partLower = part.toLowerCase();

      // Skip if it's a state, country, or just numbers
      if (!indianStates.includes(partLower) &&
        !/^\d+$/.test(part) &&
        !partLower.includes('india')) {

        // Clean up the part
        let city = part.replace(/\s*[-–]?\s*\d{6}.*$/, '').trim();
        city = city.replace(/\b(circle|nagar|colony|block|sector|area)\b/gi, '').trim();

        if (city && city.length > 2 && !indianStates.includes(city.toLowerCase())) {
          return city;
        }
      }
    }

    return '';
  };

  const saveLocation = () => {
    if (marker) {
      const pos = marker.getPosition();
      if (pos) {
        // Extract city from the current full_address
        const extractedCity = extractCityFromAddress(company.full_address || '');

        setCompany({
          ...company,
          latitude: Number(pos.lat().toFixed(6)),
          longitude: Number(pos.lng().toFixed(6)),
          default_operating_city: extractedCity || company.default_operating_city
        });
        setMapOpen(false);
        setMessage({ type: 'success', text: "Location updated successfully" });
      }
    }
  };

  const [logoFile, setLogoFile] = useState<File | null>(null);

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  /** Persist fiscal month so getFYDates() picks it up without prop-drilling */
  const syncFiscalMonth = (month: number) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fiscalMonthStart', String(month));
    }
  };

  const getMaxDaysInMonth = (month: number) => {
    const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[month - 1] || 31;
  };

  // Fetch Company Data
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        const data = await coreService.getCurrentCompany();
        setCompany(data);
        if (data.fiscal_month_start) syncFiscalMonth(data.fiscal_month_start);
      } catch (error) {
        console.error("Failed to fetch company settings:", error);
        setMessage({ type: 'error', text: "Failed to load company settings" });
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, []);



  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setLogoFile(event.target.files[0]);
    }
  };

  const handleSave = async () => {
    if (!company.id) return;
    try {
      setSaving(true);

      let updatedCompany = { ...company };

      let dataToSend: any = updatedCompany;

      if (logoFile) {
        const formData = new FormData();
        // Append all scalar/object fields — skip the existing logo URL (replacing with new File)
        Object.keys(updatedCompany).forEach(key => {
          if (key === 'logo') return; // replaced by the new File below
          const val = (updatedCompany as any)[key];
          if (val === undefined || val === null) return;
          if (Array.isArray(val)) {
            // Arrays must be JSON-encoded so backend receives a real list
            formData.append(key, JSON.stringify(val));
          } else if (typeof val === 'object') {
            // Plain objects (e.g. `address`) must be JSON-encoded;
            // FormData.append() on a plain object silently produces "[object Object]"
            formData.append(key, JSON.stringify(val));
          } else {
            formData.append(key, String(val));
          }
        });
        formData.append('logo', logoFile);
        dataToSend = formData;
      }

      await coreService.updateCompany(updatedCompany.id!, dataToSend);
      if (updatedCompany.fiscal_month_start) syncFiscalMonth(updatedCompany.fiscal_month_start);
      setMessage({ type: 'success', text: "Company settings saved successfully" });

      // Refresh to get the updated logo URL from backend if needed
      if (logoFile) {
        const data = await coreService.getCurrentCompany();
        setCompany(data);
        setLogoFile(null);
      }

    } catch (error) {
      console.error("Failed to save:", error);
      setMessage({ type: 'error', text: "Failed to save changes" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  return (
    <>
      <Box>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* 1. HEADER */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems="center"
            mb={4}
          >
            <Box>
              <Typography
                variant="h4"
                fontWeight={800}
                sx={{ letterSpacing: "-0.02em" }}
              >
                Company Settings
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Organization
                </Typography>
                <Box
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    bgcolor: "text.disabled",
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Configuration
                </Typography>
              </Stack>
            </Box>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{
                borderRadius: "12px",
                px: 4,
                py: 1.2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </Stack>

          {/* 2. OVERVIEW STATS */}
          <Grid container spacing={3} mb={4}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard
                title="Active Entity"
                value={company.name || "N/A"}
                icon={<BusinessIcon />}
                color={theme.palette.primary.main}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard
                title="Current Fiscal Year"
                value={`${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`}
                icon={<CalendarTodayIcon />}
                color={theme.palette.secondary.main}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard
                title="Region"
                value={company.country || "N/A"}
                icon={<LanguageIcon />}
                color={theme.palette.success.main}
              />
            </Grid>
          </Grid>

          {/* 3. MAIN SETTINGS PAPER */}
          <Paper
            elevation={0}
            sx={{
              border: "none",
              bgcolor: "background.paper",
              boxShadow: "0px 4px 30px rgba(0,0,0,0.02)",
              overflow: "hidden",
              minHeight: 600,
            }}
          >
            {/* TABS */}


            <Box sx={{ p: 4 }}>
              {/* --- GENERAL INFO --- */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Stack spacing={3}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 8 }}>
                          <TextField
                            label="Company Legal Name"
                            fullWidth
                            value={company.name || ""}
                            onChange={(e) =>
                              setCompany({ ...company, name: e.target.value })
                            }
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Registration No."
                            fullWidth
                            value={company.registration_number || ""}
                            onChange={(e) =>
                              setCompany({
                                ...company,
                                registration_number: e.target.value,
                              })
                            }
                          />
                        </Grid>
                      </Grid>

                      <TextField
                        label="Tax Identification Number (TIN / GSTIN / VAT)"
                        fullWidth
                        value={company.tax_id || ""}
                        onChange={(e) =>
                          setCompany({ ...company, tax_id: e.target.value })
                        }
                      />

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Primary Email"
                            fullWidth
                            type="email"
                            value={company.email || ""}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <EmailIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                            onChange={(e) =>
                              setCompany({
                                ...company,
                                email: e.target.value,
                              })
                            }
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Phone Number"
                            fullWidth
                            value={company.phone || ""}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PhoneIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                            onChange={(e) =>
                              setCompany({
                                ...company,
                                phone: e.target.value,
                              })
                            }
                          />
                        </Grid>
                      </Grid>

                      <TextField
                        label="Website URL"
                        fullWidth
                        value={company.website || ""}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LanguageIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                        onChange={(e) =>
                          setCompany({ ...company, website: e.target.value })
                        }
                      />

                      <Divider sx={{ my: 1 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" color="text.secondary">Business Address</Typography>
                        <Button
                          size="small"
                          startIcon={<LocationOnIcon />}
                          onClick={() => setMapOpen(true)}
                          sx={{ textTransform: 'none' }}
                        >
                          Select on Map
                        </Button>
                      </Stack>
                      <TextField
                        label="Full Address (Auto-filled from map)"
                        fullWidth
                        multiline
                        rows={3}
                        value={company.full_address || ""}
                        onChange={(e) => setCompany({ ...company, full_address: e.target.value })}
                        placeholder="Search location on map to auto-fill address..."
                      />
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Latitude"
                            fullWidth
                            value={company.latitude || ""}
                            InputProps={{ readOnly: true }}
                            variant="filled"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Longitude"
                            fullWidth
                            value={company.longitude || ""}
                            InputProps={{ readOnly: true }}
                            variant="filled"
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Autocomplete
                            multiple
                            freeSolo
                            options={[]}
                            value={company.operating_cities || []}
                            onChange={(event, newValue) => {
                              // Remove case-insensitive duplicates
                              const uniqueCities: string[] = [];
                              const seenLowerCase = new Set<string>();

                              for (const city of newValue as string[]) {
                                const lowerCity = city.toLowerCase().trim();
                                if (!seenLowerCase.has(lowerCity) && lowerCity) {
                                  seenLowerCase.add(lowerCity);
                                  uniqueCities.push(city.trim());
                                }
                              }

                              setCompany({
                                ...company,
                                operating_cities: uniqueCities
                              });
                            }}
                            renderTags={(value, getTagProps) =>
                              value.map((option, index) => (
                                <Chip
                                  label={option}
                                  {...getTagProps({ index })}
                                  key={option}
                                  icon={<LocationOnIcon fontSize="small" />}
                                  size="small"
                                />
                              ))
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Operating Cities"
                                placeholder="Type city name and press Enter"
                                helperText="Add cities where your company operates"
                                InputProps={{
                                  ...params.InputProps,
                                  startAdornment: (
                                    <>
                                      <InputAdornment position="start">
                                        <LocationOnIcon fontSize="small" />
                                      </InputAdornment>
                                      {params.InputProps.startAdornment}
                                    </>
                                  ),
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <TextField
                            label="Default Operating City"
                            fullWidth
                            value={company.default_operating_city || ""}
                            onChange={(e) => setCompany({ ...company, default_operating_city: e.target.value })}
                            placeholder="Auto-extracted from address or enter manually"
                            helperText="Default city extracted from company address"
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <LocationOnIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Grid>
                      </Grid>

                      {/* ── FISCAL YEAR & WORKING HOURS ── */}
                      <Divider sx={{ my: 1 }} />
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <EventRepeatIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" color="text.secondary">
                          Fiscal Year & Working Hours
                        </Typography>
                      </Stack>

                      <Grid container spacing={2} mb={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            select
                            label="Fiscal Year Start Month"
                            fullWidth
                            value={company.fiscal_month_start ?? 4}
                            onChange={(e) => {
                              const newMonth = Number(e.target.value);
                              const maxDays = getMaxDaysInMonth(newMonth);
                              const currentDay = company.fiscal_day_start ?? 1;
                              setCompany({
                                ...company,
                                fiscal_month_start: newMonth,
                                fiscal_day_start: currentDay > maxDays ? maxDays : currentDay
                              });
                            }}
                            helperText="All annual reports will be calculated from this month"
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <CalendarTodayIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                          >
                            {MONTH_NAMES.map((name, idx) => (
                              <MenuItem key={idx + 1} value={idx + 1}>
                                {name}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            type="number"
                            label="Fiscal Year Start Date (Day)"
                            fullWidth
                            value={company.fiscal_day_start ?? 1}
                            onChange={(e) => {
                              // We use e.target.value directly then constraint it immediately
                              // If user types numbers quickly, sometimes parsing is helpful, 
                              // we let React update it but also clamp if it exceeds.
                              let val = parseInt(e.target.value, 10);
                              if (isNaN(val)) val = 1;
                              const maxDays = getMaxDaysInMonth(company.fiscal_month_start ?? 4);
                              if (val > maxDays) val = maxDays;
                              if (val < 1) val = 1;
                              setCompany({ ...company, fiscal_day_start: val });
                            }}
                            helperText={`Day of the month the fiscal year starts (1-${getMaxDaysInMonth(company.fiscal_month_start ?? 4)})`}
                            inputProps={{ min: 1, max: getMaxDaysInMonth(company.fiscal_month_start ?? 4) }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <CalendarTodayIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Grid>
                      </Grid>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Office Start Time"
                            type="time"
                            fullWidth
                            value={company.office_start_time || "09:00"}
                            onChange={(e) =>
                              setCompany({ ...company, office_start_time: e.target.value })
                            }
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <AccessTimeIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                            inputProps={{ step: 300 }}
                            helperText="Working day start time"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Office End Time"
                            type="time"
                            fullWidth
                            value={company.office_end_time || "18:00"}
                            onChange={(e) =>
                              setCompany({ ...company, office_end_time: e.target.value })
                            }
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <AccessTimeIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                            inputProps={{ step: 300, min: company.office_start_time || "09:00" }}
                            helperText="Working day end time"
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Grid>

                  {/* Right Side: Logo Upload Preview */}
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box
                      sx={{
                        p: 3,
                        border: `1px dashed ${alpha(
                          theme.palette.divider,
                          0.5
                        )}`,
                        textAlign: "center",
                      }}
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        Company Logo
                      </Typography>
                      <Avatar
                        src={logoFile ? URL.createObjectURL(logoFile) : (company.logo || "/logo-placeholder.svg")}
                        sx={{
                          width: 120,
                          height: 120,
                          mx: "auto",
                          mb: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          fontSize: "3rem",
                          color: "primary.main",
                        }}
                      >
                        {company.name ? company.name[0] : "S"}
                      </Avatar>

                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="logo-file-input"
                        type="file"
                        onChange={handleLogoChange}
                      />
                      <label htmlFor="logo-file-input">
                        <Button
                          variant="outlined"
                          size="small"
                          component="span"
                          startIcon={<UploadIcon />}
                        >
                          Upload New
                        </Button>
                      </label>

                      <Typography
                        variant="caption"
                        display="block"
                        color="text.secondary"
                        mt={2}
                      >
                        Recommended: 400x400px (PNG/JPG)
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </motion.div>
            </Box>
          </Paper>

          {/* Save Changes Button (Bottom) */}
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              size="large"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{
                borderRadius: 2,
                px: 4,
                py: 1.5,
                boxShadow: 3,
                "&:hover": {
                  boxShadow: 6,
                },
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </Box>

          {/* Snackbar for Notifications */}
          <Snackbar
            open={!!message}
            autoHideDuration={6000}
            onClose={() => setMessage(null)}
          >
            <Alert onClose={() => setMessage(null)} severity={message?.type as any} sx={{ width: '100%' }}>
              {message?.text}
            </Alert>
          </Snackbar>

          {/* --- MAP DIALOG --- */}
          <Dialog open={mapOpen} onClose={() => setMapOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Select Business Location
              <IconButton onClick={() => setMapOpen(false)} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ minHeight: 450, position: 'relative', p: 0, overflow: 'visible' }}>
              <Box sx={{ p: 2, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, bgcolor: 'transparent' }}>
                <TextField
                  fullWidth
                  inputRef={mapSearchRef}
                  id="map-search-company"
                  placeholder="Search location or pincode..."
                  inputProps={{
                    autoComplete: 'new-password',
                    'aria-autocomplete': 'list'
                  }}
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
              <Box id="google-map-company" sx={{ width: '100%', height: 450 }} />
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ flex: 1, ml: 1 }}>
                {company.latitude ? `Lat: ${Number(company.latitude).toFixed(4)}, Lng: ${Number(company.longitude).toFixed(4)}` : 'Click on map or drag marker'}
              </Typography>
              <Button onClick={() => setMapOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={saveLocation} startIcon={<MyLocationIcon />}>Confirm Location</Button>
            </DialogActions>
          </Dialog>

        </motion.div>
      </Box>
    </>
  );
}

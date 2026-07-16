"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Box,
    Typography,
    Stack,
    TextField,
    Button,
    Alert,
    alpha,
    useTheme,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    OutlinedInput,
    Avatar,
    Chip,
    Autocomplete,
    Tooltip,
    CircularProgress,
} from "@mui/material";
import { CloseIcon, AddIcon, AddCircleOutlineIcon, LocationOnIcon } from "@/components/icons";
import { coreService } from "@/lib/core-service";
import { apiClient } from "@/lib/api-client";

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

interface UserFormDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (userData: any, files: { profile?: File; aadhaar?: File; pan?: File }) => Promise<void>;
    mode: "ADD" | "EDIT";
    initialData?: any;
    restrictedMode?: "sales_agent_only"; // For Sales Manager creating agents
    currentUserRole?: string;
    currentUserCity?: string; // kept for backward compat
    currentUserCities?: string[]; // preferred: manager's cities
    currentUserId?: number; // Current user ID for auto-assignment
    defaultCity?: string; // Company default city for non-sales roles
    availableManagers?: Array<{ id: number; name: string; operating_city: string }>;
    availableAgents?: Array<{ id: number; name: string; operating_city: string }>;
    operatingCities?: string[];
    availableTags?: string[];
    roles?: string[];
}

const SALES_ROLES = ["Sales Manager", "Sales Agent", "Distributor"];

const SALEXA_ROLES = [
    "Admin",
    "Sales Manager",
    "Sales Agent",
    "Distributor",
    "Warehouse Manager",
    "Production Manager",
    "Accountant",
];

const AVAILABLE_TAGS = ["VIP", "Premium", "Regular", "New", "Verified"];

export default function UserFormDialog({
    open,
    onClose,
    onSubmit,
    mode,
    initialData,
    restrictedMode,
    currentUserRole,
    currentUserCity,
    currentUserCities,
    currentUserId,
    defaultCity,
    availableManagers = [],
    availableAgents = [],
    operatingCities = [],
    availableTags = AVAILABLE_TAGS,
    roles = SALEXA_ROLES,
}: UserFormDialogProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Resolve manager's cities from either new prop or legacy prop — mutable local copy
    const [managerCities, setManagerCities] = useState<string[]>(
        currentUserCities || (currentUserCity ? [currentUserCity] : [])
    );

    // Sync when props change (e.g. dialog reopened)
    useEffect(() => {
        setManagerCities(currentUserCities || (currentUserCity ? [currentUserCity] : []));
    }, [currentUserCities, currentUserCity]);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        aadhaar_number: "",
        pan_number: "",
        role: restrictedMode === "sales_agent_only" ? "Sales Agent" : (roles.length === 1 ? roles[0] : ""),
        status: "Active",
        operating_cities: restrictedMode === "sales_agent_only" ? managerCities : [] as string[],
        operating_pincodes: [] as string[],
        tags: [] as string[],
        assignedTo: restrictedMode === "sales_agent_only" && currentUserId ? String(currentUserId) : "",
        assignedAgent: "",
        latitude: "",
        longitude: "",
        full_address: "",
        gst_number: "",
        shipping_address: "",
    });

    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
    const [panFile, setPanFile] = useState<File | null>(null);
    const [mapOpen, setMapOpen] = useState(false);
    const [activeAddressField, setActiveAddressField] = useState<'billing' | 'shipping'>('billing');

    // Company cities state
    const [companyCities, setCompanyCities] = useState<string[]>(operatingCities);
    const [companyId, setCompanyId] = useState<number | null>(null);
    const [addCityOpen, setAddCityOpen] = useState(false);
    const [newCityName, setNewCityName] = useState("");
    const [addingCity, setAddingCity] = useState(false);

    // Fetch company cities on dialog open
    useEffect(() => {
        if (!open) return;
        const fetchCompanyCities = async () => {
            try {
                const company = await coreService.getCurrentCompany();
                setCompanyId(company.id);
                if (company.operating_cities && company.operating_cities.length > 0) {
                    setCompanyCities(company.operating_cities);
                }
            } catch (err) {
                console.error("Failed to fetch company cities:", err);
            }
        };
        fetchCompanyCities();
    }, [open]);

    const handleAddCity = async () => {
        const city = newCityName.trim();
        if (!city) return;

        // Check duplicate (case-insensitive)
        if (companyCities.some((c) => c.toLowerCase() === city.toLowerCase())) {
            setError(`"${city}" already exists`);
            return;
        }

        try {
            setAddingCity(true);
            const updatedCities = [...companyCities, city];

            // 1. Add to Company Settings
            if (companyId) {
                await coreService.updateCompany(companyId, { operating_cities: updatedCities } as any);
            }

            // 2. If Sales Manager, also add to their own operating_city
            if (currentUserRole === "sales_manager" && currentUserId) {
                const updatedManagerCities = [...managerCities, city];
                await apiClient.patch(`/auth/users/${currentUserId}/`, {
                    operating_city: JSON.stringify(updatedManagerCities),
                });
                setManagerCities(updatedManagerCities);
            }

            setCompanyCities(updatedCities);
            setNewCityName("");
            setAddCityOpen(false);
        } catch (err: any) {
            setError(err.message || "Failed to add city");
        } finally {
            setAddingCity(false);
        }
    };

    useEffect(() => {
        if (initialData && mode === "EDIT") {
            setFormData({
                name: initialData.name || "",
                email: initialData.email || "",
                phone: initialData.phone || "",
                aadhaar_number: initialData.aadhaar_number || "",
                pan_number: initialData.pan_number || "",
                role: initialData.role || "",
                status: initialData.status || "Active",
                operating_cities: parseOperatingCities(initialData.operating_cities || initialData.operating_city),
                operating_pincodes: initialData.operating_pincodes || [],
                tags: initialData.tags || [],
                assignedTo: initialData.assignedTo || "",
                assignedAgent: initialData.assignedAgent || "",
                latitude: initialData.latitude || "",
                longitude: initialData.longitude || "",
                full_address: initialData.full_address || "",
                gst_number: initialData.gst_number || "",
                shipping_address: initialData.shipping_address || "",
            });
        } else if (mode === "ADD") {
            setFormData({
                name: "",
                email: "",
                phone: "",
                aadhaar_number: "",
                pan_number: "",
                role: restrictedMode === "sales_agent_only" ? "Sales Agent" : (roles.length === 1 ? roles[0] : ""),
                status: "Active",
                operating_cities: restrictedMode === "sales_agent_only" ? managerCities : [],
                operating_pincodes: [],
                tags: [],
                assignedTo: restrictedMode === "sales_agent_only" && currentUserId ? String(currentUserId) : "",
                assignedAgent: "",
                latitude: "",
                longitude: "",
                full_address: "",
                gst_number: "",
                shipping_address: "",
            });
            setProfileImageFile(null);
            setAadhaarFile(null);
            setPanFile(null);
        }
    }, [initialData, mode, open, restrictedMode, currentUserCity, currentUserCities]);

    const formatAadhaar = (value: string) => {
        const cleaned = value.replace(/\D/g, "");
        const match = cleaned.match(/(\d{0,4})(\d{0,4})(\d{0,4})/);
        if (match) {
            return [match[1], match[2], match[3]].filter(Boolean).join(" ");
        }
        return cleaned;
    };

    const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 12);
        setFormData({ ...formData, aadhaar_number: cleaned });
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.name.trim()) {
            setError("Full name is required");
            return;
        }
        if (!formData.email.trim()) {
            setError("Email is required");
            return;
        }
        if (!formData.phone || formData.phone.length !== 10) {
            setError("Phone number must be exactly 10 digits");
            return;
        }
        if (!formData.role) {
            setError("Role is required");
            return;
        }

        // Role-specific validation
        if (["Sales Manager", "Sales Agent", "Distributor"].includes(formData.role)) {
            if (formData.operating_cities.length === 0) {
                setError("At least one operating city is required for this role");
                return;
            }
        }

        if (formData.role === "Sales Manager" && formData.operating_pincodes.length === 0) {
            setError("At least one operating pincode is required for Sales Manager");
            return;
        }

        if (formData.role === "Sales Agent" && !formData.assignedTo) {
            setError("Assigned manager is required for this role");
            return;
        }

        if (formData.role === "Distributor" && !formData.assignedAgent) {
            setError("Assigned agent is required for Distributor");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await onSubmit(formData, {
                profile: profileImageFile || undefined,
                aadhaar: aadhaarFile || undefined,
                pan: panFile || undefined,
            });

            // Reset form on success
            handleClose();
        } catch (err: any) {
            setError(err.message || "Failed to save user");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            name: "",
            email: "",
            phone: "",
            aadhaar_number: "",
            pan_number: "",
            role: restrictedMode === "sales_agent_only" ? "Sales Agent" : (roles.length === 1 ? roles[0] : ""),
            status: "Active",
            operating_cities: restrictedMode === "sales_agent_only" ? managerCities : [],
            operating_pincodes: [],
            tags: [],
            assignedTo: restrictedMode === "sales_agent_only" && currentUserId ? String(currentUserId) : "",
            assignedAgent: "",
            latitude: "",
            longitude: "",
            full_address: "",
            gst_number: "",
            shipping_address: "",
        });
        setProfileImageFile(null);
        setAadhaarFile(null);
        setPanFile(null);
        setError(null);
        onClose();
    };

    // For Sales Agent: show all managers (city will be derived from selected manager)
    // For Distributor: show all agents (city will be derived from selected agent)
    const filteredManagers = availableManagers;
    const filteredAgents = availableAgents;

    // Derive city options based on role + selection
    const selectedManager = formData.role === "Sales Agent" && formData.assignedTo
        ? availableManagers.find((m) => String(m.id) === formData.assignedTo)
        : null;
    const selectedAgent = formData.role === "Distributor" && formData.assignedAgent
        ? availableAgents.find((a) => String(a.id) === formData.assignedAgent)
        : null;

    const availableCityOptions =
        restrictedMode === "sales_agent_only"
            ? managerCities
            : formData.role === "Sales Agent"
                ? (selectedManager ? parseOperatingCities(selectedManager.operating_city) : [])
                : formData.role === "Distributor"
                    ? (selectedAgent ? parseOperatingCities(selectedAgent.operating_city) : [])
                    : companyCities;

    return (
        <>
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { p: 1, borderRadius: 1 } }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: 700,
                }}
            >
                {mode === "ADD" ? "Create New User" : "Edit User Details"}
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <Stack spacing={3} sx={{ mt: 1 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
                        {/* LEFT: Profile Image + Operating City */}
                        <Stack spacing={2} sx={{ width: { xs: "100%", md: 250 }, flexShrink: 0 }}>
                            <Box
                                component="label"
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "2px dashed",
                                    borderColor: alpha(theme.palette.divider, 0.2),
                                    borderRadius: 1,
                                    p: 3,
                                    height: 280,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    bgcolor: alpha(theme.palette.background.default, 0.5),
                                    "&:hover": {
                                        borderColor: theme.palette.primary.main,
                                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                                    },
                                }}
                            >
                                <input
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file && file.size > 1024 * 1024) {
                                            setError("Max file size 1MB");
                                            e.target.value = "";
                                        } else if (file) {
                                            setProfileImageFile(file);
                                        }
                                    }}
                                />
                                <Avatar
                                    src={
                                        profileImageFile
                                            ? URL.createObjectURL(profileImageFile)
                                            : initialData?.profile_image
                                    }
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        color: theme.palette.primary.main,
                                        mb: 2,
                                    }}
                                >
                                    {!profileImageFile && !initialData?.profile_image && (
                                        <AddIcon fontSize="large" />
                                    )}
                                </Avatar>
                                <Typography variant="body1" fontWeight={600} align="center">
                                    {profileImageFile
                                        ? "✓ Photo Selected"
                                        : initialData?.profile_image
                                            ? "✓ Photo Uploaded"
                                            : "Upload Profile Photo *"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" align="center">
                                    {profileImageFile
                                        ? profileImageFile.name
                                        : initialData?.profile_image
                                            ? "Current Photo"
                                            : "PNG, JPG max 1MB"}
                                </Typography>
                            </Box>

                            {/* Operating City Multi-select */}
                            <Autocomplete
                                multiple
                                options={availableCityOptions}
                                value={formData.operating_cities}
                                onChange={(_, newValue) =>
                                    setFormData({ ...formData, operating_cities: newValue })
                                }
                                disabled={
                                    !["Sales Manager", "Sales Agent", "Distributor"].includes(formData.role) ||
                                    (formData.role === "Sales Agent" && !formData.assignedTo) ||
                                    (formData.role === "Distributor" && !formData.assignedAgent)
                                }
                                disableCloseOnSelect
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip label={option} {...getTagProps({ index })} size="small" key={option} />
                                    ))
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Operating City"
                                        placeholder={
                                            formData.role === "Sales Agent" && !formData.assignedTo
                                                ? "Select a manager first..."
                                                : formData.role === "Distributor" && !formData.assignedAgent
                                                    ? "Select an agent first..."
                                                    : formData.operating_cities.length === 0
                                                        ? "Select cities..."
                                                        : ""
                                        }
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {params.InputProps.endAdornment}
                                                    {(currentUserRole === "admin" || currentUserRole === "sales_manager") && (
                                                        <Tooltip title="Add New City">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => { e.stopPropagation(); setAddCityOpen(true); }}
                                                                sx={{ color: theme.palette.primary.main, p: 0.5 }}
                                                            >
                                                                <AddCircleOutlineIcon sx={{ fontSize: 20 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                            />

                            <Autocomplete
                                multiple
                                options={availableTags}
                                value={formData.tags}
                                onChange={(e, newValue) => setFormData({ ...formData, tags: newValue })}
                                freeSolo
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip label={option} {...getTagProps({ index })} size="small" key={option} />
                                    ))
                                }
                                renderInput={(params) => (
                                    <TextField {...params} label="Tags" placeholder="Add tags..." />
                                )}
                            />
                        </Stack>

                        {/* RIGHT: Form Inputs */}
                        <Stack spacing={2} sx={{ flex: 1, width: "100%" }}>
                            <Stack direction="row" spacing={2} alignItems="flex-start">
                                <TextField
                                    label="Full Name *"
                                    fullWidth={
                                        !["Sales Manager", "Sales Agent", "Distributor"].includes(formData.role)
                                    }
                                    sx={{ flex: 1 }}
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value.slice(0, 50) })
                                    }
                                    autoComplete="off"
                                    inputProps={{ maxLength: 50 }}
                                    helperText={`${formData.name.length}/50 characters`}
                                />

                                {formData.role === "Sales Manager" && (
                                    <Box sx={{ flex: 1 }}>
                                        <Autocomplete
                                            multiple
                                            freeSolo
                                            options={[]}
                                            value={formData.operating_pincodes}
                                            onChange={(event, newValue) => {
                                                const rawValues = newValue as string[];
                                                const processedValues: string[] = [];

                                                for (const val of rawValues) {
                                                    const numeric = val.replace(/\D/g, "");
                                                    if (numeric && !processedValues.includes(numeric)) {
                                                        processedValues.push(numeric);
                                                    }
                                                }

                                                setFormData({
                                                    ...formData,
                                                    operating_pincodes: processedValues,
                                                });
                                            }}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip label={option} {...getTagProps({ index })} key={option} />
                                                ))
                                            }
                                            renderInput={(params) => (
                                                <TextField {...params} label="Operating Pincodes *" placeholder="Add pincodes" />
                                            )}
                                        />
                                    </Box>
                                )}

                                {formData.role === "Sales Agent" && (
                                    <Box sx={{ flex: 1 }}>
                                        <Stack direction="row" spacing={1} alignItems="flex-start">
                                            <Box sx={{ flex: 1 }}>
                                                {filteredManagers.length > 0 || formData.assignedTo ? (
                                                    <FormControl fullWidth>
                                                        <InputLabel>Assigned Sales Manager</InputLabel>
                                                        <Select
                                                            value={formData.assignedTo}
                                                            onChange={(e) => {
                                                                const managerId = e.target.value;
                                                                const manager = availableManagers.find((m) => String(m.id) === managerId);
                                                                const managerCities = manager ? parseOperatingCities(manager.operating_city) : [];
                                                                setFormData({
                                                                    ...formData,
                                                                    assignedTo: managerId,
                                                                    operating_cities: managerCities,
                                                                });
                                                            }}
                                                            input={<OutlinedInput label="Assigned Sales Manager" />}
                                                            disabled={restrictedMode === "sales_agent_only"}
                                                        >
                                                            {filteredManagers.map((manager) => (
                                                                <MenuItem key={manager.id} value={String(manager.id)}>
                                                                    {manager.name}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                ) : (
                                                    <TextField
                                                        fullWidth
                                                        label="Assigned Sales Manager"
                                                        value="No active Sales Managers available"
                                                        disabled
                                                        helperText="All Sales Managers are archived or inactive"
                                                        sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'text.disabled' } }}
                                                    />
                                                )}
                                            </Box>
                                        </Stack>
                                    </Box>
                                )}
                                {formData.role === "Distributor" && (
                                    <Box sx={{ flex: 1 }}>
                                        <Stack direction="row" spacing={1} alignItems="flex-start">
                                            <Box sx={{ flex: 1 }}>
                                                {filteredAgents.length > 0 || formData.assignedAgent ? (
                                                    <FormControl fullWidth>
                                                        <InputLabel>Assigned Sales Agent</InputLabel>
                                                        <Select
                                                            value={formData.assignedAgent}
                                                            onChange={(e) => {
                                                                const agentId = e.target.value;
                                                                const agent = availableAgents.find((a) => String(a.id) === agentId);
                                                                const agentCities = agent ? parseOperatingCities(agent.operating_city) : [];
                                                                setFormData({
                                                                    ...formData,
                                                                    assignedAgent: agentId,
                                                                    operating_cities: agentCities,
                                                                });
                                                            }}
                                                            input={<OutlinedInput label="Assigned Sales Agent" />}
                                                        >
                                                            {filteredAgents.map((agent) => (
                                                                <MenuItem key={agent.id} value={String(agent.id)}>
                                                                    {agent.name}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                ) : (
                                                    <TextField
                                                        fullWidth
                                                        label="Assigned Sales Agent"
                                                        value="No active Sales Agents available"
                                                        disabled
                                                        helperText="All Sales Agents are archived or inactive"
                                                        sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'text.disabled' } }}
                                                    />
                                                )}
                                            </Box>

                                        </Stack>
                                    </Box>
                                )}
                            </Stack>

                            {formData.role === "Distributor" && (
                                <Stack direction="row" spacing={2} alignItems="flex-start">
                                    <Box sx={{ flex: 1, position: 'relative' }}>
                                        <TextField
                                            label="Billing Address *"
                                            fullWidth
                                            multiline
                                            rows={2}
                                            value={formData.full_address}
                                            onChange={(e) => setFormData({ ...formData, full_address: e.target.value })}
                                            placeholder="Pick from map or enter manually..."
                                        />
                                        <Tooltip title="Pick Billing Address from Map">
                                            <IconButton
                                                size="small"
                                                color={formData.full_address ? "success" : "primary"}
                                                onClick={() => { setActiveAddressField('billing'); setMapOpen(true); }}
                                                sx={{ position: 'absolute', top: 8, right: 8 }}
                                            >
                                                <LocationOnIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Box sx={{ flex: 1, position: 'relative' }}>
                                        <TextField
                                            label="Shipping Address"
                                            fullWidth
                                            multiline
                                            rows={2}
                                            value={formData.shipping_address}
                                            onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                                            placeholder="If different from billing address..."
                                        />
                                        <Tooltip title="Pick Shipping Address from Map">
                                            <IconButton
                                                size="small"
                                                color={formData.shipping_address ? "success" : "primary"}
                                                onClick={() => { setActiveAddressField('shipping'); setMapOpen(true); }}
                                                sx={{ position: 'absolute', top: 8, right: 8 }}
                                            >
                                                <LocationOnIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Stack>
                            )}

                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="Email Address *"
                                    fullWidth
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    autoComplete="off"
                                />
                                <TextField
                                    label="Phone Number *"
                                    fullWidth
                                    value={formData.phone}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                        setFormData({ ...formData, phone: val });
                                    }}
                                    autoComplete="off"
                                    inputProps={{ maxLength: 10 }}
                                    helperText="Exact 10 digits required"
                                />
                            </Stack>

                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="Aadhaar Number"
                                    fullWidth
                                    value={formatAadhaar(formData.aadhaar_number)}
                                    onChange={handleAadhaarChange}
                                    placeholder="XXXX XXXX XXXX"
                                    inputProps={{ maxLength: 14 }}
                                    helperText="12 digit numeric"
                                />
                                <TextField
                                    label="PAN Card Number"
                                    fullWidth
                                    value={formData.pan_number}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            pan_number: e.target.value.toUpperCase().slice(0, 10),
                                        })
                                    }
                                    placeholder="ABCDE1234F"
                                    inputProps={{ maxLength: 10 }}
                                    helperText="Format: ABCDE1234F"
                                />
                                {formData.role === "Distributor" && (
                                    <TextField
                                        label="GST Number (GSTIN)"
                                        fullWidth
                                        value={formData.gst_number}
                                        onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase().slice(0, 15) })}
                                        placeholder="22AAAAA0000A1Z5"
                                        inputProps={{ maxLength: 15 }}
                                        helperText="15 character GSTIN"
                                    />
                                )}
                            </Stack>

                            <Stack direction="row" spacing={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Assign Role</InputLabel>
                                    <Select
                                        value={formData.role}
                                        onChange={(e) => {
                                            const newRole = e.target.value;
                                            const isSales = SALES_ROLES.includes(newRole);
                                            setFormData({
                                                ...formData,
                                                role: newRole,
                                                operating_cities: isSales
                                                    ? formData.operating_cities
                                                    : (defaultCity ? [defaultCity] : []),
                                                assignedTo: isSales ? formData.assignedTo : "",
                                                assignedAgent: isSales ? formData.assignedAgent : "",
                                            });
                                        }}
                                        input={<OutlinedInput label="Assign Role" />}
                                        disabled={restrictedMode === "sales_agent_only"}
                                    >
                                        {(restrictedMode === "sales_agent_only" ? ["Sales Agent"] : roles).map((role) => (
                                            <MenuItem key={role} value={role}>
                                                {role}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl fullWidth>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        input={<OutlinedInput label="Status" />}
                                    >
                                        <MenuItem value="Active">Active</MenuItem>
                                        <MenuItem value="Inactive">Inactive</MenuItem>
                                        <MenuItem value="Archived">Archived</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>
                        </Stack>
                    </Stack>

                    {/* BOTTOM: Documents */}
                    <Stack direction="row" spacing={2}>
                        <Box
                            component="label"
                            sx={{
                                flex: 1,
                                border: "2px dashed",
                                borderColor: (aadhaarFile || initialData?.aadhaar_card)
                                    ? theme.palette.success.main
                                    : alpha(theme.palette.divider, 0.2),
                                borderRadius: 2,
                                p: 2,
                                textAlign: "center",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                bgcolor: (aadhaarFile || initialData?.aadhaar_card) ? alpha(theme.palette.success.main, 0.05) : "transparent",
                                "&:hover": {
                                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                                    borderColor: theme.palette.primary.main,
                                },
                            }}
                        >
                            <input
                                type="file"
                                hidden
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) {
                                        if (f.size > 1024 * 1024) {
                                            setError("File size exceeds 1MB");
                                            e.target.value = "";
                                        } else {
                                            setAadhaarFile(f);
                                        }
                                    }
                                }}
                            />
                            <Typography variant="subtitle2" fontWeight={600}>
                                {aadhaarFile
                                    ? "✓ " + aadhaarFile.name
                                    : initialData?.aadhaar_card
                                        ? "✓ Aadhaar Uploaded"
                                        : "Upload Aadhaar Card *"}
                            </Typography>
                            {!aadhaarFile && !initialData?.aadhaar_card ? (
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Click to upload (max 1MB)
                                </Typography>
                            ) : !aadhaarFile && initialData?.aadhaar_card ? (
                                <Typography variant="caption" color="success.main" display="block">
                                    Click to replace
                                </Typography>
                            ) : null}
                        </Box>

                        <Box
                            component="label"
                            sx={{
                                flex: 1,
                                border: "2px dashed",
                                borderColor: (panFile || initialData?.pan_card) ? theme.palette.success.main : alpha(theme.palette.divider, 0.2),
                                borderRadius: 2,
                                p: 2,
                                textAlign: "center",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                bgcolor: (panFile || initialData?.pan_card) ? alpha(theme.palette.success.main, 0.05) : "transparent",
                                "&:hover": {
                                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                                    borderColor: theme.palette.primary.main,
                                },
                            }}
                        >
                            <input
                                type="file"
                                hidden
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) {
                                        if (f.size > 1024 * 1024) {
                                            setError("File size exceeds 1MB");
                                            e.target.value = "";
                                        } else {
                                            setPanFile(f);
                                        }
                                    }
                                }}
                            />
                            <Typography variant="subtitle2" fontWeight={600}>
                                {panFile
                                    ? "✓ " + panFile.name
                                    : initialData?.pan_card
                                        ? "✓ PAN Uploaded"
                                        : "Upload PAN Card *"}
                            </Typography>
                            {!panFile && !initialData?.pan_card ? (
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Click to upload (max 1MB)
                                </Typography>
                            ) : !panFile && initialData?.pan_card ? (
                                <Typography variant="caption" color="success.main" display="block">
                                    Click to replace
                                </Typography>
                            ) : null}
                        </Box>
                    </Stack>

                    {mode === "ADD" && (
                        <Alert severity="info" sx={{ alignItems: "center" }}>
                            <Typography variant="body2" fontWeight={500}>
                                Login credentials will be automatically shared via Email or SMS.
                            </Typography>
                        </Alert>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleClose} color="inherit">
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading}
                    sx={{
                        px: 4,
                        background: loading
                            ? theme.palette.action.disabledBackground
                            : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        position: "relative",
                    }}
                >
                    {loading ? (
                        <CircularProgress size={24} color="inherit" />
                    ) : mode === "ADD" ? (
                        "Create User"
                    ) : (
                        "Save Changes"
                    )}
                </Button>
            </DialogActions>
        </Dialog>

        {/* Add City Dialog */}
        <Dialog
            open={addCityOpen}
            onClose={() => { setAddCityOpen(false); setNewCityName(""); }}
            maxWidth="xs"
            fullWidth
            PaperProps={{ sx: { borderRadius: 2 } }}
        >
            <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
                Add New Operating City
                <IconButton
                    onClick={() => { setAddCityOpen(false); setNewCityName(""); }}
                    size="small"
                    sx={{ position: "absolute", right: 12, top: 12 }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <TextField
                    fullWidth
                    label="City Name"
                    placeholder="Enter city name..."
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCity(); } }}
                    autoFocus
                    sx={{ mt: 1 }}
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button color="inherit" onClick={() => { setAddCityOpen(false); setNewCityName(""); }}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleAddCity}
                    disabled={addingCity || !newCityName.trim()}
                    sx={{
                        px: 3,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    }}
                >
                    {addingCity ? <CircularProgress size={20} color="inherit" /> : "Add City"}
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
}

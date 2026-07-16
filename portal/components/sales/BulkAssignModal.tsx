"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    Typography,
    IconButton,
    Box,
    alpha,
    useTheme,
    Alert,
    CircularProgress,
    Stack,
    Chip,
    ToggleButton,
    ToggleButtonGroup,
    MenuItem,
    InputAdornment,
    Avatar,
    Autocomplete,
    Checkbox,
    FormControlLabel,
} from "@mui/material";
import { CloseIcon, TrendingUpIcon, EventAvailableIcon, ShoppingBagIcon, MonetizationOnIcon, PersonAddIcon, AccessTimeIcon, InventoryIcon, GroupsIcon, PersonIcon, SelectAllIcon, ExpandMoreIcon, ChevronRightIcon, WarningAmberIcon } from "@/components/icons";
import { apiClient } from "@/lib/api-client";
import { UserProfile } from "@/lib/auth-service";

interface Agent {
    id: number;
    full_name: string;
    username: string;
    assigned_to?: number | null;
    operating_city?: string;
}

interface Manager {
    id: number;
    full_name: string;
    username: string;
    operating_pincodes?: string[];
    operating_city?: string;
}

interface CityTargetForm {
    city: string;
    visit_target: number;
    order_target: number;
    stock_request_target: number;
    revenue_target: number;
    stock_request_revenue_target: number;
    new_client_target: number;
    login_hours_target: number;
}

const EMPTY_CITY_TARGET: Omit<CityTargetForm, "city"> = {
    visit_target: 0,
    order_target: 0,
    stock_request_target: 0,
    revenue_target: 0,
    stock_request_revenue_target: 0,
    new_client_target: 0,
    login_hours_target: 0,
};

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

interface BulkAssignModalProps {
    open: boolean;
    onClose: () => void;
    preSelectedAgentIds: number[];
    month: number;
    year: number;
    currentUser: UserProfile | null;
    onSuccess: () => void;
}

export default function BulkAssignModal({
    open,
    onClose,
    preSelectedAgentIds,
    month,
    year,
    currentUser,
    onSuccess,
}: BulkAssignModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const isAdmin = currentUser?.role === "admin" || currentUser?.role === "it_admin";
    const isManager = currentUser?.role === "sales_manager";

    // Scope
    const [scope, setScope] = useState<"all" | "manager" | "selected">(
        preSelectedAgentIds.length > 0 ? "selected" : "all"
    );
    const [selectedManagerId, setSelectedManagerId] = useState<number | "">("");
    const [managers, setManagers] = useState<Manager[]>([]);
    const [allAgents, setAllAgents] = useState<Agent[]>([]);
    const [resolvedAgents, setResolvedAgents] = useState<Agent[]>([]);
    const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>(preSelectedAgentIds);

    // Collapse/expand manager groups
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Pincodes (kept for backward compat)
    const [availablePincodes, setAvailablePincodes] = useState<string[]>([]);
    const [selectedPincodes, setSelectedPincodes] = useState<string[]>([]);
    const [pincodeDisabledReason, setPincodeDisabledReason] = useState("");

    // City Targets
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [cityTargets, setCityTargets] = useState<CityTargetForm[]>([]);
    const [cityDisabledReason, setCityDisabledReason] = useState("");

    // Warning dialog for agents who already have city targets
    const [warningOpen, setWarningOpen] = useState(false);
    const [affectedAgents, setAffectedAgents] = useState<string[]>([]);
    const [agentsWithCityTargets, setAgentsWithCityTargets] = useState<Map<number, string>>(new Map());

    // Target form
    const [formData, setFormData] = useState({
        visit_target: 0,
        order_target: 0,
        stock_request_target: 0,
        revenue_target: 0,
        stock_request_revenue_target: 0,
        new_client_target: 0,
        login_hours_target: 0,
    });

    // Fetch managers & agents on open
    useEffect(() => {
        if (!open) return;
        const fetchData = async () => {
            setFetching(true);
            try {
                if (isAdmin) {
                    const mgrRes: any = await apiClient.get("/auth/users/", { role: "sales_manager" });
                    setManagers(mgrRes.results || mgrRes || []);
                }

                let agentParams: any = { role: "sales_agent" };
                if (isManager) {
                    agentParams.assigned_to = String(currentUser!.id);
                }
                const agentRes: any = await apiClient.get("/auth/users/", agentParams);
                setAllAgents(agentRes.results || agentRes || []);
            } catch (e) {
                console.error("Failed to fetch data", e);
            } finally {
                setFetching(false);
            }
        };
        fetchData();
    }, [open, isAdmin, isManager, currentUser]);

    // Sync preSelectedAgentIds when modal opens
    useEffect(() => {
        if (open) {
            setSelectedAgentIds([]);
            setScope("all");
            setError(null);
            setSuccess(false);
            setSelectedPincodes([]);
            setCityTargets([]);
            setAvailableCities([]);
            setCityDisabledReason("");
            setExpandedGroups(new Set());
            setFormData({
                visit_target: 0, order_target: 0, stock_request_target: 0,
                revenue_target: 0, stock_request_revenue_target: 0,
                new_client_target: 0, login_hours_target: 0,
            });
        }
    }, [open]);

    // Auto-expand all groups when agents load
    useEffect(() => {
        if (allAgents.length > 0 && managers.length > 0) {
            const keys = new Set<string>();
            managers.forEach(m => keys.add(String(m.id)));
            keys.add("unassigned");
            if (isManager && currentUser) keys.add(String(currentUser.id));
            setExpandedGroups(keys);
        }
    }, [allAgents, managers, isManager, currentUser]);

    // Resolve agents based on scope
    useEffect(() => {
        if (scope === "all") {
            setResolvedAgents(allAgents);
        } else if (scope === "manager" && selectedManagerId) {
            const filtered = allAgents.filter(a => a.assigned_to === selectedManagerId);
            setResolvedAgents(filtered);
        } else if (scope === "selected") {
            const filtered = allAgents.filter(a => selectedAgentIds.includes(a.id));
            setResolvedAgents(filtered);
        } else {
            setResolvedAgents([]);
        }
    }, [scope, selectedManagerId, selectedAgentIds, allAgents]);

    // Pre-fetch which resolved agents already have city targets
    useEffect(() => {
        if (resolvedAgents.length === 0) {
            setAgentsWithCityTargets(new Map());
            return;
        }
        let cancelled = false;
        const fetchCityInfo = async () => {
            const result = new Map<number, string>();
            await Promise.all(
                resolvedAgents.map(async (agent) => {
                    try {
                        const res: any = await apiClient.get("/t/field/targets/performance/", {
                            agent: String(agent.id),
                            month: String(month),
                            year: String(year),
                        });
                        if (res?.target_type === "agent_specific" && res?.targets?.city_targets?.length > 0) {
                            result.set(agent.id, agent.full_name || agent.username);
                        }
                    } catch { /* no target */ }
                })
            );
            if (!cancelled) setAgentsWithCityTargets(result);
        };
        fetchCityInfo();
        return () => { cancelled = true; };
    }, [resolvedAgents, month, year]);

    // Resolve pincodes based on resolved agents
    useEffect(() => {
        if (scope === "all") {
            setAvailablePincodes([]);
            setPincodeDisabledReason("Pincodes are only applicable for manager's team or individual agents.");
            setSelectedPincodes([]);
            return;
        }

        // If agents haven't loaded yet, don't show pincode errors
        if (resolvedAgents.length === 0 && selectedAgentIds.length > 0) {
            setAvailablePincodes([]);
            setPincodeDisabledReason("");
            return;
        }

        // Collect distinct managers from resolved agents
        const managerIds = new Set<number>();

        for (const agent of resolvedAgents) {
            if (agent.assigned_to) {
                managerIds.add(agent.assigned_to);
            }
        }

        if (managerIds.size === 0 && resolvedAgents.length > 0) {
            setAvailablePincodes([]);
            setPincodeDisabledReason("Selected agents have no assigned manager.");
            setSelectedPincodes([]);
            return;
        }

        if (managerIds.size > 1) {
            setAvailablePincodes([]);
            setPincodeDisabledReason("Agents belong to different managers. Select agents from the same manager to assign pincodes.");
            setSelectedPincodes([]);
            return;
        }

        // Single manager — get their pincodes
        const mgrId = Array.from(managerIds)[0];

        // If scope is "manager", we already know the manager
        if (scope === "manager") {
            const mgr = managers.find(m => m.id === selectedManagerId);
            if (mgr?.operating_pincodes?.length) {
                setAvailablePincodes(mgr.operating_pincodes.map(String));
                setPincodeDisabledReason("");
            } else {
                setAvailablePincodes([]);
                setPincodeDisabledReason("Selected manager has no operating pincodes.");
            }
            return;
        }

        // For "selected" scope — fetch the manager's pincodes
        const mgr = managers.find(m => m.id === mgrId);
        if (mgr) {
            if (mgr.operating_pincodes?.length) {
                setAvailablePincodes(mgr.operating_pincodes.map(String));
                setPincodeDisabledReason("");
            } else {
                setAvailablePincodes([]);
                setPincodeDisabledReason("Manager has no operating pincodes.");
            }
        } else if (isManager && currentUser) {
            // Sales manager selecting their own agents
            const pincodes = (currentUser as any).operating_pincodes || [];
            if (pincodes.length) {
                setAvailablePincodes(pincodes.map(String));
                setPincodeDisabledReason("");
            } else {
                setAvailablePincodes([]);
                setPincodeDisabledReason("No operating pincodes found.");
            }
        } else {
            // Need to fetch manager info
            apiClient.get(`/auth/users/${mgrId}/`).then((res: any) => {
                const pincodes = res.operating_pincodes || [];
                setAvailablePincodes(pincodes.map(String));
                setPincodeDisabledReason(pincodes.length ? "" : "Manager has no operating pincodes.");
            }).catch(() => {
                setAvailablePincodes([]);
                setPincodeDisabledReason("Failed to fetch manager pincodes.");
            });
        }
    }, [scope, resolvedAgents, selectedManagerId, managers, isManager, currentUser]);

    // Resolve available cities from the selected agent's own operating_city
    useEffect(() => {
        // Only show city targets for individual agent selection (scope = "selected") with exactly 1 agent
        if (scope !== "selected" || selectedAgentIds.length !== 1) {
            setAvailableCities([]);
            setCityTargets([]);
            setCityDisabledReason(
                scope === "selected" && selectedAgentIds.length > 1
                    ? "City-wise targets are only available when selecting a single agent."
                    : ""
            );
            return;
        }

        const agent = allAgents.find(a => a.id === selectedAgentIds[0]);
        if (!agent) {
            setAvailableCities([]);
            setCityDisabledReason("");
            return;
        }

        // Use the agent's own operating_city
        const cities = parseOperatingCities(agent.operating_city);
        if (cities.length) {
            setAvailableCities(cities);
            setCityDisabledReason("");
        } else {
            setAvailableCities([]);
            setCityDisabledReason("This agent has no operating cities assigned.");
        }
    }, [scope, selectedAgentIds, allAgents]);

    // Pre-fill existing target when a single agent is selected
    useEffect(() => {
        if (scope !== "selected" || selectedAgentIds.length !== 1) return;

        const agentId = selectedAgentIds[0];
        apiClient.get("/t/field/targets/performance/", {
            agent: String(agentId),
            month: String(month),
            year: String(year),
        }).then((res: any) => {
            if (res?.target_type === "agent_specific" && res?.targets) {
                const t = res.targets;
                setFormData({
                    visit_target: Math.round(Number(t.visit_target) || 0),
                    order_target: Math.round(Number(t.order_target) || 0),
                    stock_request_target: Math.round(Number(t.stock_request_target) || 0),
                    revenue_target: Math.round(Number(t.revenue_target) || 0),
                    stock_request_revenue_target: Math.round(Number(t.stock_request_revenue_target) || 0),
                    new_client_target: Math.round(Number(t.new_client_target) || 0),
                    login_hours_target: Math.round(Number(t.login_hours_target) || 0),
                });
                // Pre-fill city targets if they exist
                if (t.city_targets?.length) {
                    setCityTargets(t.city_targets.map((ct: any) => ({
                        city: ct.city,
                        visit_target: Math.round(Number(ct.visit_target) || 0),
                        order_target: Math.round(Number(ct.order_target) || 0),
                        stock_request_target: Math.round(Number(ct.stock_request_target) || 0),
                        revenue_target: Math.round(Number(ct.revenue_target) || 0),
                        stock_request_revenue_target: Math.round(Number(ct.stock_request_revenue_target) || 0),
                        new_client_target: Math.round(Number(ct.new_client_target) || 0),
                        login_hours_target: Math.round(Number(ct.login_hours_target) || 0),
                    })));
                }
            }
        }).catch(() => {
            // No existing target — keep defaults (zeros)
        });
    }, [scope, selectedAgentIds, month, year]);

    const handleSave = async () => {
        const agentIds = resolvedAgents.map(a => a.id);
        if (agentIds.length === 0) {
            setError("No agents selected.");
            return;
        }

        // If assigning flat targets (no city targets), check if any agents have existing city targets
        if (cityTargets.length === 0 && agentsWithCityTargets.size > 0) {
            const affected = Array.from(agentsWithCityTargets.values());
            setAffectedAgents(affected);
            setWarningOpen(true);
            return;
        }

        await executeSave();
    };

    const executeSave = async () => {
        const agentIds = resolvedAgents.map(a => a.id);

        try {
            setLoading(true);
            setError(null);

            // When city targets exist, auto-sum as the overall target + use standalone login hours
            const finalFormData = cityTargets.length > 0
                ? {
                    visit_target: cityTargets.reduce((s, ct) => s + (ct.visit_target || 0), 0),
                    order_target: cityTargets.reduce((s, ct) => s + (ct.order_target || 0), 0),
                    stock_request_target: cityTargets.reduce((s, ct) => s + (ct.stock_request_target || 0), 0),
                    revenue_target: cityTargets.reduce((s, ct) => s + (ct.revenue_target || 0), 0),
                    stock_request_revenue_target: cityTargets.reduce((s, ct) => s + (ct.stock_request_revenue_target || 0), 0),
                    new_client_target: cityTargets.reduce((s, ct) => s + (ct.new_client_target || 0), 0),
                    login_hours_target: formData.login_hours_target || 0,
                }
                : formData;

            await apiClient.post("/t/field/targets/bulk-assign/", {
                agent_ids: agentIds,
                month,
                year,
                ...finalFormData,
                pincodes: selectedPincodes,
                city_targets: cityTargets.length > 0 ? cityTargets : [],
            });

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onSuccess();
                onClose();
            }, 1200);
        } catch (err: any) {
            const detail = err?.response?.data || err?.message || "Failed to assign targets";
            setError(typeof detail === "string" ? detail : JSON.stringify(detail));
        } finally {
            setLoading(false);
        }
    };

    const toggleAgentSelection = (id: number) => {
        setSelectedAgentIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Row 1: 4 fields, Row 2: 3 fields
    const targetFieldsRow1 = [
        { key: "visit_target", label: "Visits", icon: <EventAvailableIcon fontSize="small" />, color: "primary", max: 999 },
        { key: "stock_request_target", label: "Primary Orders", icon: <InventoryIcon fontSize="small" />, color: "info", max: 999 },
        { key: "order_target", label: "Secondary Orders", icon: <ShoppingBagIcon fontSize="small" />, color: "success", max: 999 },
        { key: "stock_request_revenue_target", label: "Primary Revenue", icon: <MonetizationOnIcon fontSize="small" />, color: "error", prefix: "₹", max: 9999999 },
    ];
    const targetFieldsRow2 = [
        { key: "revenue_target", label: "Secondary Revenue", icon: <MonetizationOnIcon fontSize="small" />, color: "warning", prefix: "₹", max: 9999999 },
        { key: "new_client_target", label: "New Clients", icon: <PersonAddIcon fontSize="small" />, color: "secondary", max: 999 },
        { key: "login_hours_target", label: "Login Hours", icon: <AccessTimeIcon fontSize="small" />, color: "primary", max: 999 },
    ];

    const handleTargetChange = (key: string, value: string, max: number) => {
        const intVal = parseInt(value, 10);
        if (value === "" || value === "0") {
            setFormData({ ...formData, [key]: 0 });
            return;
        }
        if (isNaN(intVal) || intVal < 0) return;
        if (intVal > max) return;
        setFormData({ ...formData, [key]: intVal });
    };

    const allTargetFields = [...targetFieldsRow1, ...targetFieldsRow2];

    return (
        <>
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
                    maxHeight: "92vh",
                    minHeight: "70vh",
                },
            }}
        >
            <DialogTitle
                sx={{
                    p: 3,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main" }}>
                        <TrendingUpIcon />
                    </Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight={800}>
                            Set Targets
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {MONTHS[month - 1]} {year} — {resolvedAgents.length} agent{resolvedAgents.length !== 1 ? "s" : ""}
                        </Typography>
                    </Box>
                </Stack>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3, pt: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>Targets assigned successfully!</Alert>}


                {/* SCOPE SELECTOR */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>
                        Apply To
                    </Typography>
                    <ToggleButtonGroup
                        value={scope}
                        exclusive
                        onChange={(_, val) => { if (val) setScope(val); }}
                        sx={{
                            "& .MuiToggleButton-root": {
                                borderRadius: "10px !important",
                                border: `1.5px solid ${alpha(theme.palette.divider, 0.15)} !important`,
                                px: 2.5, py: 1,
                                fontWeight: 800,
                                fontSize: "0.8rem",
                                textTransform: "none",
                                mr: 1,
                                "&.Mui-selected": {
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    color: "primary.main",
                                    borderColor: `${alpha(theme.palette.primary.main, 0.4)} !important`,
                                },
                            },
                        }}
                    >
                        <ToggleButton value="all">
                            <SelectAllIcon sx={{ mr: 1, fontSize: 18 }} />
                            {isManager ? "All My Agents" : "All Agents"}
                        </ToggleButton>
                        {isAdmin && (
                            <ToggleButton value="manager">
                                <GroupsIcon sx={{ mr: 1, fontSize: 18 }} />
                                By Manager
                            </ToggleButton>
                        )}
                        <ToggleButton value="selected">
                            <PersonIcon sx={{ mr: 1, fontSize: 18 }} />
                            Select Agents
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {/* MANAGER DROPDOWN */}
                {scope === "manager" && isAdmin && (
                    <Box sx={{ mb: 3 }}>
                        <TextField
                            select
                            fullWidth
                            label="Select Manager"
                            value={selectedManagerId}
                            onChange={(e) => setSelectedManagerId(Number(e.target.value))}
                            size="small"
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        >
                            {managers.map(m => (
                                <MenuItem key={m.id} value={m.id}>{m.full_name || m.username}</MenuItem>
                            ))}
                        </TextField>
                    </Box>
                )}

                {/* AGENT SELECTION — tree grouped by manager */}
                {scope === "selected" && (() => {
                    // Group agents by manager
                    const grouped = new Map<number | null, Agent[]>();
                    for (const agent of allAgents) {
                        const mgrId = agent.assigned_to ?? null;
                        if (!grouped.has(mgrId)) grouped.set(mgrId, []);
                        grouped.get(mgrId)!.push(agent);
                    }

                    // Build ordered groups: known managers first, then unassigned
                    const managerGroups: { mgrId: number | null; mgrName: string; agents: Agent[] }[] = [];
                    if (isAdmin) {
                        for (const mgr of managers) {
                            const agents = grouped.get(mgr.id);
                            if (agents?.length) {
                                managerGroups.push({ mgrId: mgr.id, mgrName: mgr.full_name || mgr.username, agents });
                            }
                        }
                    } else if (isManager && currentUser) {
                        // Sales manager sees only their agents
                        const agents = allAgents;
                        if (agents.length) {
                            managerGroups.push({ mgrId: currentUser.id, mgrName: currentUser.full_name || "My Team", agents });
                        }
                    }
                    // Unassigned agents
                    const unassigned = grouped.get(null);
                    if (unassigned?.length) {
                        managerGroups.push({ mgrId: null, mgrName: "Unassigned", agents: unassigned });
                    }

                    return (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>
                                Select Agents
                            </Typography>
                            <Box sx={{
                                maxHeight: 340,
                                overflowY: "auto",
                                border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                                borderRadius: 2,
                                p: 1.5,
                            }}>
                                {/* Select All */}
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={selectedAgentIds.length === allAgents.length && allAgents.length > 0}
                                            indeterminate={selectedAgentIds.length > 0 && selectedAgentIds.length < allAgents.length}
                                            onChange={(e) => {
                                                setSelectedAgentIds(e.target.checked ? allAgents.map(a => a.id) : []);
                                            }}
                                            size="small"
                                        />
                                    }
                                    label={<Typography variant="body2" fontWeight={800}>Select All ({allAgents.length})</Typography>}
                                    sx={{ mb: 0.5, display: "flex" }}
                                />

                                {managerGroups.map(group => {
                                    const groupKey = String(group.mgrId ?? "unassigned");
                                    const isExpanded = expandedGroups.has(groupKey);
                                    const groupAgentIds = group.agents.map(a => a.id);
                                    const allGroupSelected = groupAgentIds.every(id => selectedAgentIds.includes(id));
                                    const someGroupSelected = groupAgentIds.some(id => selectedAgentIds.includes(id));
                                    const selectedInGroup = groupAgentIds.filter(id => selectedAgentIds.includes(id)).length;

                                    return (
                                        <Box key={groupKey} sx={{ mt: 0.5 }}>
                                            {/* Manager header row */}
                                            <Stack direction="row" alignItems="center" sx={{
                                                py: 0.5, px: 0.5, borderRadius: 1.5,
                                                bgcolor: alpha(theme.palette.primary.main, 0.03),
                                                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                                                transition: "background 0.15s",
                                            }}>
                                                <IconButton size="small" onClick={() => toggleGroup(groupKey)}
                                                    sx={{ mr: 0.5, p: 0.3 }}>
                                                    {isExpanded
                                                        ? <ExpandMoreIcon sx={{ fontSize: 18 }} />
                                                        : <ChevronRightIcon sx={{ fontSize: 18 }} />
                                                    }
                                                </IconButton>
                                                <Checkbox
                                                    checked={allGroupSelected}
                                                    indeterminate={someGroupSelected && !allGroupSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedAgentIds(prev => [...new Set([...prev, ...groupAgentIds])]);
                                                        } else {
                                                            setSelectedAgentIds(prev => prev.filter(id => !groupAgentIds.includes(id)));
                                                        }
                                                    }}
                                                    size="small"
                                                    sx={{ p: 0.5 }}
                                                />
                                                <Stack direction="row" spacing={0.8} alignItems="center" sx={{ ml: 0.5, cursor: "pointer", flex: 1 }}
                                                    onClick={() => toggleGroup(groupKey)}>
                                                    <GroupsIcon sx={{ fontSize: 16, color: "primary.main" }} />
                                                    <Typography variant="body2" fontWeight={800} color="text.primary">
                                                        {group.mgrName}
                                                    </Typography>
                                                    <Chip
                                                        label={`${selectedInGroup}/${group.agents.length}`}
                                                        size="small"
                                                        color={allGroupSelected ? "primary" : "default"}
                                                        variant={allGroupSelected ? "filled" : "outlined"}
                                                        sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700 }}
                                                    />
                                                </Stack>
                                            </Stack>

                                            {/* Collapsible agent list */}
                                            {isExpanded && (
                                                <Box sx={{ pl: 5, pt: 0.5 }}>
                                                    {group.agents.map(agent => (
                                                        <FormControlLabel
                                                            key={agent.id}
                                                            control={
                                                                <Checkbox
                                                                    checked={selectedAgentIds.includes(agent.id)}
                                                                    onChange={() => toggleAgentSelection(agent.id)}
                                                                    size="small"
                                                                    sx={{ p: 0.4 }}
                                                                />
                                                            }
                                                            label={
                                                                <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.85rem" }}>
                                                                    {agent.full_name || agent.username}
                                                                </Typography>
                                                            }
                                                            sx={{ display: "flex", my: 0 }}
                                                        />
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    );
                })()}

                {/* RESOLVED AGENTS CHIPS */}
                {resolvedAgents.length > 0 && scope !== "selected" && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>
                            {resolvedAgents.length} Agent{resolvedAgents.length !== 1 ? "s" : ""} Selected
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                            {resolvedAgents.slice(0, 20).map(a => (
                                <Chip key={a.id} label={a.full_name || a.username} size="small"
                                    sx={{ fontWeight: 700, borderRadius: "8px" }} />
                            ))}
                            {resolvedAgents.length > 20 && (
                                <Chip label={`+${resolvedAgents.length - 20} more`} size="small" color="primary"
                                    sx={{ fontWeight: 700, borderRadius: "8px" }} />
                            )}
                        </Box>
                    </Box>
                )}
                {/* TERRITORY CITIES (Optional) — only for individual agent selection */}
                {scope === "selected" && selectedAgentIds.length === 1 && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>
                            Territory Cities (Optional)
                        </Typography>
                        {cityDisabledReason ? (
                            <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.8rem" }}>
                                {cityDisabledReason}
                            </Alert>
                        ) : availableCities.length > 0 ? (
                            <>
                                {/* City selection chips */}
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                                    {availableCities.map(city => {
                                        const isSelected = cityTargets.some(ct => ct.city === city);
                                        return (
                                            <Chip
                                                key={city}
                                                label={city}
                                                clickable
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setCityTargets(prev => prev.filter(ct => ct.city !== city));
                                                    } else {
                                                        setCityTargets(prev => [...prev, { city, ...EMPTY_CITY_TARGET }]);
                                                    }
                                                }}
                                                color={isSelected ? "primary" : "default"}
                                                variant={isSelected ? "filled" : "outlined"}
                                                sx={{ fontWeight: 700, borderRadius: "8px" }}
                                            />
                                        );
                                    })}
                                </Box>

                                {/* Per-city target inputs */}
                                {cityTargets.length > 0 && (
                                    <Box sx={{
                                        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                                        borderRadius: 2,
                                        p: 2,
                                        bgcolor: alpha(theme.palette.primary.main, 0.01),
                                    }}>
                                        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontSize: "0.65rem", display: "block", mb: 2 }}>
                                            Per-City Target Values
                                        </Typography>
                                        {cityTargets.map((ct, ctIdx) => (
                                            <Box key={ct.city} sx={{ mb: ctIdx < cityTargets.length - 1 ? 2.5 : 0 }}>
                                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                                    <Chip label={ct.city} color="primary" size="small" sx={{ fontWeight: 800, borderRadius: "8px" }} />
                                                </Stack>
                                                {/* Row 1: 4 fields (same) */}
                                                <Grid container spacing={1.5} sx={{ mb: 1 }}>
                                                    {targetFieldsRow1.map((field) => (
                                                        <Grid size={{ xs: 6, sm: 3 }} key={field.key}>
                                                            <TextField
                                                                fullWidth
                                                                label={field.label}
                                                                size="small"
                                                                value={(ct as any)[field.key] || ""}
                                                                onChange={(e) => {
                                                                    const intVal = parseInt(e.target.value, 10);
                                                                    const val = e.target.value === "" || e.target.value === "0" ? 0 : (isNaN(intVal) || intVal < 0 || intVal > field.max) ? (ct as any)[field.key] : intVal;
                                                                    setCityTargets(prev => prev.map((c, i) => i === ctIdx ? { ...c, [field.key]: val } : c));
                                                                }}
                                                                slotProps={{
                                                                    input: {
                                                                        startAdornment: (
                                                                            <InputAdornment position="start">
                                                                                <Box sx={{ color: `${field.color}.main`, display: "flex" }}>
                                                                                    {field.icon}
                                                                                </Box>
                                                                            </InputAdornment>
                                                                        ),
                                                                        sx: { borderRadius: 1.5, fontWeight: 700, fontSize: "0.85rem" },
                                                                        inputProps: { inputMode: "numeric", pattern: "[0-9]*" },
                                                                    }
                                                                }}
                                                            />
                                                        </Grid>
                                                    ))}
                                                </Grid>
                                                {/* Row 2: exclude Login Hours (overall only) */}
                                                <Grid container spacing={1.5}>
                                                    {targetFieldsRow2.filter(f => f.key !== "login_hours_target").map((field) => (
                                                        <Grid size={{ xs: 6, sm: 6 }} key={field.key}>
                                                            <TextField
                                                                fullWidth
                                                                label={field.label}
                                                                size="small"
                                                                value={(ct as any)[field.key] || ""}
                                                                onChange={(e) => {
                                                                    const intVal = parseInt(e.target.value, 10);
                                                                    const val = e.target.value === "" || e.target.value === "0" ? 0 : (isNaN(intVal) || intVal < 0 || intVal > field.max) ? (ct as any)[field.key] : intVal;
                                                                    setCityTargets(prev => prev.map((c, i) => i === ctIdx ? { ...c, [field.key]: val } : c));
                                                                }}
                                                                slotProps={{
                                                                    input: {
                                                                        startAdornment: (
                                                                            <InputAdornment position="start">
                                                                                <Box sx={{ color: `${field.color}.main`, display: "flex" }}>
                                                                                    {field.icon}
                                                                                </Box>
                                                                            </InputAdornment>
                                                                        ),
                                                                        sx: { borderRadius: 1.5, fontWeight: 700, fontSize: "0.85rem" },
                                                                        inputProps: { inputMode: "numeric", pattern: "[0-9]*" },
                                                                    }
                                                                }}
                                                            />
                                                        </Grid>
                                                    ))}
                                                </Grid>
                                                {ctIdx < cityTargets.length - 1 && (
                                                    <Box sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, mt: 2.5 }} />
                                                )}
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </>
                        ) : null}
                    </Box>
                )}
                {scope === "selected" && selectedAgentIds.length > 1 && cityDisabledReason && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>
                            Territory Cities (Optional)
                        </Typography>
                        <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.8rem" }}>
                            {cityDisabledReason}
                        </Alert>
                    </Box>
                )}

                {/* Login Hours — shown separately when city targets are active (not city-specific) */}
                {cityTargets.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>
                            Overall Login Hours Target
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <TextField
                                    fullWidth
                                    label="Login Hours"
                                    size="small"
                                    value={formData.login_hours_target || ""}
                                    onChange={(e) => handleTargetChange("login_hours_target", e.target.value, 999)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Box sx={{ color: "primary.main", display: "flex" }}>
                                                        <AccessTimeIcon fontSize="small" />
                                                    </Box>
                                                </InputAdornment>
                                            ),
                                            sx: { borderRadius: 2, fontWeight: 700 },
                                            inputProps: { inputMode: "numeric", pattern: "[0-9]*" },
                                        }
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {/* TARGET FIELDS — hidden when per-city targets are active */}
                {cityTargets.length === 0 && <Box>
                    <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>
                        Target Values
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        {targetFieldsRow1.map((field) => (
                            <Grid size={{ xs: 6, sm: 3 }} key={field.key}>
                                <TextField
                                    fullWidth
                                    label={field.label}
                                    size="small"
                                    value={(formData as any)[field.key] || ""}
                                    onChange={(e) => handleTargetChange(field.key, e.target.value, field.max)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Box sx={{ color: `${field.color}.main`, display: "flex" }}>
                                                        {field.icon}
                                                    </Box>
                                                </InputAdornment>
                                            ),
                                            sx: { borderRadius: 2, fontWeight: 700 },
                                            inputProps: { inputMode: "numeric", pattern: "[0-9]*" },
                                        }
                                    }}
                                />
                            </Grid>
                        ))}
                    </Grid>
                    <Grid container spacing={2}>
                        {targetFieldsRow2.map((field) => (
                            <Grid size={{ xs: 6, sm: 4 }} key={field.key}>
                                <TextField
                                    fullWidth
                                    label={field.label}
                                    size="small"
                                    value={(formData as any)[field.key] || ""}
                                    onChange={(e) => handleTargetChange(field.key, e.target.value, field.max)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Box sx={{ color: `${field.color}.main`, display: "flex" }}>
                                                        {field.icon}
                                                    </Box>
                                                </InputAdornment>
                                            ),
                                            sx: { borderRadius: 2, fontWeight: 700 },
                                            inputProps: { inputMode: "numeric", pattern: "[0-9]*" },
                                        }
                                    }}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Box>}
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Button onClick={onClose} sx={{ fontWeight: 700 }}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={loading || fetching || resolvedAgents.length === 0}
                    sx={{
                        px: 4,
                        borderRadius: 2,
                        fontWeight: 800,
                        textTransform: "none",
                        boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
                    }}
                >
                    {loading ? (
                        <CircularProgress size={24} color="inherit" />
                    ) : (
                        `Assign to ${resolvedAgents.length} Agent${resolvedAgents.length !== 1 ? "s" : ""}`
                    )}
                </Button>
            </DialogActions>
        </Dialog>

        {/* Warning dialog for city target overwrite */}
        <Dialog
            open={warningOpen}
            onClose={() => setWarningOpen(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 3 } }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: "warning.main" }}>
                        <WarningAmberIcon />
                    </Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight={800}>City Targets Will Be Removed</Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {affectedAgents.length} agent{affectedAgents.length !== 1 ? "s have" : " has"} city-specific targets
                        </Typography>
                    </Box>
                </Stack>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    The following agents already have <strong>city-wise targets</strong> assigned. Setting a flat overall target will <strong>remove their city breakdown</strong>.
                </Typography>
                <Box sx={{
                    display: "flex", flexWrap: "wrap", gap: 0.8,
                    p: 1.5, borderRadius: 2,
                    bgcolor: alpha(theme.palette.warning.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                }}>
                    {affectedAgents.map(name => (
                        <Chip
                            key={name}
                            label={name}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ fontWeight: 700, borderRadius: "8px" }}
                        />
                    ))}
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2.5, pt: 1 }}>
                <Button onClick={() => setWarningOpen(false)} sx={{ fontWeight: 700 }}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="warning"
                    onClick={() => {
                        setWarningOpen(false);
                        executeSave();
                    }}
                    sx={{ fontWeight: 800, borderRadius: 2, px: 3 }}
                >
                    Continue & Remove City Targets
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
}

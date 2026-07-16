"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  OutlinedInput,
  Alert,
  Snackbar,
  CircularProgress,
  LinearProgress,
  Drawer,
  Divider,
  TableSortLabel,
  Collapse,
} from "@mui/material";

// Icons
import { SearchIcon, RefreshIcon, AddIcon, EditTwoToneIcon, DeleteTwoToneIcon, VisibilityTwoToneIcon, CloseIcon, LocalShippingIcon, FilterListIcon, PersonIcon, KeyboardArrowDownIcon, KeyboardArrowRightIcon, PhoneIcon, EmailIcon, LocationOnIcon, CalendarTodayIcon, FilterAltOffIcon } from "@/components/icons";

import { coreService } from "@/lib/core-service";
import { crmService, Customer } from "@/lib/crm-service";
import { authService, UserProfile } from "@/lib/auth-service";
import { formatDRFError } from "@/lib/utils";
import Autocomplete from "@mui/material/Autocomplete";
import { useRouter } from "next/navigation";

// ---- HELPERS ----
const parseOperatingCities = (val: string | string[] | undefined): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try { return JSON.parse(trimmed); } catch { return [trimmed]; }
  }
  return [trimmed];
};

// ---- TYPES ----
interface Distributor {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  status: "Active" | "Inactive" | "Archived";
  operating_city?: string;
  operating_cities?: string[];
  latitude?: number;
  longitude?: number;
  full_address?: string;
  assignedAgent?: string;
  assignedAgentName?: string;
  assignedTo?: string;
  assignedToName?: string;
  date_joined?: string;
  last_seen?: string;
  profile_image?: string;
  aadhaar_number?: string;
  pan_number?: string;
  gst_number?: string;
  shipping_address?: string;
  tags?: string[];
  operating_pincodes?: string[];
  client_count?: number;
  business_name?: string;
}

const SLUG_TO_ROLE: Record<string, string> = {
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  distributor: "Distributor",
};

export default function DistributorsPage() {
  const theme = useTheme();
  const router = useRouter();

  // --- STATE ---
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Expand / customer state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [distributorCustomers, setDistributorCustomers] = useState<Record<number, Customer[]>>({});
  const [loadingCustomers, setLoadingCustomers] = useState<Set<number>>(new Set());

  // Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [agentFilter, setAgentFilter] = useState<string>("All");
  const [managerFilter, setManagerFilter] = useState<string>("All");

  // Sorting
  type SortField = "name" | "phone" | "operating_city" | "assignedAgentName" | "assignedToName" | "status" | "date_joined";
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"ADD" | "EDIT">("ADD");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- INLINE FORM STATE (same as Users page) ---
  const [formUser, setFormUser] = useState<any>({});
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [operatingCities, setOperatingCities] = useState<string[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [activeAddressField, setActiveAddressField] = useState<'billing' | 'shipping'>('billing');
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [marker, setMarker] = useState<any>(null);
  const mapSearchRef = useRef<HTMLInputElement>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" | "warning" }>({
    open: false, message: "", severity: "info",
  });
  const showToast = (message: string, severity: "success" | "error" | "info" | "warning" = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  // --- ROLE HELPERS ---
  const userRole = currentUserProfile?.role || "";
  const isAdmin = userRole === "admin" || userRole === "mdo";
  const isSalesManager = userRole === "sales_manager";
  const isSalesAgent = userRole === "sales_agent";

  // --- FETCH COMPANY CITIES ---
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const company = await coreService.getCurrentCompany();
        setOperatingCities(company.operating_cities || []);
      } catch (error) {
        console.error("Failed to fetch company data:", error);
      }
    };
    fetchCompanyData();
  }, []);

  // --- GOOGLE MAPS ---
  useEffect(() => {
    if ((window as any).google?.maps?.places) {
      setGoogleMapsLoaded(true);
      if (!document.getElementById("google-maps-pac-style")) {
        const style = document.createElement("style");
        style.id = "google-maps-pac-style";
        style.innerHTML = `.pac-container { z-index: 10000 !important; background-color: #fff; border-top: 1px solid #d9d9d9; font-family: Arial, sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin-top: 2px; } .pac-item { padding: 8px 10px; cursor: pointer; border-bottom: 1px solid #eee; } .pac-item:hover { background-color: #f7f7f7; } .pac-item-query { font-size: 14px; color: #333; }`;
        document.head.appendChild(style);
      }
      return;
    }
    if (formDialogOpen && !googleMapsLoaded) {
      if (document.getElementById("google-maps-script")) return;
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setGoogleMapsLoaded(true);
        if (!document.getElementById("google-maps-pac-style")) {
          const style = document.createElement("style");
          style.id = "google-maps-pac-style";
          style.innerHTML = `.pac-container { z-index: 10000 !important; } .pac-item { padding: 8px 10px; cursor: pointer; }`;
          document.head.appendChild(style);
        }
      };
      document.head.appendChild(script);
    }
  }, [formDialogOpen, googleMapsLoaded]);

  useEffect(() => {
    if (mapOpen && googleMapsLoaded) {
      const interval = setInterval(() => {
        const mapDiv = document.getElementById("google-map");
        if (mapDiv) {
          clearInterval(interval);
          const initialPos = { lat: Number(formUser.latitude) || 28.6139, lng: Number(formUser.longitude) || 77.2090 };
          const newMap = new (window as any).google.maps.Map(mapDiv, { center: initialPos, zoom: 12, mapTypeControl: false });
          const newMarker = new (window as any).google.maps.Marker({ position: initialPos, map: newMap, draggable: true });
          setMarker(newMarker);
          const input = document.getElementById("map-search") as HTMLInputElement;
          if (input) {
            const autocomplete = new (window as any).google.maps.places.Autocomplete(input);
            autocomplete.bindTo("bounds", newMap);
            autocomplete.addListener("place_changed", () => {
              const place = autocomplete.getPlace();
              if (!place?.geometry?.location) return;
              if (place.geometry.viewport) newMap.fitBounds(place.geometry.viewport);
              else { newMap.setCenter(place.geometry.location); newMap.setZoom(17); }
              newMarker.setPosition(place.geometry.location);
              const addr = place.formatted_address || "";
              if (activeAddressField === 'shipping') {
                setFormUser((prev: any) => ({ ...prev, shipping_address: addr }));
              } else {
                setFormUser((prev: any) => ({ ...prev, full_address: addr }));
              }
            });
          }
          const geocoder = new (window as any).google.maps.Geocoder();
          const reverseGeocode = (latLng: any) => {
            geocoder.geocode({ location: latLng }, (results: any, status: any) => {
              if (status === "OK" && results?.[0]) {
                const addr = results[0].formatted_address;
                if (activeAddressField === 'shipping') {
                  setFormUser((prev: any) => ({ ...prev, shipping_address: addr }));
                } else {
                  setFormUser((prev: any) => ({ ...prev, full_address: addr }));
                }
              }
            });
          };
          newMarker.addListener("dragend", () => { reverseGeocode(newMarker.getPosition()); });
          newMap.addListener("click", (e: any) => { newMarker.setPosition(e.latLng); reverseGeocode(e.latLng); });
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [mapOpen, googleMapsLoaded, activeAddressField]);

  const saveLocation = () => {
    if (marker) {
      const pos = marker.getPosition();
      if (pos) {
        setFormUser((prev: any) => ({ ...prev, latitude: Number(pos.lat().toFixed(6)), longitude: Number(pos.lng().toFixed(6)) }));
        setMapOpen(false);
        showToast("Location updated successfully", "success");
      }
    }
  };

  const formatAadhaar = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 12);
    return raw.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  };

  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, "");
    if (raw.length <= 12 && /^\d*$/.test(raw)) {
      setFormUser({ ...formUser, aadhaar_number: raw });
    }
  };

  // --- FETCH DATA ---
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      authService.clearCache();
      const user = await authService.getCurrentUser();
      setCurrentUserProfile(user);

      const response = await coreService.getUsers({ page_size: "1000", role: "distributor" });
      const data = Array.isArray(response) ? response : (response as any).results || [];

      // Also fetch all users to resolve names
      const allResp = await coreService.getUsers({ page_size: "1000" });
      const allData = Array.isArray(allResp) ? allResp : (allResp as any).results || [];
      setAllUsers(allData);

      const mapped: Distributor[] = data.map((u: any) => {
        const agentUser = allData.find((au: any) => au.id === u.assigned_agent);
        const managerUser = allData.find((mu: any) => mu.id === u.assigned_to);

        return {
          id: u.id,
          name: u.full_name || u.username,
          username: u.username,
          email: u.email || "",
          phone: u.phone || "",
          status: u.status,
          business_name: u.business_name || "",
          operating_city: u.operating_city || "",
          operating_cities: parseOperatingCities(u.operating_city),
          latitude: u.latitude,
          longitude: u.longitude,
          full_address: u.full_address || "",
          assignedAgent: u.assigned_agent ? String(u.assigned_agent) : undefined,
          assignedAgentName: agentUser ? (agentUser.full_name || agentUser.username) : "",
          assignedTo: u.assigned_to ? String(u.assigned_to) : undefined,
          assignedToName: managerUser ? (managerUser.full_name || managerUser.username) : "",
          date_joined: u.date_joined,
          last_seen: u.last_seen,
          profile_image: u.profile_image,
          aadhaar_number: u.aadhaar_number,
          pan_number: u.pan_number,
          gst_number: u.gst_number,
          shipping_address: u.shipping_address,
          tags: typeof u.tags === "string" ? JSON.parse(u.tags) : u.tags || [],
          operating_pincodes: typeof u.operating_pincodes === "string" ? JSON.parse(u.operating_pincodes) : u.operating_pincodes || [],
          client_count: typeof u.client_count === "number" ? u.client_count : undefined,
        };
      });

      setDistributors(mapped);
    } catch (error) {
      console.error("Failed to fetch distributors:", error);
      showToast("Failed to load distributors", "error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Deep-link: open a distributor's view modal when arriving via ?distributor=<id>
  const [distDeepLinkDone, setDistDeepLinkDone] = useState(false);
  useEffect(() => {
    if (distDeepLinkDone || distributors.length === 0 || typeof window === "undefined") return;
    const did = new URLSearchParams(window.location.search).get("distributor");
    if (!did) { setDistDeepLinkDone(true); return; }
    const target = distributors.find(d => String(d.id) === did);
    if (target) { setSelectedDistributor(target); setViewDialogOpen(true); setDistDeepLinkDone(true); }
  }, [distributors, distDeepLinkDone]);

  // --- FILTERED DATA ---
  const filteredDistributors = useMemo(() => {
    const filtered = distributors.filter((d) => {
      const matchesSearch =
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.phone.includes(search) ||
        d.email.toLowerCase().includes(search.toLowerCase()) ||
        (d.operating_cities || []).some((c) => c.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === "All" || d.status === statusFilter;
      const matchesCity = cityFilter === "All" || (d.operating_cities || []).includes(cityFilter);
      const matchesAgent = agentFilter === "All" || d.assignedAgent === agentFilter;
      const matchesManager = managerFilter === "All" || d.assignedTo === managerFilter;
      return matchesSearch && matchesStatus && matchesCity && matchesAgent && matchesManager;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal = (sortField === "operating_city" ? (a.operating_cities || []).join(", ") : (a[sortField] ?? "")) as string;
      let bVal = (sortField === "operating_city" ? (b.operating_cities || []).join(", ") : (b[sortField] ?? "")) as string;
      if (sortField === "date_joined") {
        const aTime = a.date_joined ? new Date(a.date_joined).getTime() : 0;
        const bTime = b.date_joined ? new Date(b.date_joined).getTime() : 0;
        return sortDir === "asc" ? aTime - bTime : bTime - aTime;
      }
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [distributors, search, statusFilter, cityFilter, agentFilter, sortField, sortDir]);

  const paginatedDistributors = filteredDistributors.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Unique values for filters
  const cities = [...new Set(distributors.flatMap((d) => d.operating_cities || []).filter(Boolean))];
  const agents = [...new Set(distributors.map((d) => d.assignedAgent).filter((x): x is string => !!x))];
  const agentNames = agents.map((agentId: string) => {
    const d = distributors.find((x) => x.assignedAgent === agentId);
    return { id: agentId, name: d?.assignedAgentName || agentId };
  });
  const managers = [...new Set(distributors.map((d) => d.assignedTo).filter((x): x is string => !!x))];
  const managerNames = managers.map((managerId: string) => {
    const d = distributors.find((x) => x.assignedTo === managerId);
    return { id: managerId, name: d?.assignedToName || managerId };
  });

  // --- EXPAND ROW HANDLER ---
  const handleToggleExpand = useCallback(async (distId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(distId)) {
        next.delete(distId);
      } else {
        next.add(distId);
      }
      return next;
    });

    // Lazy-load customers only once
    if (!distributorCustomers[distId]) {
      setLoadingCustomers(prev => new Set(prev).add(distId));
      try {
        const resp = await crmService.getCustomers({ distributor: String(distId), page_size: "200" } as any);
        const list: Customer[] = (resp as any).results ?? (Array.isArray(resp) ? resp : []);
        setDistributorCustomers(prev => ({ ...prev, [distId]: list }));
      } catch {
        setDistributorCustomers(prev => ({ ...prev, [distId]: [] }));
      } finally {
        setLoadingCustomers(prev => { const s = new Set(prev); s.delete(distId); return s; });
      }
    }
  }, [distributorCustomers]);

  // --- HANDLERS ---
  const handleView = (dist: Distributor) => {
    setSelectedDistributor(dist);
    setViewDialogOpen(true);
  };

  const handleEdit = (dist: Distributor) => {
    setFormMode("EDIT");
    setFormUser({
      id: dist.id,
      name: dist.name,
      username: dist.username,
      email: dist.email,
      phone: dist.phone,
      status: dist.status,
      business_name: dist.business_name || "",
      operating_city: parseOperatingCities(dist.operating_city),
      tags: dist.tags || [],
      assignedAgent: dist.assignedAgent || "",
      latitude: dist.latitude || "",
      longitude: dist.longitude || "",
      full_address: dist.full_address || "",
      aadhaar_number: dist.aadhaar_number || "",
      pan_number: dist.pan_number || "",
      gst_number: dist.gst_number || "",
      shipping_address: dist.shipping_address || "",
      profile_image: dist.profile_image || "",
      aadhaar_card: "",
      pan_card: "",
    });
    setProfileImageFile(null);
    setAadhaarFile(null);
    setPanFile(null);
    setFormDialogOpen(true);
  };

  const handleAdd = () => {
    setFormMode("ADD");
    setFormUser({
      name: "", email: "", phone: "", status: "Active", business_name: "",
      operating_city: isSalesAgent ? parseOperatingCities(currentUserProfile?.operating_city) : [],
      tags: [], assignedAgent: isSalesAgent ? String(currentUserProfile?.id) : "",
      latitude: "", longitude: "", full_address: "",
      aadhaar_number: "", pan_number: "",
      gst_number: "", shipping_address: "",
    });
    setProfileImageFile(null);
    setAadhaarFile(null);
    setPanFile(null);
    setFormDialogOpen(true);
  };

  const handleSaveDistributor = async () => {
    if (isSubmitting) return;
    // Validation
    if (!formUser.name?.trim()) { showToast("Full Name is mandatory.", "warning"); return; }
    if (formUser.name.length > 50) { showToast("Full Name cannot exceed 50 characters.", "warning"); return; }
    if (!formUser.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formUser.email)) { showToast("Please provide a valid email.", "warning"); return; }
    if (!formUser.phone || formUser.phone.length !== 10 || !/^\d+$/.test(formUser.phone)) { showToast("Phone must be exactly 10 digits.", "warning"); return; }
    if (!formUser.operating_city || (Array.isArray(formUser.operating_city) && formUser.operating_city.length === 0)) { showToast("Operating City is mandatory.", "warning"); return; }
    if (!isSalesAgent && !formUser.assignedAgent) { showToast("Assigned Agent is mandatory.", "warning"); return; }
    if (!formUser.full_address?.trim()) { showToast("Full Address is mandatory.", "warning"); return; }
    if (!formUser.latitude || !formUser.longitude) { showToast("Location is mandatory. Use the map picker.", "warning"); return; }
    if (formUser.aadhaar_number && formUser.aadhaar_number.length !== 12) { showToast("Aadhaar must be 12 digits.", "warning"); return; }
    if (formUser.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formUser.pan_number)) { showToast("Invalid PAN format (e.g. ABCDE1234F).", "warning"); return; }
    if (formMode === "ADD") {
      if (!profileImageFile) { showToast("Profile Photo is mandatory.", "warning"); return; }
      if (!aadhaarFile) { showToast("Aadhaar Card is mandatory.", "warning"); return; }
      if (!panFile) { showToast("PAN Card is mandatory.", "warning"); return; }
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("full_name", formUser.name);
      fd.append("username", formUser.email);
      fd.append("email", formUser.email);
      fd.append("phone", formUser.phone);
      fd.append("role", "distributor");
      fd.append("status", formUser.status || "Active");
      fd.append("operating_city", Array.isArray(formUser.operating_city) ? JSON.stringify(formUser.operating_city) : (formUser.operating_city || ""));
      fd.append("business_name", formUser.business_name || "");
      if (formUser.latitude) fd.append("latitude", Number(formUser.latitude).toFixed(6));
      if (formUser.longitude) fd.append("longitude", Number(formUser.longitude).toFixed(6));
      if (formUser.full_address) fd.append("full_address", formUser.full_address);
      if (formUser.aadhaar_number) fd.append("aadhaar_number", formUser.aadhaar_number);
      if (formUser.pan_number) fd.append("pan_number", formUser.pan_number);
      if (formUser.gst_number) fd.append("gst_number", formUser.gst_number);
      if (formUser.shipping_address) fd.append("shipping_address", formUser.shipping_address);
      if (formUser.tags?.length) fd.append("tags", JSON.stringify(formUser.tags));

      if (formUser.assignedAgent) {
        fd.append("assigned_agent", formUser.assignedAgent);
      } else if (isSalesAgent && currentUserProfile) {
        fd.append("assigned_agent", String(currentUserProfile.id));
      }

      if (profileImageFile) fd.append("profile_image", profileImageFile);
      if (aadhaarFile) fd.append("aadhaar_card", aadhaarFile);
      if (panFile) fd.append("pan_card", panFile);

      if (formMode === "ADD") {
        await coreService.createUser(fd);
        showToast("Distributor created successfully!", "success");
      } else if (formUser.id) {
        await coreService.updateUser(formUser.id, fd);
        showToast("Distributor updated successfully!", "success");
      }
      setFormDialogOpen(false);
      fetchData();
    } catch (e: any) {
      showToast(formatDRFError(e), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (dist: Distributor) => {
    setDeleteTarget(dist);
    setDeleteCountdown(3);
    setDeleteDialogOpen(true);
  };

  useEffect(() => {
    if (!deleteDialogOpen || deleteCountdown <= 0) return;
    const timer = setTimeout(() => setDeleteCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [deleteDialogOpen, deleteCountdown]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Soft delete: set status to Archived
      const formData = new FormData();
      formData.append("status", "Archived");
      await coreService.updateUser(deleteTarget.id, formData);
      showToast(`${deleteTarget.name} has been archived.`, "success");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (e: any) {
      showToast(formatDRFError(e), "error");
    }
  };

  // --- DATE FORMAT ---
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  // --- STAT CARDS ---
  const totalActive = distributors.filter((d) => d.status === "Active").length;
  const totalInactive = distributors.filter((d) => d.status === "Inactive").length;

  if (loading) {
    return (
      <>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, mx: "auto" }}>
        {/* --- HEADER --- */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} color="text.primary">
              Distributors
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isSalesAgent
                ? "Your assigned distributors"
                : isSalesManager
                  ? "Distributors under your team"
                  : "All distributors in the system"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchData} disabled={isRefreshing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {(isAdmin || isSalesAgent) && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Add Distributor
              </Button>
            )}
          </Stack>
        </Stack>

        {/* --- STAT CARDS --- */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          {[
            { label: "Total", value: distributors.length, color: theme.palette.primary.main },
            { label: "Active", value: totalActive, color: theme.palette.success.main },
            { label: "Inactive", value: totalInactive, color: theme.palette.warning.main },
          ].map((stat) => (
            <Paper
              key={stat.label}
              elevation={0}
              sx={{
                p: 2,
                flex: 1,
                bgcolor: alpha(stat.color, 0.06),
                border: `1px solid ${alpha(stat.color, 0.15)}`,
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
              <Typography variant="h4" fontWeight={700} color={stat.color}>{stat.value}</Typography>
            </Paper>
          ))}
        </Stack>

        {/* --- SEARCH & FILTERS --- */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField
              placeholder="Search by name, phone, email, city..."
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                ),
              }}
              sx={{ flex: 1, minWidth: 250 }}
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} input={<OutlinedInput label="Status" />}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
                <MenuItem value="Archived">Archived</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>City</InputLabel>
              <Select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(0); }} input={<OutlinedInput label="City" />}>
                <MenuItem value="All">All Cities</MenuItem>
                {cities.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            {(isAdmin || isSalesManager) && (
              <Stack direction="row" spacing={2}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Agent</InputLabel>
                  <Select value={agentFilter} onChange={(e) => { setAgentFilter(e.target.value); setPage(0); }} input={<OutlinedInput label="Agent" />}>
                    <MenuItem value="All">All Agents</MenuItem>
                    {agentNames.map((a: any) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                  </Select>
                </FormControl>
                {isAdmin && (
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Manager</InputLabel>
                    <Select value={managerFilter} onChange={(e) => { setManagerFilter(e.target.value); setPage(0); }} input={<OutlinedInput label="Manager" />}>
                      <MenuItem value="All">All Managers</MenuItem>
                      {managerNames.map((m: any) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                )}
              </Stack>
            )}
            <Tooltip title="Clear Filters">
              <IconButton 
                size="small" 
                onClick={() => { setSearch(""); setStatusFilter("All"); setCityFilter("All"); setAgentFilter("All"); setManagerFilter("All"); setPage(0); }}
                sx={{ 
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  borderRadius: 2,
                  "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.05), color: "error.main" }
                }}
              >
                <FilterAltOffIcon fontSize="small" /> 
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>

        {isRefreshing && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}

        {/* --- TABLE --- */}
        <Paper elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 2, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  {/* Expand toggle column */}
                  <TableCell sx={{ width: 40, p: 0 }} />
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel active={sortField === "name"} direction={sortField === "name" ? sortDir : "asc"} onClick={() => handleSort("name")}>
                      Distributor
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel active={sortField === "phone"} direction={sortField === "phone" ? sortDir : "asc"} onClick={() => handleSort("phone")}>
                      Phone
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel active={sortField === "operating_city"} direction={sortField === "operating_city" ? sortDir : "asc"} onClick={() => handleSort("operating_city")}>
                      City
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel active={sortField === "assignedAgentName"} direction={sortField === "assignedAgentName" ? sortDir : "asc"} onClick={() => handleSort("assignedAgentName")}>
                      Team
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel active={sortField === "status"} direction={sortField === "status" ? sortDir : "asc"} onClick={() => handleSort("status")}>
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel active={sortField === "date_joined"} direction={sortField === "date_joined" ? sortDir : "asc"} onClick={() => handleSort("date_joined")}>
                      Joined
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedDistributors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <LocalShippingIcon sx={{ fontSize: 48, color: alpha(theme.palette.text.secondary, 0.3), mb: 1 }} />
                      <Typography color="text.secondary">
                        {search || statusFilter !== "All" || cityFilter !== "All" || agentFilter !== "All" || managerFilter !== "All"
                          ? "No distributors match your filters"
                          : "No distributors found"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDistributors.map((dist) => {
                    const isExpanded = expandedRows.has(dist.id);
                    const customers = distributorCustomers[dist.id] ?? [];
                    const isLoadingCust = loadingCustomers.has(dist.id);
                    // total cols: 1 (arrow) + 1 (dist) + 1 (phone) + 1 (city) + 1 (team) + 1 (status) + 1 (joined) + 1 (actions)
                    const colSpan = 8;

                    return (
                      <React.Fragment key={dist.id}>
                        <TableRow
                          hover
                          sx={{ "&:last-child td": { borderBottom: isExpanded ? 0 : undefined }, cursor: "pointer" }}
                          onClick={() => handleView(dist)}
                        >
                          {/* Expand arrow */}
                          <TableCell
                            sx={{ p: 0.5, pr: 0 }}
                            onClick={(e) => { e.stopPropagation(); handleToggleExpand(dist.id); }}
                          >
                            <Tooltip title={isExpanded ? "Collapse clients" : "Show clients"}>
                              <IconButton size="small" sx={{ p: 0.5 }}>
                                {isExpanded
                                  ? <KeyboardArrowDownIcon fontSize="small" sx={{ color: 'primary.main' }} />
                                  : <KeyboardArrowRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
                              </IconButton>
                            </Tooltip>
                          </TableCell>

                          <TableCell>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar
                                src={dist.profile_image}
                                sx={{
                                  width: 36, height: 36,
                                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                                  color: theme.palette.primary.main,
                                  fontSize: 14, fontWeight: 700,
                                }}
                              >
                                {dist.name?.charAt(0)?.toUpperCase()}
                              </Avatar>
                              <Box>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <Typography variant="body2" fontWeight={600}>{dist.name}</Typography>
                                  {typeof dist.client_count === "number" && (
                                    <Chip
                                      label={`${dist.client_count} ${dist.client_count === 1 ? "client" : "clients"}`}
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); handleToggleExpand(dist.id); }}
                                      sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, cursor: "pointer",
                                        bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main }}
                                    />
                                  )}
                                </Stack>
                                <Typography variant="caption" color="text.secondary">{dist.email}</Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{dist.phone || "—"}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{(dist.operating_cities || []).join(", ") || "—"}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{dist.assignedAgentName || "—"}</Typography>
                            <Typography variant="caption" color="text.secondary">Mngr: {dist.assignedToName || "—"}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={dist.status}
                              size="small"
                              sx={{
                                fontWeight: 600,
                                bgcolor:
                                  dist.status === "Active"
                                    ? alpha(theme.palette.success.main, 0.1)
                                    : dist.status === "Inactive"
                                      ? alpha(theme.palette.warning.main, 0.1)
                                      : alpha(theme.palette.error.main, 0.1),
                                color:
                                  dist.status === "Active"
                                    ? theme.palette.success.main
                                    : dist.status === "Inactive"
                                      ? theme.palette.warning.main
                                      : theme.palette.error.main,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatDate(dist.date_joined)}</Typography>
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="View">
                                <IconButton size="small" onClick={() => handleView(dist)}>
                                  <VisibilityTwoToneIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => handleEdit(dist)}>
                                  <EditTwoToneIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {(isAdmin || isSalesAgent) && (
                                <Tooltip title="Delete">
                                  <IconButton size="small" color="error" onClick={() => handleDeleteClick(dist)}>
                                    <DeleteTwoToneIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>

                        {/* ---- EXPANDED CUSTOMER SUB-ROW ---- */}
                        <TableRow>
                          <TableCell colSpan={colSpan} sx={{ p: 0, border: 0 }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box
                                sx={{
                                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                                  px: 4,
                                  py: 1.5,
                                }}
                              >
                                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 1 }}>
                                  Clients of {dist.name}{typeof dist.client_count === "number" ? ` (${dist.client_count})` : ""}
                                </Typography>

                                {isLoadingCust ? (
                                  <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
                                    <CircularProgress size={16} />
                                    <Typography variant="caption" color="text.secondary">Loading clients...</Typography>
                                  </Stack>
                                ) : customers.length === 0 ? (
                                  <Typography variant="caption" color="text.disabled" fontStyle="italic">
                                    No clients assigned to this distributor yet.
                                  </Typography>
                                ) : (
                                  <Table size="small" sx={{ minWidth: 600 }}>
                                    <TableHead>
                                      <TableRow>
                                        {['Shop Name', 'Owner', 'Phone', 'Agent', 'Status'].map(h => (
                                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary', py: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
                                            {h}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {customers.map(c => (
                                        <TableRow
                                          key={c.id}
                                          hover
                                          onClick={() => router.push(`${isSalesAgent ? "/my-customers" : "/customers"}?customer=${c.id}`)}
                                          sx={{ '&:last-child td': { border: 0 }, cursor: 'pointer' }}
                                        >
                                          <TableCell sx={{ py: 0.75 }}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                              <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main', fontSize: 12, fontWeight: 700 }}>
                                                {(c.shop_name || c.customer_name)?.[0]?.toUpperCase()}
                                              </Avatar>
                                              <Box>
                                                <Typography variant="caption" fontWeight={700} display="block">{c.shop_name || '—'}</Typography>
                                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>{c.customer_code}</Typography>
                                              </Box>
                                            </Stack>
                                          </TableCell>
                                          <TableCell sx={{ py: 0.75 }}>
                                            <Typography variant="caption">{c.customer_name}</Typography>
                                          </TableCell>
                                          <TableCell sx={{ py: 0.75 }}>
                                            <Typography variant="caption">{c.phone || '—'}</Typography>
                                          </TableCell>
                                          <TableCell sx={{ py: 0.75 }}>
                                            <Typography variant="caption">{c.assigned_agent_name || '—'}</Typography>
                                          </TableCell>
                                          <TableCell sx={{ py: 0.75 }}>
                                            <Chip
                                              label={c.status}
                                              size="small"
                                              sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700,
                                                bgcolor: c.status === 'Active' ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                                                color: c.status === 'Active' ? theme.palette.success.main : theme.palette.error.main,
                                              }}
                                            />
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredDistributors.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>

        {/* --- VIEW DIALOG --- */}
        <Drawer
          anchor="right"
          open={viewDialogOpen}
          onClose={() => setViewDialogOpen(false)}
          PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, p: 0 } }}
        >
          {selectedDistributor && (
            <Box>
              <Box sx={{
                p: 3,
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={selectedDistributor.profile_image}
                      sx={{ width: 56, height: 56, bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, fontWeight: 700, fontSize: 22 }}
                    >
                      {selectedDistributor.name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>{selectedDistributor.name}</Typography>
                      <Chip
                        label={selectedDistributor.status}
                        size="small"
                        sx={{
                          mt: 0.5,
                          fontWeight: 600,
                          bgcolor: selectedDistributor.status === "Active" ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.warning.main, 0.1),
                          color: selectedDistributor.status === "Active" ? theme.palette.success.main : theme.palette.warning.main,
                        }}
                      />
                    </Box>
                  </Stack>
                  <IconButton onClick={() => setViewDialogOpen(false)}>
                    <CloseIcon />
                  </IconButton>
                </Stack>
              </Box>

              <Box sx={{ p: 3 }}>
                <Stack spacing={2.5}>
                  {[
                    { icon: <EmailIcon fontSize="small" />, label: "Email", value: selectedDistributor.email || "N/A" },
                    { icon: <PhoneIcon fontSize="small" />, label: "Phone", value: selectedDistributor.phone || "N/A" },
                    { icon: <LocationOnIcon fontSize="small" />, label: "City", value: (selectedDistributor.operating_cities || []).join(", ") || "N/A" },
                    { icon: <LocationOnIcon fontSize="small" />, label: "Address", value: selectedDistributor.full_address || "N/A" },
                    { icon: <PersonIcon fontSize="small" />, label: "Assigned Agent", value: selectedDistributor.assignedAgentName || "N/A" },
                    { icon: <PersonIcon fontSize="small" />, label: "Sales Manager", value: selectedDistributor.assignedToName || "N/A" },
                    { icon: <CalendarTodayIcon fontSize="small" />, label: "Date Joined", value: formatDate(selectedDistributor.date_joined) },
                  ].map((item) => (
                    <Stack key={item.label} direction="row" spacing={2} alignItems="flex-start">
                      <Box sx={{ mt: 0.3, color: "text.secondary" }}>{item.icon}</Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        <Typography variant="body2" fontWeight={500}>{item.value}</Typography>
                      </Box>
                    </Stack>
                  ))}

                  {selectedDistributor.aadhaar_number && (
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ mt: 0.3, color: "text.secondary" }}><PersonIcon fontSize="small" /></Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Aadhaar</Typography>
                        <Typography variant="body2" fontWeight={500}>{selectedDistributor.aadhaar_number}</Typography>
                      </Box>
                    </Stack>
                  )}
                  {selectedDistributor.pan_number && (
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ mt: 0.3, color: "text.secondary" }}><PersonIcon fontSize="small" /></Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">PAN</Typography>
                        <Typography variant="body2" fontWeight={500}>{selectedDistributor.pan_number}</Typography>
                      </Box>
                    </Stack>
                  )}

                  {selectedDistributor.latitude && selectedDistributor.longitude && (
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ mt: 0.3, color: "text.secondary" }}><LocationOnIcon fontSize="small" /></Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Coordinates</Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {selectedDistributor.latitude}, {selectedDistributor.longitude}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditTwoToneIcon />}
                    onClick={() => { setViewDialogOpen(false); handleEdit(selectedDistributor); }}
                  >
                    Edit
                  </Button>
                  {(isAdmin || isSalesAgent) && (
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      startIcon={<DeleteTwoToneIcon />}
                      onClick={() => { setViewDialogOpen(false); handleDeleteClick(selectedDistributor); }}
                    >
                      Delete
                    </Button>
                  )}
                </Stack>
              </Box>
            </Box>
          )}
        </Drawer>

        {/* --- CREATE / EDIT DIALOG (inline, same as Users page) --- */}
        <Dialog open={formDialogOpen} onClose={() => setFormDialogOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { p: 1 } }}>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
            {formMode === "ADD" ? "Create Distributor" : "Edit Distributor"}
            <IconButton onClick={() => setFormDialogOpen(false)} size="small"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
                {/* LEFT: Profile Image + Operating City + Tags */}
                <Stack spacing={2} sx={{ width: { xs: "100%", md: 250 }, flexShrink: 0 }}>
                  <Box component="label" sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed", borderColor: alpha(theme.palette.divider, 0.2), borderRadius: 1, p: 3, height: 280, cursor: "pointer", transition: "all 0.2s", bgcolor: alpha(theme.palette.background.default, 0.5), "&:hover": { borderColor: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.05) } }}>
                    <input type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size > 1024 * 1024) { showToast("Max file size 1MB", "warning"); e.target.value = ""; } else if (f) setProfileImageFile(f); }} />
                    <Avatar src={profileImageFile ? URL.createObjectURL(profileImageFile) : formUser.profile_image || undefined} sx={{ width: 80, height: 80, bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, mb: 2 }}>
                      {!profileImageFile && !formUser.profile_image && <AddIcon fontSize="large" />}
                    </Avatar>
                    <Typography variant="body1" fontWeight={600} align="center">
                      {profileImageFile ? "Photo Selected" : formUser.profile_image ? "Photo Uploaded" : "Upload Profile Photo *"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" align="center">
                      {profileImageFile ? profileImageFile.name : formUser.profile_image ? "Current Photo" : "PNG, JPG max 1MB"}
                    </Typography>
                  </Box>

                  {(() => {
                    // City options are constrained to the assigned agent's operating cities
                    // (a distributor's cities must be a subset of its agent's).
                    let citiesToShow: string[] = [];
                    if (formUser.assignedAgent) {
                      const agent = allUsers.find(u => String(u.id) === String(formUser.assignedAgent));
                      if (agent) citiesToShow = parseOperatingCities(agent.operating_city);
                    } else if (isSalesAgent && currentUserProfile) {
                      citiesToShow = parseOperatingCities(currentUserProfile.operating_city);
                    }
                    const selectedCities = Array.isArray(formUser.operating_city) ? formUser.operating_city : [];
                    return (
                      <Autocomplete
                        multiple
                        options={citiesToShow}
                        value={selectedCities}
                        onChange={(_, v) => setFormUser({ ...formUser, operating_city: v })}
                        disabled={!formUser.assignedAgent && !isSalesAgent}
                        disableCloseOnSelect
                        renderTags={(value, getTagProps) =>
                          value.map((o, i) => <Chip label={o} size="small" {...getTagProps({ index: i })} key={o} />)
                        }
                        renderInput={(params) => (
                          <TextField {...params} label="Operating City"
                            placeholder={selectedCities.length === 0 ? "Search & select city..." : ""} />
                        )}
                      />
                    );
                  })()}

                  <Autocomplete multiple options={["VIP", "Premium", "Regular", "New", "Verified", "Partner", "Distribution"]} value={formUser.tags || []} onChange={(_, v) => setFormUser({ ...formUser, tags: v })} freeSolo
                    renderTags={(value, getTagProps) => value.map((o, i) => <Chip label={o} {...getTagProps({ index: i })} size="small" key={o} />)}
                    renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add tags..." />}
                  />
                </Stack>

                {/* RIGHT: Form Fields */}
                <Stack spacing={2} sx={{ flex: 1, width: "100%" }}>
                  <TextField label="Venue / Business Name" fullWidth value={formUser.business_name || ""}
                    onChange={(e) => setFormUser({ ...formUser, business_name: e.target.value.slice(0, 200) })}
                    inputProps={{ maxLength: 200 }} placeholder="e.g. shop / venue name" />
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <TextField label="Full Name *" sx={{ flex: 1 }} value={formUser.name || ""} onChange={(e) => setFormUser({ ...formUser, name: e.target.value.slice(0, 50) })} inputProps={{ maxLength: 50 }} helperText={`${formUser.name?.length || 0}/50 characters`} />
                    {/* Assigned Agent dropdown (hidden for Sales Agent — auto-assigned) */}
                    {!isSalesAgent && (
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Box sx={{ flex: 1 }}>
                            {(() => {
                              const formCities = Array.isArray(formUser.operating_city) ? formUser.operating_city : parseOperatingCities(formUser.operating_city);
                              const cityAgents = allUsers.filter((u) => {
                                if (u.role !== "sales_agent" || u.status !== "Active") return false;
                                if (formCities.length === 0) return true; // Show all if no city picked
                                return parseOperatingCities(u.operating_city).some((c) => formCities.includes(c));
                              });
                              return cityAgents.length > 0 ? (
                                <FormControl fullWidth>
                                  <InputLabel>Assigned Sales Agent</InputLabel>
                                  <Select
                                    value={formUser.assignedAgent || ""}
                                    onChange={(e) => setFormUser({ ...formUser, assignedAgent: e.target.value, operating_city: [] })}
                                    input={<OutlinedInput label="Assigned Sales Agent" />}
                                  >
                                    {cityAgents.map((a) => (
                                      <MenuItem key={a.id} value={String(a.id)}>
                                        {a.full_name || a.username}
                                      </MenuItem>
                                    ))}
                                    {formUser.assignedAgent && !cityAgents.find((a: any) => String(a.id) === formUser.assignedAgent) && (
                                      <MenuItem value={formUser.assignedAgent} disabled>
                                        {allUsers.find((u) => String(u.id) === formUser.assignedAgent)?.full_name || formUser.assignedAgent} (Invalid)
                                      </MenuItem>
                                    )}
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
                              );
                            })()}
                          </Box>
                        </Stack>
                      </Box>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ flex: 1, position: 'relative' }}>
                      <TextField label="Billing Address *" fullWidth multiline rows={2} value={formUser.full_address || ""} onChange={(e) => setFormUser({ ...formUser, full_address: e.target.value })} placeholder="Pick from map or enter manually..." />
                      <Tooltip title="Pick Billing Address from Map">
                        <IconButton size="small" color={formUser.full_address ? "success" : "primary"} onClick={() => { setActiveAddressField('billing'); setMapOpen(true); }} sx={{ position: 'absolute', top: 8, right: 8 }}>
                          <LocationOnIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ flex: 1, position: 'relative' }}>
                      <TextField label="Shipping Address" fullWidth multiline rows={2} value={formUser.shipping_address || ""} onChange={(e) => setFormUser({ ...formUser, shipping_address: e.target.value })} placeholder="If different from billing address..." />
                      <Tooltip title="Pick Shipping Address from Map">
                        <IconButton size="small" color={formUser.shipping_address ? "success" : "primary"} onClick={() => { setActiveAddressField('shipping'); setMapOpen(true); }} sx={{ position: 'absolute', top: 8, right: 8 }}>
                          <LocationOnIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={2}>
                    <TextField label="Email Address *" fullWidth type="email" value={formUser.email || ""} onChange={(e) => setFormUser({ ...formUser, email: e.target.value })} />
                    <TextField label="Phone Number *" fullWidth value={formUser.phone || ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setFormUser({ ...formUser, phone: v }); }} inputProps={{ maxLength: 10 }} helperText="Exact 10 digits required" />
                  </Stack>

                  <Stack direction="row" spacing={2}>
                    <TextField label="Aadhaar Number" fullWidth value={formatAadhaar(formUser.aadhaar_number || "")} onChange={handleAadhaarChange} placeholder="XXXX XXXX XXXX" inputProps={{ maxLength: 14 }} helperText="12 digit numeric" />
                    <TextField label="PAN Card Number" fullWidth value={formUser.pan_number || ""} onChange={(e) => setFormUser({ ...formUser, pan_number: e.target.value.toUpperCase().slice(0, 10) })} placeholder="ABCDE1234F" inputProps={{ maxLength: 10 }} helperText="Format: ABCDE1234F" />
                    <TextField label="GST Number (GSTIN)" fullWidth value={formUser.gst_number || ""} onChange={(e) => setFormUser({ ...formUser, gst_number: e.target.value.toUpperCase().slice(0, 15) })} placeholder="22AAAAA0000A1Z5" inputProps={{ maxLength: 15 }} helperText="15 character GSTIN" />
                  </Stack>

                  <FormControl fullWidth sx={{ maxWidth: 200 }}>
                    <InputLabel>Status</InputLabel>
                    <Select value={formUser.status || "Active"} onChange={(e) => setFormUser({ ...formUser, status: e.target.value })} input={<OutlinedInput label="Status" />}>
                      <MenuItem value="Active">Active</MenuItem>
                      <MenuItem value="Inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>

              {/* BOTTOM: Documents */}
              <Stack direction="row" spacing={2}>
                <Box component="label" sx={{ flex: 1, border: "2px dashed", borderColor: aadhaarFile ? theme.palette.success.main : alpha(theme.palette.divider, 0.2), borderRadius: 2, p: 2, textAlign: "center", cursor: "pointer", transition: "all 0.2s", bgcolor: aadhaarFile ? alpha(theme.palette.success.main, 0.05) : "transparent", "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.05), borderColor: theme.palette.primary.main } }}>
                  <input type="file" hidden accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 1024 * 1024) { showToast("File size exceeds 1MB", "warning"); e.target.value = ""; } else setAadhaarFile(f); } }} />
                  <Typography variant="subtitle2" fontWeight={600}>{aadhaarFile ? "✓ " + aadhaarFile.name : formUser.aadhaar_card ? "✓ Aadhaar Uploaded" : "Upload Aadhaar Card *"}</Typography>
                  {!aadhaarFile && !formUser.aadhaar_card && <Typography variant="caption" color="text.secondary" display="block">Click to upload (max 1MB)</Typography>}
                </Box>
                <Box component="label" sx={{ flex: 1, border: "2px dashed", borderColor: panFile ? theme.palette.success.main : alpha(theme.palette.divider, 0.2), borderRadius: 2, p: 2, textAlign: "center", cursor: "pointer", transition: "all 0.2s", bgcolor: panFile ? alpha(theme.palette.success.main, 0.05) : "transparent", "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.05), borderColor: theme.palette.primary.main } }}>
                  <input type="file" hidden accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 1024 * 1024) { showToast("File size exceeds 1MB", "warning"); e.target.value = ""; } else setPanFile(f); } }} />
                  <Typography variant="subtitle2" fontWeight={600}>{panFile ? "✓ " + panFile.name : formUser.pan_card ? "✓ PAN Uploaded" : "Upload PAN Card *"}</Typography>
                  {!panFile && !formUser.pan_card && <Typography variant="caption" color="text.secondary" display="block">Click to upload (max 1MB)</Typography>}
                </Box>
              </Stack>

              {formMode === "ADD" && (
                <Alert severity="info" sx={{ alignItems: "center" }}>
                  <Typography variant="body2" fontWeight={500}>Login credentials will be automatically shared via Email or SMS.</Typography>
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setFormDialogOpen(false)} color="inherit">Cancel</Button>
            <Button variant="contained" onClick={handleSaveDistributor} disabled={isSubmitting} sx={{ px: 4, background: isSubmitting ? theme.palette.action.disabledBackground : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)` }}>
              {isSubmitting ? <CircularProgress size={24} color="inherit" /> : formMode === "ADD" ? "Create Distributor" : "Save Changes"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- MAP PICKER DIALOG --- */}
        <Dialog open={mapOpen} onClose={() => setMapOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { height: "80vh" } }}>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
            {activeAddressField === 'shipping' ? 'Select Shipping Location' : 'Select Billing Location'}
            <IconButton onClick={() => setMapOpen(false)} size="small"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column" }}>
            <Box sx={{ p: 2 }}>
              <TextField id="map-search" fullWidth placeholder="Search for a location..." size="small" inputRef={mapSearchRef} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
            </Box>
            <Box id="google-map" sx={{ flex: 1, minHeight: 400 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMapOpen(false)} color="inherit">Cancel</Button>
            <Button variant="contained" onClick={saveLocation}>Save Location</Button>
          </DialogActions>
        </Dialog>

        {/* --- DELETE CONFIRMATION --- */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Archive Distributor?</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to archive <strong>{deleteTarget?.name}</strong>?
              This will set their status to Archived.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={deleteCountdown > 0}
              onClick={confirmDelete}
            >
              {deleteCountdown > 0 ? `Confirm (${deleteCountdown})` : "Confirm Archive"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- SNACKBAR --- */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </>
  );
}

"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  InputAdornment,
  MenuItem,
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
  Grid,
  useTheme,
  alpha,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Autocomplete,
  Switch,
  FormControlLabel,
  Drawer,
  Divider,
  Card,
  CardContent,
  ToggleButtonGroup,
  ToggleButton,
  Badge,
  Menu,
  Popover,
  Link,
  Alert,
  Snackbar,
  CircularProgress
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { SearchIcon, RefreshIcon, AddIcon, EditTwoToneIcon, DeleteTwoToneIcon, VisibilityTwoToneIcon, FilterListIcon, GroupIcon, VerifiedUserIcon, PersonAddIcon, WarningAmberIcon, CloseIcon, ViewModuleIcon, ViewListIcon, ViewKanbanIcon, DashboardIcon, SaveIcon, LocalOfferIcon, PersonIcon, CalendarTodayIcon, EmailIcon, MoreVertIcon, SortIcon, FilterAltIcon, LocationOnIcon, MyLocationIcon, ClearIcon, AddCircleOutlineIcon } from "@/components/icons";
import MapLocationPicker from "@/components/shared/MapLocationPicker";
import AgentDetailModal from "@/components/sales/AgentDetailModal";
import { coreService } from "@/lib/core-service";
import { authService } from "@/lib/auth-service";
import { roleService, RoleRow } from "@/lib/permission-service";
import { formatDRFError } from "@/lib/utils";


// --- KAYSETU ROLES ---
// These are FALLBACK defaults only. The live list of roles (system + custom)
// is fetched from the Role registry API at runtime; see `roleDefs` state and
// the derived maps below. Defaults keep the page usable before that resolves
// or if the request fails.
const DEFAULT_ROLE_TO_SLUG: Record<string, string> = {
  "Admin": "admin",
  "Sales Manager": "sales_manager",
  "Sales Agent": "sales_agent",
  "Warehouse Manager": "warehouse_manager",
  "Purchase Manager": "purchase_manager",
  "Production Manager": "production_manager",
  "Accounts Officer": "accounts_officer",
  "Distributor": "distributor",
};

const DEFAULT_SLUG_TO_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(DEFAULT_ROLE_TO_SLUG).map(([k, v]) => [v, k])
);

const DEFAULT_KAYSETU_ROLES = Object.keys(DEFAULT_ROLE_TO_SLUG);

/** Build the display↔slug maps + label list from the fetched role registry,
 * falling back to the hardcoded defaults for anything not yet loaded. */
function buildRoleMaps(roleDefs: RoleRow[]) {
  const roleToSlug: Record<string, string> = { ...DEFAULT_ROLE_TO_SLUG };
  const slugToRole: Record<string, string> = { ...DEFAULT_SLUG_TO_ROLE };
  for (const r of roleDefs) {
    roleToSlug[r.name] = r.slug;
    slugToRole[r.slug] = r.name;
  }
  // Only assignable (active) roles appear in pickers; keep registry order.
  const kaysetuRoles = roleDefs.length
    ? roleDefs.filter((r) => r.is_active).map((r) => r.name)
    : DEFAULT_KAYSETU_ROLES;
  return { roleToSlug, slugToRole, kaysetuRoles };
}

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

// --- TYPES & MOCK DATA ---
interface User {
  id: number;
  name: string;
  username?: string;
  email: string;
  role: string;
  status: "Active" | "Inactive" | "Archived";
  lastLogin: string;
  phone: string;
  tags?: string[];
  assignedTo?: string;
  assignedAgent?: string;
  createdBy?: string;
  createdAt?: string;
  department?: string;
  region?: string;
  employee_id?: string;
  operating_city?: string;       // raw string from API (may be JSON-encoded array)
  operating_cities?: string[];   // parsed array for UI use
  operating_pincodes?: string[];
  aadhaar_card?: string;
  aadhaar_number?: string;
  pan_card?: string;
  pan_number?: string;
  gst_number?: string;
  shipping_address?: string;
  profile_image?: string;
  latitude?: number;
  longitude?: number;
  home_latitude?: number;
  home_longitude?: number;
  full_address?: string;
}

interface SavedFilter {
  id: number;
  name: string;
  filters: {
    roles: string[];
    statuses: string[];
    tags: string[];
    assignedTo: string;
    createdBy: string;
  };
}

type ViewMode = "dashboard" | "list" | "grid" | "kanban";

const INITIAL_USERS: User[] = [];

// Available Tags Pool
const SALES_ROLES = ["Sales Manager", "Sales Agent", "Distributor"];

const AVAILABLE_TAGS = [
  "Core Team",
  "Management",
  "Field Sales",
  "Northeast",
  "Sales",
  "Operations",
  "Finance",
  "Leadership",
  "New Hire",
  "Production",
  "Quality",
  "Partner",
  "Distribution",
  "VIP",
  "Training",
  "Remote",
];

// --- STAT CARD COMPONENT ---
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
      //
      bgcolor: "background.paper",
      display: "flex",
      alignItems: "center",
      gap: 2,
      border: "none",
      boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
      transition: "transform 0.2s",
      "&:hover": { transform: "translateY(-3px)" },
    }}
  >
    <Avatar
      variant="rounded"
      sx={{
        bgcolor: alpha(color, 0.1),
        color: color,
        width: 54,
        height: 54,
        borderRadius: 1,
      }}
    >
      {icon}
    </Avatar>
    <Box>
      <Typography variant="h4" fontWeight={800} sx={{ color: "text.primary" }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" fontWeight={600}>
        {title}
      </Typography>
    </Box>
  </Paper>
);

// --- MAIN COMPONENT ---
export default function UserManagementPage() {
  const theme = useTheme();

  // --- STATE ---
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live role registry (system + custom). Derived maps drive the role pickers
  // and the display↔slug conversion at the API boundary. A ref mirror lets the
  // mount/save closures read the current maps without stale-closure issues.
  const [roleDefs, setRoleDefs] = useState<RoleRow[]>([]);
  // Label list for the pickers (re-renders on role load); the display↔slug maps
  // are read from the ref below inside fetch/save closures.
  const { kaysetuRoles } = useMemo(() => buildRoleMaps(roleDefs), [roleDefs]);
  const roleMapsRef = useRef(buildRoleMaps([]));
  useEffect(() => {
    roleMapsRef.current = buildRoleMaps(roleDefs);
  }, [roleDefs]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  const showToast = (message: string, severity: "success" | "error" | "info" | "warning" = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  // Fetch the role registry + Users from Backend.
  // Roles load first so the user table can map slugs → display names (incl.
  // custom roles) and the ref the closures read is already populated.
  useEffect(() => {
    const fetchUsers = async () => {
      setIsRefreshing(true);
      try {
        try {
          const roleList = await roleService.list();
          setRoleDefs(roleList);
          roleMapsRef.current = buildRoleMaps(roleList);
        } catch (e) {
          console.error("Failed to load roles (using defaults):", e);
        }
        const response = await coreService.getUsers({ page_size: "1000" });
        // Handle array or paginated results
        const data = Array.isArray(response) ? response : (response as any).results || [];

        const mappedUsers: User[] = data.map((u: any) => {
          const managerId = u.assigned_to ? String(u.assigned_to) : undefined;
          const managerUser = data.find((user: any) => String(user.id) === managerId);
          const creatorId = u.created_by ? String(u.created_by) : undefined;
          const creatorUser = data.find((user: any) => String(user.id) === creatorId);

          return {
            ...u,
            id: u.id,
            name: u.full_name || u.username,
            email: u.email,
            role: roleMapsRef.current.slugToRole[u.role] || u.role,
            status: u.status,
            lastLogin: u.last_login || "Never",
            phone: u.phone || "",
            tags: typeof u.tags === 'string' ? JSON.parse(u.tags) : u.tags || [],
            assignedTo: managerId,
            assignedAgent: u.assigned_agent ? String(u.assigned_agent) : undefined,
            createdBy: creatorId,
            createdAt: u.date_joined,
            department: u.department,
            region: u.region,
            employee_id: u.employee_id,
            operating_city: u.operating_city,
            operating_cities: parseOperatingCities(u.operating_city),
            operating_pincodes: typeof u.operating_pincodes === 'string' ? JSON.parse(u.operating_pincodes) : u.operating_pincodes || [],
            aadhaar_number: u.aadhaar_number || "",
            pan_number: u.pan_number || "",
            latitude: u.latitude,
            longitude: u.longitude,
            home_latitude: u.home_latitude,
            home_longitude: u.home_longitude,
          };
        });
        setUsers(mappedUsers);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setIsRefreshing(false);
      }
    };
    fetchUsers();
  }, []);

  // Operating Cities from Company
  const [operatingCities, setOperatingCities] = useState<string[]>([]);
  const [businessCity, setBusinessCity] = useState<string>("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [addCityOpen, setAddCityOpen] = useState(false);
  const [newCityName, setNewCityName] = useState("");
  const [addingCity, setAddingCity] = useState(false);

  // NEW: Advanced Filters
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [assignedToFilter, setAssignedToFilter] = useState<string>("All");
  const [createdByFilter, setCreatedByFilter] = useState<string>("All");
  const [selectedOperatingCities, setSelectedOperatingCities] = useState<string[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterName, setFilterName] = useState("");

  // NEW: View Mode
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // View & Menu State
  const [viewAnchor, setViewAnchor] = useState<null | HTMLElement>(null);
  const [sortAnchor, setSortAnchor] = useState<null | HTMLElement>(null);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [sortField, setSortField] = useState<
    "name" | "email" | "role" | "status" | "lastLogin" | "createdAt"
  >("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  type FilterRow = {
    field: "id" | "name" | "email" | "role" | "status" | "operating_city";
    operator: "Equals" | "Contains" | "Not Equals";
    value: string;
  };
  const [filterRows, setFilterRows] = useState<FilterRow[]>([]);

  // NEW: Column Customization Modal
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    firstName: false,
    middleName: false,
    lastName: false,
    fullName: true,
    username: false,
    language: false,
    timeZone: false,
    sendWelcomeEmail: false,
    unsubscribed: false,
    roleProfile: false,
    gender: false,
    deskTheme: false,
    phone: true,
    location: false,
    mobileNo: false,
    logoutFromAllDevices: false,
    resetPasswordKey: false,
    sendNotifications: false,
    autoFollowDocuments: false,
    autoFollowLikes: false,
    autoFollowAssigned: false,
    autoFollowShared: false,
    sendEmailThreads: false,
    allowedInMentions: false,
    simultaneousSessions: false,
    userType: false,
    bypassRestrictedIP: false,
    apiKey: false,
  });

  // Modals
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"ADD" | "EDIT">("ADD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<User>>({});

  // View Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);
  // Deep-link: open a user's detail when arriving via ?user=<id>
  const [userDeepLinkDone, setUserDeepLinkDone] = useState(false);
  useEffect(() => {
    if (userDeepLinkDone || users.length === 0 || typeof window === "undefined") return;
    const uid = new URLSearchParams(window.location.search).get("user");
    if (!uid) { setUserDeepLinkDone(true); return; }
    const target = users.find((u) => String(u.id) === uid);
    if (target) {
      const t = target as { name?: string; createdAt?: string };
      setDetailUser({ ...target, full_name: t.name, date_joined: t.createdAt });
      setDetailModalOpen(true);
      setUserDeepLinkDone(true);
    }
  }, [users, userDeepLinkDone]);

  // NEW: Welcome message toggle
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  // Document files state
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  // NEW: Routes dialog
  const [routesDialogOpen, setRoutesDialogOpen] = useState(false);
  const [selectedUserForRoutes, setSelectedUserForRoutes] =
    useState<User | null>(null);

  // Logged-in user — used to hide self-delete (you can't archive your own account).
  const [myUserId, setMyUserId] = useState<number | null>(null);
  useEffect(() => {
    authService.getCurrentUser()
      .then((u) => setMyUserId(u?.id ?? null))
      .catch(() => { /* non-critical */ });
  }, []);

  // Delete Logic
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteTimer, setDeleteTimer] = useState(3);
  const [canConfirmDelete, setCanConfirmDelete] = useState(false);

  // --- FILTER LOGIC (Enhanced) ---
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "All" || user.role === roleFilter;

      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(user.status);

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => user.tags?.includes(tag));

      const matchesAssignedTo =
        assignedToFilter === "All" || user.assignedTo === assignedToFilter;

      const matchesCreatedBy =
        createdByFilter === "All" || user.createdBy === createdByFilter;

      const matchesOperatingCity =
        selectedOperatingCities.length === 0 ||
        (user.operating_cities || []).some((c) => selectedOperatingCities.includes(c));

      // Hide archived users unless explicitly filtered
      const showArchived = selectedStatuses.includes("Archived");
      const isNotArchived = user.status !== "Archived";

      // Apply popover filter rows
      const matchesFilterRows = filterRows.every((row) => {
        const val = (() => {
          switch (row.field) {
            case "id":
              return String(user.id);
            case "name":
              return user.name;
            case "email":
              return user.email;
            case "role":
              return user.role;
            case "operating_city":
              return (user.operating_cities || []).join(", ") || user.operating_city || "";
            case "status":
            default:
              return user.status;
          }
        })().toLowerCase();
        const cmp = row.value.toLowerCase();
        switch (row.operator) {
          case "Equals":
            return val === cmp;
          case "Not Equals":
            return val !== cmp;
          case "Contains":
            return val.includes(cmp);
          default:
            return true;
        }
      });

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus &&
        matchesTags &&
        matchesAssignedTo &&
        matchesCreatedBy &&
        matchesOperatingCity &&
        matchesFilterRows &&
        (isNotArchived || showArchived)
      );
    });
  }, [
    users,
    searchQuery,
    roleFilter,
    selectedStatuses,
    selectedTags,
    assignedToFilter,
    createdByFilter,
    selectedOperatingCities,
    filterRows,
  ]);

  const paginatedUsers = useMemo(() => {
    const sorted = [...filteredUsers].sort((a, b) => {
      const getDate = (u: User) =>
        new Date(u.createdAt || "2024-01-01").getTime();
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortField) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "email":
          av = a.email.toLowerCase();
          bv = b.email.toLowerCase();
          break;
        case "role":
          av = a.role.toLowerCase();
          bv = b.role.toLowerCase();
          break;
        case "status":
          av = a.status.toLowerCase();
          bv = b.status.toLowerCase();
          break;
        case "lastLogin":
          av = a.lastLogin.toLowerCase();
          bv = b.lastLogin.toLowerCase();
          break;
        case "createdAt":
        default:
          av = getDate(a);
          bv = getDate(b);
      }
      const comp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? comp : -comp;
    });
    return sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredUsers, page, rowsPerPage, sortField, sortDir]);

  // Fetch Company Operating Cities
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const company = await coreService.getCurrentCompany();
        setCompanyId(company.id);
        setOperatingCities(company.operating_cities || []);
        setBusinessCity(company.default_operating_city || "");
      } catch (error) {
        console.error("Failed to fetch company data:", error);
      }
    };
    fetchCompanyData();
  }, []);

  const handleAddCity = async () => {
    const city = newCityName.trim();
    if (!city) return;
    if (operatingCities.some((c) => c.toLowerCase() === city.toLowerCase())) {
      showToast(`"${city}" already exists`, "warning");
      return;
    }
    try {
      setAddingCity(true);
      const updatedCities = [...operatingCities, city];
      if (companyId) {
        await coreService.updateCompany(companyId, { operating_cities: updatedCities } as any);
      }
      setOperatingCities(updatedCities);
      setNewCityName("");
      setAddCityOpen(false);
      showToast(`"${city}" added to operating cities`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to add city", "error");
    } finally {
      setAddingCity(false);
    }
  };

  // --- HANDLERS ---
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate API Fetch
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleOpenAdd = () => {
    setDialogMode("ADD");
    setCurrentUser({
      status: "Active",
      role: "Admin",
      tags: [],
      assignedTo: "",
      assignedAgent: "",
      createdBy: "",
      createdAt: new Date().toISOString().split("T")[0],
      operating_city: businessCity,
      operating_cities: businessCity ? [businessCity] : [], // Admin defaults to company city
      operating_pincodes: [],
    });
    setSendWelcomeEmail(true);
    setAadhaarFile(null);
    setPanFile(null);
    setProfileImageFile(null);
    setOpenDialog(true);
  };

  const handleOpenEdit = (user: User) => {
    setDialogMode("EDIT");
    const editCities = SALES_ROLES.includes(user.role)
      ? (user.operating_cities || [])
      : (user.operating_cities?.length ? user.operating_cities : (businessCity ? [businessCity] : []));
    setCurrentUser({ ...user, operating_cities: editCities });
    setAadhaarFile(null);
    setPanFile(null);
    setProfileImageFile(null);
    setOpenDialog(true);
  };

  const [mapOpen, setMapOpen] = useState(false);
  const [homeMapOpen, setHomeMapOpen] = useState(false);
  const [activeAddressField, setActiveAddressField] = useState<'billing' | 'shipping'>('billing');
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [marker, setMarker] = useState<any>(null);
  const mapSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Check if Google is already available on window
    if ((window as any).google?.maps?.places) {
      setGoogleMapsLoaded(true);
      // Ensure style is also present
      if (!document.getElementById("google-maps-pac-style")) {
        const style = document.createElement("style");
        style.id = "google-maps-pac-style";
        style.innerHTML = `
          .pac-container { z-index: 10000 !important; background-color: #fff; border-top: 1px solid #d9d9d9; font-family: Arial, sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin-top: 2px; }
          .pac-item { padding: 8px 10px; cursor: pointer; border-bottom: 1px solid #eee; }
          .pac-item:hover { background-color: #f7f7f7; }
          .pac-item-query { font-size: 14px; color: #333; }
        `;
        document.head.appendChild(style);
      }
      return;
    }

    // 2. Only inject if dialog is open and no script exists yet
    if (openDialog && !googleMapsLoaded) {
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
          style.innerHTML = `
            .pac-container { z-index: 10000 !important; background-color: #fff; border-top: 1px solid #d9d9d9; font-family: Arial, sans-serif; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin-top: 2px; }
            .pac-item { padding: 8px 10px; cursor: pointer; border-bottom: 1px solid #eee; }
            .pac-item:hover { background-color: #f7f7f7; }
            .pac-item-query { font-size: 14px; color: #333; }
          `;
          document.head.appendChild(style);
        }
      };
      document.head.appendChild(script);
    }
  }, [openDialog, googleMapsLoaded]);

  useEffect(() => {
    if (mapOpen && googleMapsLoaded) {
      const interval = setInterval(() => {
        const mapDiv = document.getElementById("google-map");
        const input = mapSearchRef.current;
        if (mapDiv && input) {
          clearInterval(interval);
          const initialPos = {
            lat: Number(currentUser.latitude) || 28.6139,
            lng: Number(currentUser.longitude) || 77.2090
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

          const input = document.getElementById("map-search") as HTMLInputElement;
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
              const addr = place.formatted_address || '';
              if (activeAddressField === 'shipping') {
                setCurrentUser(prev => ({ ...prev, shipping_address: addr }));
              } else {
                setCurrentUser(prev => ({ ...prev, full_address: addr }));
              }
            });
          }

          const geocoder = new (window as any).google.maps.Geocoder();
          const reverseGeocode = (latLng: any) => {
            geocoder.geocode({ location: latLng }, (results: any, status: any) => {
              if (status === "OK" && results?.[0]) {
                const addr = results[0].formatted_address;
                if (activeAddressField === 'shipping') {
                  setCurrentUser(prev => ({ ...prev, shipping_address: addr }));
                } else {
                  setCurrentUser(prev => ({ ...prev, full_address: addr }));
                }
              }
            });
          };

          newMap.addListener("click", (e: any) => {
            newMarker.setPosition(e.latLng);
            reverseGeocode(e.latLng);
          });

          newMarker.addListener("dragend", () => {
            reverseGeocode(newMarker.getPosition());
          });
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [mapOpen, googleMapsLoaded, activeAddressField]);

  const saveLocation = () => {
    if (marker) {
      const pos = marker.getPosition();
      if (pos) {
        setCurrentUser({
          ...currentUser,
          latitude: Number(pos.lat().toFixed(6)),
          longitude: Number(pos.lng().toFixed(6))
        });
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
      setCurrentUser({ ...currentUser, aadhaar_number: raw });
    }
  };

  const handleSaveUser = async () => {
    if (isSubmitting) return;

    // Basic Form Validation
    if (!currentUser.name || currentUser.name.trim() === "") {
      showToast("Full Name is mandatory.", "warning");
      return;
    }
    if (currentUser.name.length > 50) {
      showToast("Full Name cannot exceed 50 characters.", "warning");
      return;
    }
    if (!currentUser.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentUser.email)) {
      showToast("Please provide a valid email address.", "warning");
      return;
    }
    if (!currentUser.phone || currentUser.phone.length !== 10 || !/^\d+$/.test(currentUser.phone)) {
      showToast("Phone number must be exactly 10 digits.", "warning");
      return;
    }
    if (!currentUser.role) {
      showToast("Please assign a role.", "warning");
      return;
    }

    // NEW: Sales Manager Pincode Validation (Mandatory and Unique)
    if (currentUser.role === "Sales Manager") {
      const pins = (currentUser.operating_pincodes || []).filter(p => String(p).trim() !== "");
      if (pins.length === 0) {
        showToast("At least one Operating Pincode is mandatory for Sales Manager.", "warning");
        return;
      }

      // Check if any of these pincodes are already assigned to another Sales Manager
      const otherManagers = users.filter((u) => u.role === "Sales Manager" && u.id !== currentUser.id);

      for (const pin of pins) {
        const conflict = otherManagers.find((m) =>
          m.operating_pincodes?.some(p => String(p).trim() === String(pin).trim())
        );
        if (conflict) {
          showToast(`Pincode ${pin} is already assigned to ${conflict.name}. Each pincode must be unique for Sales Managers.`, "error");
          return;
        }
      }
    }

    // Aadhaar Validation
    if (currentUser.aadhaar_number && currentUser.aadhaar_number.length !== 12) {
      showToast("Aadhaar Number must be 12 digits.", "warning");
      return;
    }

    // PAN Validation
    if (currentUser.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(currentUser.pan_number)) {
      showToast("Invalid PAN Card format. (e.g. ABCDE1234F)", "warning");
      return;
    }

    if (currentUser.role === "Distributor" && (!currentUser.latitude || !currentUser.longitude)) {
      showToast("Location is mandatory for Distributor.", "warning");
      return;
    }

    // Validation for Mandatory Files
    if (dialogMode === "ADD") {
      if (!profileImageFile) {
        showToast("Profile Photo is mandatory.", "warning");
        return;
      }
      if (!aadhaarFile) {
        showToast("Aadhaar Card is mandatory.", "warning");
        return;
      }
      if (!panFile) {
        showToast("PAN Card is mandatory.", "warning");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();

      // Core Identity
      formData.append("full_name", currentUser.name || "");
      // Ensure username is set (fallback to email if username not present in currentUser)
      formData.append("username", currentUser.username || currentUser.email || "");
      if (currentUser.email) formData.append("email", currentUser.email);
      if (currentUser.phone) formData.append("phone", currentUser.phone);

      // Map Frontend Role Label to Backend slug
      const backendRole = roleMapsRef.current.roleToSlug[currentUser.role || ""] || currentUser.role;
      if (backendRole) formData.append("role", backendRole);

      if (currentUser.department) formData.append("department", currentUser.department);
      if (currentUser.status) formData.append("status", currentUser.status);
      if (currentUser.tags && Array.isArray(currentUser.tags)) {
        formData.append("tags", JSON.stringify(currentUser.tags));
      }

      // Sales Specific
      if (currentUser.operating_cities && currentUser.operating_cities.length > 0) {
        formData.append("operating_city", JSON.stringify(currentUser.operating_cities));
      } else if (currentUser.operating_city) {
        formData.append("operating_city", currentUser.operating_city);
      }
      if (currentUser.operating_pincodes && Array.isArray(currentUser.operating_pincodes)) {
        formData.append("operating_pincodes", JSON.stringify(currentUser.operating_pincodes));
      }

      if (currentUser.aadhaar_number) formData.append("aadhaar_number", currentUser.aadhaar_number);
      if (currentUser.pan_number) formData.append("pan_number", currentUser.pan_number);
      if (currentUser.gst_number) formData.append("gst_number", currentUser.gst_number);
      if (currentUser.shipping_address) formData.append("shipping_address", currentUser.shipping_address);
      if (currentUser.latitude) formData.append("latitude", Number(currentUser.latitude).toFixed(6));
      if (currentUser.longitude) formData.append("longitude", Number(currentUser.longitude).toFixed(6));
      if (currentUser.home_latitude) formData.append("home_latitude", Number(currentUser.home_latitude).toFixed(6));
      if (currentUser.home_longitude) formData.append("home_longitude", Number(currentUser.home_longitude).toFixed(6));
      if (currentUser.full_address) formData.append("full_address", currentUser.full_address);

      // For Distributors: send assigned_agent (backend auto-sets assigned_to from agent's manager)
      if (backendRole === "distributor" && currentUser.assignedAgent) {
        const agent = users.find(u => String(u.id) === currentUser.assignedAgent);
        if (agent) {
          formData.append("assigned_agent", String(agent.id));
        }
      } else if (currentUser.assignedTo) {
        // For Sales Agents and other roles: send assigned_to as before
        const manager = users.find(u => u.name === currentUser.assignedTo || String(u.id) === currentUser.assignedTo);
        if (manager) {
          formData.append("assigned_to", String(manager.id));
        }
      }

      // Files
      if (profileImageFile) formData.append("profile_image", profileImageFile);
      if (aadhaarFile) formData.append("aadhaar_card", aadhaarFile);
      if (panFile) formData.append("pan_card", panFile);

      if (dialogMode === "ADD") {
        await coreService.createUser(formData);
        showToast("User created successfully!", "success");
      } else {
        if (currentUser.id) {
          await coreService.updateUser(currentUser.id, formData);
          showToast("User updated successfully!", "success");
        }
      }

      // Refresh Data
      const response = await coreService.getUsers({ page_size: "1000" });
      const data = Array.isArray(response) ? response : (response as any).results || [];
      const mappedUsers: User[] = data.map((u: any) => {
        const managerId = u.assigned_to ? String(u.assigned_to) : undefined;
        const managerUser = data.find((user: any) => String(user.id) === managerId);
        const creatorId = u.created_by ? String(u.created_by) : undefined;
        const creatorUser = data.find((user: any) => String(user.id) === creatorId);

        return {
          ...u,
          id: u.id,
          name: u.full_name || u.username,
          username: u.username,
          email: u.email,
          role: roleMapsRef.current.slugToRole[u.role] || u.role,
          status: u.status,
          lastLogin: u.last_login || "Never",
          phone: u.phone || "",
          tags: typeof u.tags === 'string' ? JSON.parse(u.tags) : u.tags || [],
          assignedTo: managerId,
          assignedAgent: u.assigned_agent ? String(u.assigned_agent) : undefined,
          createdBy: creatorId,
          createdAt: u.date_joined,
          operating_city: u.operating_city,
          operating_cities: parseOperatingCities(u.operating_city),
          operating_pincodes: typeof u.operating_pincodes === 'string' ? JSON.parse(u.operating_pincodes) : u.operating_pincodes || [],
          aadhaar_number: u.aadhaar_number,
          pan_number: u.pan_number,
          gst_number: u.gst_number,
          shipping_address: u.shipping_address,
          latitude: u.latitude,
          longitude: u.longitude,
        };
      });
      setUsers(mappedUsers);
      setOpenDialog(false);
    } catch (e: any) {
      console.error(e);
      const errorMsg = formatDRFError(e);
      showToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // NEW: Save Filter Combination
  const handleSaveFilter = () => {
    if (!filterName.trim()) return;

    const newFilter: SavedFilter = {
      id: savedFilters.length + 1,
      name: filterName,
      filters: {
        roles: roleFilter === "All" ? [] : [roleFilter],
        statuses: selectedStatuses,
        tags: selectedTags,
        assignedTo: assignedToFilter,
        createdBy: createdByFilter,
      },
    };

    setSavedFilters([...savedFilters, newFilter]);
    setFilterName("");
  };

  // NEW: Apply Saved Filter
  const handleApplySavedFilter = (filter: SavedFilter) => {
    setRoleFilter(filter.filters.roles[0] || "All");
    setSelectedStatuses(filter.filters.statuses);
    setSelectedTags(filter.filters.tags);
    setAssignedToFilter(filter.filters.assignedTo);
    setCreatedByFilter(filter.filters.createdBy);
  };

  // NEW: Clear All Filters
  const handleClearFilters = () => {
    setRoleFilter("All");
    setSelectedStatuses([]);
    setSelectedTags([]);
    setAssignedToFilter("All");
    setCreatedByFilter("All");
    setSelectedOperatingCities([]);
    setSearchQuery("");
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
    setDeleteTimer(3);
    setCanConfirmDelete(false);
  };

  // Timer for Delete
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (deleteDialogOpen && deleteTimer > 0) {
      interval = setInterval(() => {
        setDeleteTimer((prev) => prev - 1);
      }, 1000);
    } else if (deleteTimer === 0) {
      setCanConfirmDelete(true);
    }
    return () => clearInterval(interval);
  }, [deleteDialogOpen, deleteTimer]);

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        await coreService.updateUser(userToDelete.id, { status: "Archived" } as any);

        // Refresh
        const response = await coreService.getUsers({ page_size: "1000" });
        const data = Array.isArray(response) ? response : (response as any).results || [];
        const mappedUsers: User[] = data.map((u: any) => ({
          ...u,
          id: u.id,
          name: u.full_name || u.username,
          email: u.email,
          role: u.role,
          status: u.status,
          lastLogin: u.last_login || "Never",
          phone: u.phone || "",
          tags: [],
          assignedTo: u.assigned_to ? String(u.assigned_to) : undefined,
          createdBy: u.created_by ? String(u.created_by) : undefined,
          createdAt: u.date_joined,
          operating_city: u.operating_city,
          operating_cities: parseOperatingCities(u.operating_city),
          operating_pincodes: u.operating_pincodes,
          aadhaar_number: u.aadhaar_number,
          pan_number: u.pan_number,
          gst_number: u.gst_number,
          shipping_address: u.shipping_address,
          latitude: u.latitude,
          longitude: u.longitude,
        }));
        setUsers(mappedUsers);
        setDeleteDialogOpen(false);
      } catch (e: any) {
        console.error("Delete failed", e);
        showToast(formatDRFError(e), "error");
      }
    }
  };

  // Open the View-Details modal for a user (shared by the Eye action and a
  // click on the User column).
  const openUserDetail = (user: User) => {
    setDetailUser({ ...user, full_name: user.name, date_joined: user.createdAt });
    setDetailModalOpen(true);
  };

  // --- HELPERS ---
  const getRoleColor = (role: string) => {
    if (role === "Admin" || role === "MDO") return theme.palette.error.main;
    if (role.includes("Manager")) return theme.palette.primary.main;
    if (role === "Sales Agent") return theme.palette.success.main;
    return theme.palette.secondary.main;
  };

  return (
    <>
      <Box>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* HEADER */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            mb={4}
          >
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
                User Management
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
                <Typography variant="body2" color="text.secondary">Admin</Typography>
                <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "text.disabled" }} />
                <Typography variant="body2" color="text.secondary">Users</Typography>
              </Stack>
            </Box>
            <Stack direction="row" spacing={2} mt={{ xs: 2, md: 0 }}>
              <Tooltip title="Refresh List">
                <IconButton
                  onClick={handleRefresh}
                  sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}
                >
                  <RefreshIcon
                    sx={{
                      animation: isRefreshing ? "spin 1s linear infinite" : "none",
                      "@keyframes spin": {
                        "0%": { transform: "rotate(0deg)" },
                        "100%": { transform: "rotate(360deg)" },
                      },
                    }}
                  />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAdd}
                sx={{
                  px: 3,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
                  textTransform: "none",
                  fontSize: "0.95rem",
                }}
              >
                Add New User
              </Button>
            </Stack>
          </Stack>

          {/* STATS */}
          <Grid container spacing={3} mb={4}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper
                onClick={() => { setSearchQuery(""); setRoleFilter("All"); setSelectedStatuses([]); setPage(0); }}
                sx={{ p: 2, borderRadius: 1, display: "flex", alignItems: "center", gap: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`, cursor: "pointer", transition: "transform 0.2s", "&:hover": { transform: "translateY(-3px)", boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
              >
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main", borderRadius: 2 }}>
                  <GroupIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800}>{users.filter(u => u.status !== "Archived").length}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Users</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper
                onClick={() => { setSearchQuery(""); setRoleFilter("All"); setSelectedStatuses(["Active"]); setPage(0); }}
                sx={{ p: 2, borderRadius: 1, display: "flex", alignItems: "center", gap: 2, border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`, cursor: "pointer", transition: "transform 0.2s", "&:hover": { transform: "translateY(-3px)", boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
              >
                <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: "success.main", borderRadius: 2 }}>
                  <VerifiedUserIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800}>{users.filter(u => u.status === "Active").length}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Active Users</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper
                onClick={() => { setSearchQuery(""); setRoleFilter("All"); setSelectedStatuses(["Inactive"]); setPage(0); }}
                sx={{ p: 2, borderRadius: 1, display: "flex", alignItems: "center", gap: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`, cursor: "pointer", transition: "transform 0.2s", "&:hover": { transform: "translateY(-3px)", boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
              >
                <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: "warning.main", borderRadius: 2 }}>
                  <WarningAmberIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800}>{users.filter(u => u.status === "Inactive").length}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Inactive Users</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper
                sx={{ p: 2, borderRadius: 1, display: "flex", alignItems: "center", gap: 2, border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`, transition: "transform 0.2s", "&:hover": { transform: "translateY(-3px)", boxShadow: "0px 4px 20px rgba(0,0,0,0.05)" } }}
              >
                <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: "info.main", borderRadius: 2 }}>
                  <PersonAddIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800}>{new Set(users.map(u => u.role)).size}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Roles in Use</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* SEARCH & TOOLBAR */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5), border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <TextField
                sx={{ flexGrow: 1 }}
                size="small"
                type="search"
                placeholder="Search by name, email or role..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                name="users-search"
                autoComplete="off"
                // type="search" + these hints stop Chrome/LastPass/1Password/Dashlane
                // from pouring the dialog's email autofill into this search box.
                inputProps={{ autoComplete: "off", "data-lpignore": "true", "data-1p-ignore": "true", "data-form-type": "other" }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2 },
                }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
                  label="Role"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="All">All Roles</MenuItem>
                  {kaysetuRoles.map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedStatuses.length === 1 ? selectedStatuses[0] : "All"}
                  onChange={(e) => { setSelectedStatuses(e.target.value === "All" ? [] : [e.target.value]); setPage(0); }}
                  label="Status"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="All">All Statuses</MenuItem>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Archived">Archived</MenuItem>
                </Select>
              </FormControl>
              <Tooltip title="Clear Filters">
                <Box>
                  <IconButton
                    onClick={() => { setSearchQuery(""); setRoleFilter("All"); setSelectedStatuses([]); setPage(0); }}
                    disabled={searchQuery === "" && roleFilter === "All" && selectedStatuses.length === 0}
                    color="error"
                    sx={{
                      bgcolor: (searchQuery !== "" || roleFilter !== "All" || selectedStatuses.length > 0) ? alpha(theme.palette.error.main, 0.1) : "transparent",
                      "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.2) },
                    }}
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>
              </Tooltip>
            </Stack>
          </Paper>

          {/* TABLE */}
          <TableContainer component={Paper} sx={{ borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, overflow: "hidden" }}>
            <Table>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Last Login</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isRefreshing ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                      <Stack alignItems="center" spacing={2}>
                        <GroupIcon sx={{ fontSize: 60, color: "text.disabled", opacity: 0.5 }} />
                        <Box>
                          <Typography variant="h6" color="text.secondary" gutterBottom>No users found</Typography>
                          <Typography variant="body2" color="text.secondary">Try adjusting your filters or add a new user.</Typography>
                        </Box>
                        <Button
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => { setDialogMode("ADD"); setCurrentUser({}); setOpenDialog(true); }}
                        >
                          Add New User
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : paginatedUsers.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell
                      onClick={() => openUserDetail(user)}
                      data-testid={`user-row-view-${user.id}`}
                      sx={{ cursor: "pointer", "&:hover .user-name": { color: "primary.main" } }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          src={user.profile_image || undefined}
                          variant="rounded"
                          sx={{ width: 44, height: 44, bgcolor: alpha(getRoleColor(user.role), 0.1), color: getRoleColor(user.role), fontWeight: 700, borderRadius: "10px" }}
                        >
                          {user.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography className="user-name" variant="subtitle2" fontWeight={700} sx={{ transition: "color 0.15s" }}>{user.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.role}
                        size="small"
                        sx={{ bgcolor: alpha(getRoleColor(user.role), 0.1), color: getRoleColor(user.role), fontWeight: 700, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.status.toUpperCase()}
                        size="small"
                        variant="outlined"
                        color={user.status === "Active" ? "success" : user.status === "Archived" ? "warning" : "default"}
                        sx={{ fontWeight: 600, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.lastLogin !== "Never"
                          ? new Date(user.lastLogin).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "Never"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            data-testid={`user-view-btn-${user.id}`}
                            onClick={() => openUserDetail(user)}
                            sx={{ color: "success.main", "&:hover": { bgcolor: alpha(theme.palette.success.main, 0.1) } }}
                          >
                            <VisibilityTwoToneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenEdit(user)} color="primary">
                            <EditTwoToneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {user.id !== myUserId && (
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => handleDeleteClick(user)} color="error" data-testid={`users-delete-btn-${user.id}`}>
                              <DeleteTwoToneIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredUsers.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          </TableContainer>
        </motion.div>

        {/* --- ADD / EDIT DIALOG --- */}
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { p: 1 } }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 700,
            }}
          >
            {dialogMode === "ADD" ? "Create New User" : "Edit User Details"}
            <IconButton onClick={() => setOpenDialog(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {/* component="form" scopes browser autofill to THIS dialog so the
                email/phone fields can't spill into the page's top search box. */}
            <Stack component="form" autoComplete="off" onSubmit={(e) => e.preventDefault()} spacing={3} sx={{ mt: 1 }}>
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
                          showToast("Max file size 1MB", "warning");
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
                          : typeof currentUser.profile_image === 'string' ? currentUser.profile_image : undefined
                      }
                      sx={{
                        width: 80,
                        height: 80,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        mb: 2,
                      }}
                    >
                      {!profileImageFile && !currentUser.profile_image && <AddIcon fontSize="large" />}
                    </Avatar>
                    <Typography variant="body1" fontWeight={600} align="center">
                      {profileImageFile
                        ? "✓ Photo Selected"
                        : currentUser.profile_image
                          ? "✓ Photo Uploaded"
                          : "Upload Profile Photo *"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" align="center">
                      {profileImageFile
                        ? profileImageFile.name
                        : currentUser.profile_image
                          ? "Current Photo"
                          : "PNG, JPG max 1MB"}
                    </Typography>
                  </Box>

                  {/* Operating City Multi-select */}
                  {(() => {
                    const inlineSelectedManager = currentUser.role === "Sales Agent" && currentUser.assignedTo
                      ? users.find((u) => String(u.id) === currentUser.assignedTo && u.role === "Sales Manager")
                      : null;
                    const inlineSelectedAgent = currentUser.role === "Distributor" && currentUser.assignedAgent
                      ? users.find((u) => String(u.id) === currentUser.assignedAgent && u.role === "Sales Agent")
                      : null;
                    const inlineCityOptions =
                      currentUser.role === "Sales Agent"
                        ? (inlineSelectedManager ? parseOperatingCities(inlineSelectedManager.operating_city) : [])
                        : currentUser.role === "Distributor"
                          ? (inlineSelectedAgent ? parseOperatingCities(inlineSelectedAgent.operating_city) : [])
                          : operatingCities;
                    return (
                      <Autocomplete
                        multiple
                        options={inlineCityOptions}
                        value={currentUser.operating_cities || []}
                        onChange={(_, newValue) =>
                          setCurrentUser({
                            ...currentUser,
                            operating_cities: newValue,
                            operating_city: JSON.stringify(newValue),
                          })
                        }
                        disabled={
                          !(SALES_ROLES.includes(currentUser.role || "") || currentUser.role === "Admin") ||
                          (currentUser.role === "Sales Agent" && !currentUser.assignedTo) ||
                          (currentUser.role === "Distributor" && !currentUser.assignedAgent)
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
                              currentUser.role === "Sales Agent" && !currentUser.assignedTo
                                ? "Select a manager first..."
                                : currentUser.role === "Distributor" && !currentUser.assignedAgent
                                  ? "Select an agent first..."
                                  : (currentUser.operating_cities || []).length === 0
                                    ? "Select cities..."
                                    : ""
                            }
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {params.InputProps.endAdornment}
                                  <Tooltip title="Add New City">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); setAddCityOpen(true); }}
                                      sx={{ color: theme.palette.primary.main, p: 0.5 }}
                                    >
                                      <AddCircleOutlineIcon sx={{ fontSize: 20 }} />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                    );
                  })()}

                  <Autocomplete
                    multiple
                    options={AVAILABLE_TAGS}
                    value={currentUser.tags || []}
                    onChange={(e, newValue) =>
                      setCurrentUser({ ...currentUser, tags: newValue })
                    }
                    freeSolo
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option}
                          {...getTagProps({ index })}
                          size="small"
                          key={option}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tags"
                        placeholder="Add tags..."
                      />
                    )}
                  />
                </Stack>

                {/* RIGHT: Form Inputs */}
                <Stack spacing={2} sx={{ flex: 1, width: "100%" }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <TextField
                      id="form-user-full-name"
                      name="full_name"
                      label="Full Name *"
                      fullWidth={!["Sales Manager", "Sales Agent", "Distributor"].includes(currentUser.role || "")}
                      sx={{ flex: 1 }}
                      value={currentUser.name || ""}
                      onChange={(e) =>
                        setCurrentUser({ ...currentUser, name: e.target.value.slice(0, 50) })
                      }
                      autoComplete="off"
                      inputProps={{ maxLength: 50 }}
                      helperText={`${currentUser.name?.length || 0}/50 characters`}
                    />
                    {currentUser.role === "Sales Manager" && (
                      <Box sx={{ flex: 1 }}>
                        <Autocomplete
                          multiple
                          freeSolo
                          options={[]}
                          value={currentUser.operating_pincodes || []}
                          onChange={(event, newValue) => {
                            const rawValues = newValue as string[];
                            const processedValues: string[] = [];
                            let hasError = false;
                            let hasDuplicate = false;

                            for (const val of rawValues) {
                              // Ensure numeric only
                              const numeric = val.replace(/\D/g, "");
                              if (numeric !== val) {
                                hasError = true;
                              }

                              if (numeric) {
                                if (processedValues.includes(numeric)) {
                                  hasDuplicate = true;
                                } else {
                                  processedValues.push(numeric);
                                }
                              }
                            }

                            if (hasError) {
                              showToast("Pincodes must be numeric only.", "warning");
                            }
                            if (hasDuplicate) {
                              showToast("Duplicate pincode detected!", "warning");
                            }

                            setCurrentUser({
                              ...currentUser,
                              operating_pincodes: processedValues
                            });
                          }}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                label={option}
                                {...getTagProps({ index })}
                                key={option}
                              />
                            ))
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Operating Pincodes *"
                              placeholder="Add pincodes"
                            />
                          )}
                        />
                      </Box>
                    )}
                    {currentUser.role === "Sales Agent" && (
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Box sx={{ flex: 1 }}>
                            {(() => {
                              const allManagers = users.filter((u) => u.role === "Sales Manager" && u.status === "Active");
                              return allManagers.length > 0 ? (
                                <FormControl fullWidth>
                                  <InputLabel>Assigned To (Manager)</InputLabel>
                                  <Select
                                    value={currentUser.assignedTo || ""}
                                    onChange={(e) => {
                                      const mgr = allManagers.find((u) => String(u.id) === e.target.value);
                                      setCurrentUser({
                                        ...currentUser,
                                        assignedTo: e.target.value,
                                        operating_cities: mgr ? parseOperatingCities(mgr.operating_city) : [],
                                        operating_city: mgr ? mgr.operating_city || "" : "",
                                      });
                                    }}
                                    input={<OutlinedInput label="Assigned To (Manager)" />}
                                  >
                                    {allManagers.map((manager) => (
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
                                  sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'text.disabled', color: 'text.disabled' } }}
                                />
                              );
                            })()}
                          </Box>
                        </Stack>
                        {/* Home location — used by the Travel Allowance office-vs-home distance basis. */}
                        <Box sx={{ mt: 1.5 }}>
                          <TextField
                            fullWidth
                            label="Home Location (Travel Allowance)"
                            value={
                              currentUser.home_latitude && currentUser.home_longitude
                                ? `Lat ${Number(currentUser.home_latitude).toFixed(5)}, Lng ${Number(currentUser.home_longitude).toFixed(5)}`
                                : ""
                            }
                            placeholder="Not set — used to compute office-basis allowance"
                            InputProps={{ readOnly: true }}
                            helperText="Set the agent's home point so 'office' basis can deduct the home↔office commute."
                            data-testid="user-home-location-field"
                            onClick={() => setHomeMapOpen(true)}
                          />
                          <Button
                            size="small"
                            startIcon={<MyLocationIcon />}
                            sx={{ mt: 0.5 }}
                            onClick={() => setHomeMapOpen(true)}
                            data-testid="user-home-location-btn"
                          >
                            {currentUser.home_latitude ? "Change home location" : "Set home location"}
                          </Button>
                        </Box>
                      </Box>
                    )}
                    {currentUser.role === "Distributor" && (
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Box sx={{ flex: 1 }}>
                            {(() => {
                              const allAgents = users.filter((u) => u.role === "Sales Agent" && u.status === "Active");
                              return allAgents.length > 0 ? (
                                <FormControl fullWidth>
                                  <InputLabel>Assigned Agent</InputLabel>
                                  <Select
                                    value={currentUser.assignedAgent || ""}
                                    onChange={(e) => {
                                      const agt = allAgents.find((u) => String(u.id) === e.target.value);
                                      setCurrentUser({
                                        ...currentUser,
                                        assignedAgent: e.target.value,
                                        operating_cities: agt ? parseOperatingCities(agt.operating_city) : [],
                                        operating_city: agt ? agt.operating_city || "" : "",
                                      });
                                    }}
                                    input={<OutlinedInput label="Assigned Agent" />}
                                  >
                                    {allAgents.map((agent) => (
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
                                  sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'text.disabled', color: 'text.disabled' } }}
                                />
                              );
                            })()}
                          </Box>
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                  {currentUser.role === "Distributor" && (
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box sx={{ flex: 1, position: 'relative' }}>
                        <TextField
                          label="Billing Address *"
                          fullWidth
                          multiline
                          rows={2}
                          value={currentUser.full_address || ""}
                          onChange={(e) => setCurrentUser({ ...currentUser, full_address: e.target.value })}
                          placeholder="Pick from map or enter manually..."
                        />
                        <Tooltip title="Pick Billing Address from Map">
                          <IconButton
                            size="small"
                            color={currentUser.full_address ? "success" : "primary"}
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
                          value={currentUser.shipping_address || ""}
                          onChange={(e) => setCurrentUser({ ...currentUser, shipping_address: e.target.value })}
                          placeholder="If different from billing address..."
                        />
                        <Tooltip title="Pick Shipping Address from Map">
                          <IconButton
                            size="small"
                            color={currentUser.shipping_address ? "success" : "primary"}
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
                      id="form-user-email"
                      name="user_email"
                      label="Email Address *"
                      fullWidth
                      type="email"
                      value={currentUser.email || ""}
                      onChange={(e) =>
                        setCurrentUser({ ...currentUser, email: e.target.value })
                      }
                      autoComplete="off"
                    />
                    <TextField
                      id="form-user-phone"
                      name="user_phone"
                      label="Phone Number *"
                      fullWidth
                      value={currentUser.phone || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setCurrentUser({ ...currentUser, phone: val });
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
                      value={formatAadhaar(currentUser.aadhaar_number || "")}
                      onChange={handleAadhaarChange}
                      placeholder="XXXX XXXX XXXX"
                      inputProps={{ maxLength: 14 }}
                      helperText="12 digit numeric"
                    />
                    <TextField
                      label="PAN Card Number"
                      fullWidth
                      value={currentUser.pan_number || ""}
                      onChange={(e) => setCurrentUser({ ...currentUser, pan_number: e.target.value.toUpperCase().slice(0, 10) })}
                      placeholder="ABCDE1234F"
                      inputProps={{ maxLength: 10 }}
                      helperText="Format: ABCDE1234F"
                    />
                    {currentUser.role === "Distributor" && (
                      <TextField
                        label="GST Number (GSTIN)"
                        fullWidth
                        value={currentUser.gst_number || ""}
                        onChange={(e) => setCurrentUser({ ...currentUser, gst_number: e.target.value.toUpperCase().slice(0, 15) })}
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
                        value={currentUser.role || ""}
                        onChange={(e) => {
                          const newRole = e.target.value;
                          const isSales = SALES_ROLES.includes(newRole);
                          setCurrentUser({
                            ...currentUser,
                            role: newRole,
                            operating_cities: isSales
                              ? (currentUser.operating_cities || [])
                              : (businessCity ? [businessCity] : []),
                            operating_city: isSales ? currentUser.operating_city : businessCity,
                            assignedTo: isSales ? currentUser.assignedTo : "",
                            assignedAgent: isSales ? currentUser.assignedAgent : "",
                          });
                        }}
                        input={<OutlinedInput label="Assign Role" />}
                      >
                        {kaysetuRoles.map((role) => (
                          <MenuItem key={role} value={role}>
                            {role}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={currentUser.status || ""}
                        onChange={(e) =>
                          setCurrentUser({
                            ...currentUser,
                            status: e.target.value as any,
                          })
                        }
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
                    borderColor: aadhaarFile
                      ? theme.palette.success.main
                      : alpha(theme.palette.divider, 0.2),
                    borderRadius: 2,
                    p: 2,
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    bgcolor: aadhaarFile
                      ? alpha(theme.palette.success.main, 0.05)
                      : "transparent",
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
                          showToast("File size exceeds 1MB", "warning");
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
                      : currentUser.aadhaar_card
                        ? "✓ Aadhaar Uploaded"
                        : "Upload Aadhaar Card *"}
                  </Typography>
                  {!aadhaarFile && !currentUser.aadhaar_card && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Click to upload (max 1MB)
                    </Typography>
                  )}
                </Box>

                <Box
                  component="label"
                  sx={{
                    flex: 1,
                    border: "2px dashed",
                    borderColor: panFile
                      ? theme.palette.success.main
                      : alpha(theme.palette.divider, 0.2),
                    borderRadius: 2,
                    p: 2,
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    bgcolor: panFile
                      ? alpha(theme.palette.success.main, 0.05)
                      : "transparent",
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
                          showToast("File size exceeds 1MB", "warning");
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
                      : currentUser.pan_card
                        ? "✓ PAN Uploaded"
                        : "Upload PAN Card *"}
                  </Typography>
                  {!panFile && !currentUser.pan_card && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Click to upload (max 1MB)
                    </Typography>
                  )}
                </Box>
              </Stack>

              {dialogMode === "ADD" && (
                <Alert severity="info" sx={{ mt: 2, alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight={500}>
                    Login credentials will be automatically shared via Email or SMS.
                  </Typography>
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setOpenDialog(false)}
              color="inherit"
            // sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveUser}
              disabled={isSubmitting}
              sx={{
                // borderRadius: 2,
                px: 4,
                background: isSubmitting
                  ? theme.palette.action.disabledBackground
                  : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                position: 'relative',
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                dialogMode === "ADD" ? "Create User" : "Save Changes"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- DELETE DIALOG WITH TIMER --- */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => {
            if (!canConfirmDelete) setDeleteDialogOpen(false);
          }}
          PaperProps={{ sx: { p: 2, minWidth: 320 } }}
        >
          <Box sx={{ textAlign: "center", pt: 2 }}>
            <Box
              sx={{
                bgcolor: alpha(theme.palette.error.main, 0.1),
                width: 60,
                height: 60,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <WarningAmberIcon sx={{ fontSize: 32, color: "error.main" }} />
            </Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Delete User?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
              Are you sure you want to delete <b>{userToDelete?.name}</b>?{" "}
              <br /> This action cannot be undone.
            </Typography>

            <Box sx={{ mt: 3, px: 4 }}>
              {!canConfirmDelete ? (
                <>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={600}
                  >
                    Confirm in {deleteTimer}s
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={((3 - deleteTimer) / 3) * 100}
                    color="error"
                    sx={{ mt: 1, height: 6 }}
                  />
                </>
              ) : (
                <Typography variant="caption" color="error" fontWeight={700}>
                  You can now delete this user.
                </Typography>
              )}
            </Box>
          </Box>
          <DialogActions sx={{ justifyContent: "center", pb: 2, mt: 2 }}>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              color="inherit"
            // sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={confirmDelete}
              disabled={!canConfirmDelete}
            // sx={{ borderRadius: 2, px: 3 }}
            >
              Delete User
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- ADVANCED FILTER DRAWER --- */}
        <Drawer
          anchor="right"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          PaperProps={{
            sx: { width: { xs: "100%", sm: 420 }, p: 3 },
          }}
        >
          <Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              mb={3}
            >
              <Typography variant="h6" fontWeight={700}>
                Advanced Filters
              </Typography>
              <IconButton
                onClick={() => setFilterDrawerOpen(false)}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Stack>

            <Stack spacing={3}>
              {/* Status Filter */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
                  Status
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  {["Active", "Inactive", "Pending"].map((status) => (
                    <Chip
                      key={status}
                      label={status}
                      onClick={() => {
                        setSelectedStatuses((prev) =>
                          prev.includes(status)
                            ? prev.filter((s) => s !== status)
                            : [...prev, status]
                        );
                      }}
                      color={
                        selectedStatuses.includes(status)
                          ? "primary"
                          : "default"
                      }
                      variant={
                        selectedStatuses.includes(status)
                          ? "filled"
                          : "outlined"
                      }
                    />
                  ))}
                </Stack>
              </Box>

              {/* Role Filter */}
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  input={<OutlinedInput label="Role" />}
                >
                  <MenuItem value="All">All Roles</MenuItem>
                  {kaysetuRoles.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Tags Filter */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
                  Tags
                </Typography>
                <Autocomplete
                  multiple
                  options={AVAILABLE_TAGS}
                  value={selectedTags}
                  onChange={(e, newValue) => setSelectedTags(newValue)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        label={option}
                        {...getTagProps({ index })}
                        size="small"
                        icon={<LocalOfferIcon />}
                        key={option}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select tags..."
                      size="small"
                    />
                  )}
                />
              </Box>

              {/* Created By Filter */}
              <FormControl fullWidth>
                <InputLabel>Created By</InputLabel>
                <Select
                  value={createdByFilter}
                  onChange={(e) => setCreatedByFilter(e.target.value)}
                  input={<OutlinedInput label="Created By" />}
                >
                  <MenuItem value="All">All Users</MenuItem>
                  {Array.from(new Set(users.map((u) => u.createdBy))).map(
                    (name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    )
                  )}
                </Select>
              </FormControl>

              <Divider />

              {/* Save Filter Section */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
                  Save Filter Combination
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    placeholder="Filter name..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveFilter}
                    disabled={!filterName.trim()}
                  >
                    Save
                  </Button>
                </Stack>
              </Box>

              {/* Saved Filters List */}
              {savedFilters.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
                    Saved Filters ({savedFilters.length})
                  </Typography>
                  <Stack spacing={1}>
                    {savedFilters.map((filter) => (
                      <Card key={filter.id} variant="outlined">
                        <CardContent
                          sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" fontWeight={600}>
                              {filter.name}
                            </Typography>
                            <Button
                              size="small"
                              onClick={() => handleApplySavedFilter(filter)}
                            >
                              Apply
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>

            <Stack direction="row" spacing={2} mt={4}>
              <Button fullWidth variant="outlined" onClick={handleClearFilters}>
                Clear All
              </Button>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setFilterDrawerOpen(false)}
              >
                Apply Filters
              </Button>
            </Stack>
          </Box>
        </Drawer>

        {/* --- COLUMN CUSTOMIZATION MODAL --- */}
        <Dialog
          open={columnModalOpen}
          onClose={() => setColumnModalOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { p: 2 } }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 700,
              pb: 2,
            }}
          >
            Customize Columns
            <IconButton onClick={() => setColumnModalOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              {[
                { key: "firstName", label: "First Name" },
                { key: "middleName", label: "Middle Name" },
                { key: "lastName", label: "Last Name" },
                { key: "fullName", label: "Full Name" },
                { key: "username", label: "Username" },
                { key: "language", label: "Language" },
                { key: "timeZone", label: "Time Zone" },
                { key: "sendWelcomeEmail", label: "Send Welcome Email" },
                { key: "unsubscribed", label: "Unsubscribed" },
                { key: "roleProfile", label: "Role Profile" },
                { key: "gender", label: "Gender" },
                { key: "deskTheme", label: "Desk Theme" },
                { key: "phone", label: "Phone" },
                { key: "location", label: "Location" },
                { key: "mobileNo", label: "Mobile No" },
                {
                  key: "logoutFromAllDevices",
                  label: "Logout From All Devices After Changing Password",
                },
                { key: "resetPasswordKey", label: "Reset Password Key" },
                {
                  key: "sendNotifications",
                  label: "Send Notifications For Documents Followed By Me",
                },
                {
                  key: "autoFollowDocuments",
                  label: "Auto follow documents that you create",
                },
                {
                  key: "autoFollowLikes",
                  label: "Auto follow documents that you Like",
                },
                {
                  key: "autoFollowAssigned",
                  label: "Auto follow documents that are assigned to you",
                },
                {
                  key: "autoFollowShared",
                  label: "Auto follow documents that are shared with you",
                },
                {
                  key: "sendEmailThreads",
                  label: "Send Notifications For Email Threads",
                },
                { key: "allowedInMentions", label: "Allowed In Mentions" },
                { key: "simultaneousSessions", label: "Simultaneous Sessions" },
                { key: "userType", label: "User Type" },
                {
                  key: "bypassRestrictedIP",
                  label:
                    "Bypass Restricted IP Address Check If Two Factor Auth Enabled",
                },
                { key: "apiKey", label: "API Key" },
              ].map((col) => (
                <FormControlLabel
                  key={col.key}
                  control={
                    <Switch
                      checked={
                        visibleColumns[col.key as keyof typeof visibleColumns]
                      }
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [col.key]: e.target.checked,
                        }))
                      }
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                      {col.label}
                    </Typography>
                  }
                />
              ))}
            </Box>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setColumnModalOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => setColumnModalOpen(false)}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              }}
            >
              Apply
            </Button>
          </DialogActions>
        </Dialog>

        {/* --- USER DETAIL DIALOG --- */}
        <Dialog
          open={routesDialogOpen}
          onClose={() => setRoutesDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          {selectedUserForRoutes && (() => {
            const u = selectedUserForRoutes;
            const assignedManager = u.assignedTo ? users.find(x => String(x.id) === u.assignedTo) : null;
            const assignedAgent = u.assignedAgent ? users.find(x => String(x.id) === u.assignedAgent) : null;
            const createdByUser = u.createdBy ? users.find(x => String(x.id) === u.createdBy) : null;

            // Only show a field if it has a real value
            const fields: { label: string; value: React.ReactNode }[] = [];
            if (u.username) fields.push({ label: "Username", value: u.username });
            if (u.email) fields.push({ label: "Email", value: u.email });
            if (u.phone) fields.push({ label: "Phone", value: u.phone });
            if (u.employee_id) fields.push({ label: "Employee ID", value: u.employee_id });
            if (u.department) fields.push({ label: "Department", value: u.department });
            if (u.region) fields.push({ label: "Region", value: u.region });
            if (u.full_address) fields.push({ label: "Address", value: u.full_address });
            if (u.operating_cities && u.operating_cities.length > 0) fields.push({ label: "Operating Cities", value: u.operating_cities.join(", ") });
            if (u.operating_pincodes && u.operating_pincodes.length > 0) fields.push({ label: "Pincodes", value: u.operating_pincodes.join(", ") });
            if (assignedManager) fields.push({ label: "Assigned Manager", value: assignedManager.name });
            if (assignedAgent) fields.push({ label: "Assigned Agent", value: assignedAgent.name });
            if (createdByUser) fields.push({ label: "Created By", value: createdByUser.name });
            if (u.createdAt) fields.push({ label: "Joined On", value: new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) });
            if (u.lastLogin && u.lastLogin !== "Never") fields.push({ label: "Last Login", value: new Date(u.lastLogin).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) });
            if (u.tags && u.tags.length > 0) fields.push({ label: "Tags", value: u.tags.join(", ") });
            if (u.aadhaar_number) fields.push({ label: "Aadhaar", value: u.aadhaar_number });
            if (u.pan_number) fields.push({ label: "PAN", value: u.pan_number });
            if (u.gst_number) fields.push({ label: "GSTIN", value: u.gst_number });
            if (u.shipping_address) fields.push({ label: "Shipping Address", value: u.shipping_address });

            return (
              <>
                <DialogTitle sx={{ p: 0 }}>
                  {/* Header band */}
                  <Box sx={{ bgcolor: alpha(getRoleColor(u.role), 0.08), px: 3, pt: 3, pb: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar
                        src={u.profile_image || undefined}
                        variant="rounded"
                        sx={{ width: 60, height: 60, bgcolor: alpha(getRoleColor(u.role), 0.15), color: getRoleColor(u.role), fontWeight: 700, fontSize: "1.5rem", borderRadius: "12px" }}
                      >
                        {u.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" fontWeight={800} lineHeight={1.2}>{u.name}</Typography>
                        <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
                          <Chip label={u.role} size="small" sx={{ bgcolor: alpha(getRoleColor(u.role), 0.15), color: getRoleColor(u.role), fontWeight: 700, fontSize: "0.65rem" }} />
                          <Chip
                            label={u.status.toUpperCase()}
                            size="small"
                            variant="outlined"
                            color={u.status === "Active" ? "success" : u.status === "Archived" ? "warning" : "default"}
                            sx={{ fontWeight: 600, fontSize: "0.65rem" }}
                          />
                        </Stack>
                      </Box>
                    </Stack>
                    <IconButton onClick={() => setRoutesDialogOpen(false)} size="small">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </DialogTitle>

                <DialogContent sx={{ px: 3, py: 2 }}>
                  {fields.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                      No additional details available for this user.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                      {fields.map(({ label, value }, i) => (
                        <Box
                          key={label}
                          sx={{
                            py: 1.5,
                            px: 1,
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                            gridColumn: label === "Address" || label === "Tags" || label === "Operating Cities" ? "1 / -1" : undefined,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 0.25, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.5px" }}>
                            {label}
                          </Typography>
                          <Typography variant="body2" fontWeight={500} color="text.primary">
                            {value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </DialogContent>

                <Divider />
                <DialogActions sx={{ px: 3, py: 1.5 }}>
                  <Button onClick={() => { setRoutesDialogOpen(false); handleOpenEdit(u); }} startIcon={<EditTwoToneIcon />}>
                    Edit User
                  </Button>
                  <Button onClick={() => setRoutesDialogOpen(false)} variant="contained" sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)` }}>
                    Close
                  </Button>
                </DialogActions>
              </>
            );
          })()}
        </Dialog>

        {/* --- MAP DIALOG --- */}
        <Dialog open={mapOpen} onClose={() => setMapOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {activeAddressField === 'shipping' ? 'Select Shipping Location' : 'Select Billing Location'}
            <IconButton onClick={() => setMapOpen(false)} size="small"><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ minHeight: 450, position: 'relative', p: 0 }}>
            <Box sx={{ p: 2, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, bgcolor: 'transparent' }}>
              <TextField
                fullWidth
                inputRef={mapSearchRef}
                id="map-search"
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
            <Box id="google-map" sx={{ width: '100%', height: 450 }} />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ flex: 1, ml: 1 }}>
              {currentUser.latitude ? `Lat: ${Number(currentUser.latitude).toFixed(4)}, Lng: ${Number(currentUser.longitude).toFixed(4)}` : 'Click on map or drag marker'}
            </Typography>
            <Button onClick={() => setMapOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={saveLocation} startIcon={<MyLocationIcon />}>Confirm Location</Button>
          </DialogActions>
        </Dialog>

        {/* --- HOME LOCATION PICKER (Travel Allowance) --- */}
        <MapLocationPicker
          open={homeMapOpen}
          onClose={() => setHomeMapOpen(false)}
          initialLat={currentUser.home_latitude ? Number(currentUser.home_latitude) : undefined}
          initialLng={currentUser.home_longitude ? Number(currentUser.home_longitude) : undefined}
          onConfirm={(loc) => {
            setCurrentUser({ ...currentUser, home_latitude: loc.lat, home_longitude: loc.lng });
            setHomeMapOpen(false);
          }}
        />

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>

      {/* User Detail Modal */}
      <AgentDetailModal
        open={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setDetailUser(null); }}
        agent={detailUser}
        onEdit={detailUser ? () => { setDetailModalOpen(false); handleOpenEdit(detailUser); } : undefined}
        onDelete={detailUser && detailUser.id !== myUserId ? () => { setDetailModalOpen(false); handleDeleteClick(detailUser); } : undefined}
      />

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

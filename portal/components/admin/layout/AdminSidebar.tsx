"use client";
import BaseSidebar, { MenuItemType } from "@/components/layout/BaseSidebar";

// Icons migrated to the central animated-icon barrel (@animateicons/react + lucide).
// Usage is unchanged — only the import source differs. See components/icons/.
import {
  DashboardIcon, GroupIcon, DomainIcon, Inventory2Icon, CategoryIcon, SupportAgentIcon,
  LocalShippingIcon, BarChartIcon, HistoryIcon, ReceiptIcon, NotificationsIcon, AdminPanelSettingsIcon,
  FilterAltIcon, ShoppingCartIcon, StoreIcon, AssessmentIcon, AssignmentIcon, DescriptionIcon,
  MoveToInboxIcon, CompareArrowsIcon, CalendarMonthIcon, EngineeringIcon, AssignmentIndIcon,
  AccountTreeIcon, AddBoxIcon, ListAltIcon, NoteAddIcon, MenuBookIcon, ReceiptLongIcon, BadgeIcon,
  SystemUpdateIcon, LocationOnIcon, LockPersonIcon, CommuteIcon, WarehouseIcon, PaletteIcon,
  GridViewIcon,
} from "@/components/icons";

const adminMenuItems: MenuItemType[] = [
  { text: "Overview", icon: <DashboardIcon />, path: "/admin", section: "Main", moduleKey: "admin_dashboard" },
  { text: "Reports & Analytics", icon: <BarChartIcon />, path: "/admin/reports", moduleKey: "admin_reports" },
  { text: "Company Settings", icon: <DomainIcon />, path: "/company", moduleKey: "company_settings" },
  { text: "Appearance", icon: <PaletteIcon />, path: "/config/appearance", moduleKey: "company_settings" },
  { text: "Attendance", icon: <BadgeIcon />, path: "/admin/attendance", moduleKey: "attendance" },
  { text: "Tracking Health", icon: <LocationOnIcon />, path: "/admin/tracking-health", moduleKey: "tracking_health" },
  { text: "Logs", icon: <HistoryIcon />, path: "/admin/logs", moduleKey: "logs" },
  { text: "All Users", icon: <GroupIcon />, path: "/users", section: "People", moduleKey: "users" },
  { text: "All Agents", icon: <AssignmentIndIcon />, path: "/sales-team", moduleKey: "sales_team" },
  { text: "Distributors", icon: <LocalShippingIcon />, path: "/distributors", moduleKey: "distributors" },
  { text: "All Customers", icon: <StoreIcon />, path: "/customers", moduleKey: "customers" },
  { text: "Suppliers", icon: <WarehouseIcon />, path: "/suppliers", moduleKey: "suppliers" },
  {
    text: "Master Setup", icon: <Inventory2Icon />, section: "Configuration",
    children: [
      { text: "Raw Material", path: "/items", icon: <CategoryIcon fontSize="small" />, moduleKey: "items" },
      { text: "Product Master", path: "/products", icon: <Inventory2Icon fontSize="small" />, moduleKey: "products" },
      { text: "Customer Master", path: "/customers", icon: <SupportAgentIcon fontSize="small" />, moduleKey: "customers" },
      { text: "Supplier Master", path: "/suppliers", icon: <LocalShippingIcon fontSize="small" />, moduleKey: "suppliers" },
      { text: "Taxes", path: "/taxes", icon: <ReceiptIcon fontSize="small" />, moduleKey: "taxes" },
      { text: "Permission Matrix", path: "/permissions", icon: <LockPersonIcon fontSize="small" />, moduleKey: "permissions" },
      { text: "Quick Links", path: "/config/quick-links", icon: <GridViewIcon fontSize="small" />, moduleKey: "permissions" },
      { text: "Travel Allowance", path: "/travel-allowance", icon: <CommuteIcon fontSize="small" />, moduleKey: "travel_allowance" },
    ],
  },
  { text: "Notifications", icon: <NotificationsIcon />, path: "/config/notifications", moduleKey: "notifications" },
  { text: "Material Requests", icon: <AssignmentIcon />, path: "/material-requests", section: "Purchase", moduleKey: "material_requests" },
  {
    text: "Orders", icon: <ShoppingCartIcon />,
    children: [{ text: "Purchase Orders", path: "/purchase-orders", icon: <ShoppingCartIcon fontSize="small" />, moduleKey: "purchase_orders" }],
  },
  {
    text: "Stock Operations", icon: <MoveToInboxIcon />, section: "Warehouse",
    children: [
      { text: "Adjustment", path: "/stock-adjustments", icon: <CompareArrowsIcon fontSize="small" />, moduleKey: "stock_adjustments" },
      { text: "Dist. Adjustment", path: "/distributor-adjustments", icon: <CompareArrowsIcon fontSize="small" />, moduleKey: "distributor_adjustments" },
      { text: "Stock Ledger", path: "/stock-ledger", icon: <MenuBookIcon fontSize="small" />, moduleKey: "stock_ledger" },
    ],
  },
  {
    text: "Team Management", icon: <AdminPanelSettingsIcon />, section: "Sales",
    children: [
      { text: "All Agents", path: "/sales-team", icon: <AssignmentIndIcon fontSize="small" />, moduleKey: "sales_team" },
      { text: "Targets & Goals", path: "/sales-targets", icon: <AssessmentIcon fontSize="small" />, moduleKey: "sales_targets" },
    ],
  },
  {
    text: "Leads & Pipeline", icon: <FilterAltIcon />,
    children: [
      { text: "All Leads", path: "/leads", icon: <FilterAltIcon fontSize="small" />, moduleKey: "leads" },
      { text: "Field Visits", path: "/visits", icon: <LocationOnIcon fontSize="small" />, moduleKey: "visits" },
    ],
  },
  {
    text: "Sales Operations", icon: <ShoppingCartIcon />,
    children: [
      { text: "Sales Orders", path: "/sales-orders", icon: <ShoppingCartIcon fontSize="small" />, moduleKey: "sales_orders" },
      { text: "Distributor Requests", path: "/stock-requests", icon: <HistoryIcon fontSize="small" />, moduleKey: "stock_requests" },
      { text: "Order History", path: "/order-history", icon: <HistoryIcon fontSize="small" />, moduleKey: "order_history" },
      { text: "Backordered Items", path: "/backordered", icon: <AssignmentIcon fontSize="small" />, moduleKey: "backordered" },
      { text: "Invoices", path: "/invoices", icon: <ReceiptLongIcon fontSize="small" />, moduleKey: "invoices" },
      { text: "Customers", path: "/customers", icon: <StoreIcon fontSize="small" />, moduleKey: "customers" },
    ],
  },
  { text: "BOM Master", icon: <AccountTreeIcon />, path: "/bom", section: "Production", moduleKey: "bom" },
  {
    text: "Planning", icon: <CalendarMonthIcon />,
    children: [
      { text: "Production Plans", path: "/production-planning", icon: <ListAltIcon fontSize="small" />, moduleKey: "production_planning" },
      { text: "Create Plan", path: "/production-planning/create", icon: <AddBoxIcon fontSize="small" />, moduleKey: "production_planning" },
    ],
  },
  {
    text: "Execution (WO)", icon: <EngineeringIcon />,
    children: [
      { text: "Work Orders", path: "/work-orders", icon: <EngineeringIcon fontSize="small" />, moduleKey: "work_orders" },
      { text: "Job Cards", path: "/job-cards", icon: <AssignmentIndIcon fontSize="small" />, moduleKey: "job_cards" },
    ],
  },
  { text: "Credit/Debit Notes", icon: <NoteAddIcon />, path: "/credit-notes", section: "Accounts", moduleKey: "credit_notes" },
  {
    text: "Ledgers", icon: <MenuBookIcon />,
    children: [
      { text: "General Ledger", path: "/general-ledgers", icon: <MenuBookIcon fontSize="small" />, moduleKey: "general_ledger" },
      { text: "Customer Ledger", path: "/customer-ledgers", icon: <ReceiptLongIcon fontSize="small" />, moduleKey: "customer_ledger" },
      { text: "Supplier Ledger", path: "/supplier-ledgers", icon: <DescriptionIcon fontSize="small" />, moduleKey: "supplier_ledger" },
    ],
  },
];

export default function AdminSidebar({ mobileOpen, handleDrawerToggle }: { mobileOpen: boolean; handleDrawerToggle: () => void }) {
  return <BaseSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} menuItems={adminMenuItems} />;
}

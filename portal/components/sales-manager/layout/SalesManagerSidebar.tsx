"use client";
import BaseSidebar, { MenuItemType } from "@/components/layout/BaseSidebar";

import { DashboardIcon, AssignmentIndIcon, AdminPanelSettingsIcon, FilterAltIcon, ShoppingCartIcon, StoreIcon, AssessmentIcon, Inventory2Icon, AssignmentIcon, HourglassEmptyIcon, HistoryIcon, BadgeIcon, LocalShippingIcon, CompareArrowsIcon, CommuteIcon, NotificationsIcon } from "@/components/icons";

const menuItems: MenuItemType[] = [
  { text: "Overview", icon: <DashboardIcon />, path: "/sales-manager", section: "Main" },
  { text: "Reports", icon: <AssessmentIcon />, path: "/sales-manager/reports" },
  { text: "Notifications", icon: <NotificationsIcon />, path: "/notifications" },
  { text: "Attendance", icon: <BadgeIcon />, path: "/admin/attendance", moduleKey: "attendance" },
  { text: "Travel Allowance", icon: <CommuteIcon />, path: "/travel-allowance", moduleKey: "travel_allowance" },
  { text: "Distributors", icon: <LocalShippingIcon />, path: "/distributors", moduleKey: "distributors" },
  {
    text: "Team Management", icon: <AdminPanelSettingsIcon />, section: "Team",
    children: [
      { text: "All Agents", path: "/sales-team", icon: <AssignmentIndIcon fontSize="small" />, moduleKey: "sales_team" },
      { text: "Targets & Goals", path: "/sales-targets", icon: <AssessmentIcon fontSize="small" />, moduleKey: "sales_targets" },
    ],
  },
  {
    text: "Leads & Pipeline", icon: <FilterAltIcon />, section: "CRM",
    children: [
      { text: "All Leads", path: "/leads", icon: <FilterAltIcon fontSize="small" />, moduleKey: "leads" },
      { text: "All Visits", path: "/visits", icon: <AssignmentIcon fontSize="small" />, moduleKey: "visits" },
    ],
  },
  {
    text: "Sales Operations", icon: <ShoppingCartIcon />,
    children: [
      { text: "Customers", path: "/customers", icon: <StoreIcon fontSize="small" />, moduleKey: "customers" },
      { text: "Product Catalogue", path: "/product-catalog", icon: <Inventory2Icon fontSize="small" /> },
      { text: "Sales Orders", path: "/sales-orders", icon: <ShoppingCartIcon fontSize="small" />, moduleKey: "sales_orders" },
      { text: "Sales Order History", path: "/order-history", icon: <HistoryIcon fontSize="small" />, moduleKey: "order_history" },
      { text: "Stock Requests", path: "/stock-requests", icon: <Inventory2Icon fontSize="small" />, moduleKey: "stock_requests" },
      { text: "Stock Adjustment", path: "/stock-adjustments", icon: <CompareArrowsIcon fontSize="small" /> },
      { text: "Backordered", path: "/backordered", icon: <HourglassEmptyIcon fontSize="small" />, moduleKey: "backordered" },
    ],
  },
];

export default function SalesManagerSidebar({ mobileOpen, handleDrawerToggle }: { mobileOpen: boolean; handleDrawerToggle: () => void }) {
  return <BaseSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} menuItems={menuItems} />;
}

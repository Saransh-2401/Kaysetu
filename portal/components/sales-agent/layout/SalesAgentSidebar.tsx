"use client";
import BaseSidebar, { MenuItemType } from "@/components/layout/BaseSidebar";

import { DashboardIcon, StoreIcon, DirectionsWalkIcon, ShoppingCartIcon, PersonAddIcon, AssessmentIcon, LocalShippingIcon, NotificationsIcon } from "@/components/icons";

const menuItems: MenuItemType[] = [
  { text: "Dashboard", icon: <DashboardIcon />, path: "/sales-agent", section: "Main" },
  { text: "Notifications", icon: <NotificationsIcon />, path: "/notifications" },
  { text: "My Customers", icon: <StoreIcon />, path: "/my-customers", moduleKey: "customers" },
  { text: "Visits & Routes", icon: <DirectionsWalkIcon />, path: "/visits", section: "Activity", moduleKey: "visits" },
  { text: "Sales Orders", icon: <ShoppingCartIcon />, path: "/my-orders", moduleKey: "sales_orders" },
  { text: "Leads", icon: <PersonAddIcon />, path: "/leads", moduleKey: "leads" },
  { text: "Distributors", icon: <LocalShippingIcon />, path: "/distributors", moduleKey: "distributors" },
  { text: "Performance", icon: <AssessmentIcon />, path: "/sales-agent/reports", section: "Reports" },
];

export default function SalesAgentSidebar({ mobileOpen, handleDrawerToggle }: { mobileOpen: boolean; handleDrawerToggle: () => void }) {
  return <BaseSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} menuItems={menuItems} />;
}

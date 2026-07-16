"use client";
import BaseSidebar, { MenuItemType } from "@/components/layout/BaseSidebar";

import { DashboardIcon, AssignmentIcon, ShoppingCartIcon, LocalShippingIcon, NotificationsIcon } from "@/components/icons";

const menuItems: MenuItemType[] = [
  { text: "Overview", icon: <DashboardIcon />, path: "/purchase", section: "Purchase" },
  { text: "Notifications", icon: <NotificationsIcon />, path: "/notifications" },
  { text: "Suppliers", icon: <LocalShippingIcon />, path: "/suppliers", moduleKey: "suppliers" },
  { text: "Material Requests", icon: <AssignmentIcon />, path: "/material-requests", moduleKey: "material_requests" },
  { text: "Purchase Orders", icon: <ShoppingCartIcon />, path: "/purchase-orders", moduleKey: "purchase_orders" },
];

export default function PurchaseSidebar({ mobileOpen, handleDrawerToggle }: { mobileOpen: boolean; handleDrawerToggle: () => void }) {
  return <BaseSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} menuItems={menuItems} />;
}

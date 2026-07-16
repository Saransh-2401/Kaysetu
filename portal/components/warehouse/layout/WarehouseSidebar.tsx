"use client";
import BaseSidebar, { MenuItemType } from "@/components/layout/BaseSidebar";

import { DashboardIcon, InventoryIcon, CategoryIcon, LocalShippingIcon, MoveToInboxIcon, AssessmentIcon, CompareArrowsIcon, RequestQuoteIcon, HourglassEmptyIcon, MenuBookIcon, NotificationsIcon } from "@/components/icons";

const menuItems: MenuItemType[] = [
  { text: "Overview", icon: <DashboardIcon />, path: "/warehouse", section: "Warehouse", moduleKey: "warehouse_dashboard" },
  { text: "Notifications", icon: <NotificationsIcon />, path: "/notifications" },
  { text: "Reports", icon: <AssessmentIcon />, path: "/warehouse/reports", moduleKey: "warehouse_reports" },
  { text: "Raw Materials", icon: <CategoryIcon />, path: "/warehouse/raw-materials", section: "Inventory", moduleKey: "raw_materials" },
  { text: "Our Products", icon: <InventoryIcon />, path: "/warehouse/our-products", moduleKey: "our_products" },
  { text: "Stock Requests", icon: <RequestQuoteIcon />, path: "/stock-requests", moduleKey: "stock_requests" },
  { text: "Backordered", icon: <HourglassEmptyIcon />, path: "/backordered", moduleKey: "backordered" },
  {
    text: "Stock Operations", icon: <MoveToInboxIcon />, section: "Operations",
    children: [
      { text: "Purchase Orders", path: "/purchase-orders", icon: <LocalShippingIcon fontSize="small" />, moduleKey: "purchase_orders" },
      { text: "Adjustment", path: "/stock-adjustments", icon: <CompareArrowsIcon fontSize="small" />, moduleKey: "stock_adjustments" },
      { text: "Stock Ledger", path: "/stock-ledger", icon: <MenuBookIcon fontSize="small" />, moduleKey: "stock_ledger" },
    ],
  },
];

export default function WarehouseSidebar({ mobileOpen, handleDrawerToggle }: { mobileOpen: boolean; handleDrawerToggle: () => void }) {
  return <BaseSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} menuItems={menuItems} />;
}

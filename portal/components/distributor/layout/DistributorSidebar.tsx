"use client";
import BaseSidebar, { MenuItemType } from "@/components/layout/BaseSidebar";

import { DashboardIcon, ShoppingCartIcon, InventoryIcon, ReceiptIcon, PaymentIcon, AddShoppingCartIcon, HistoryIcon, HourglassEmptyIcon, CompareArrowsIcon, NotificationsIcon } from "@/components/icons";

const menuItems: MenuItemType[] = [
  { text: "Overview", icon: <DashboardIcon />, path: "/distributor", section: "Dashboard" },
  { text: "Notifications", icon: <NotificationsIcon />, path: "/notifications" },
  { text: "Invoices", icon: <ReceiptIcon />, path: "/distributor-invoices", moduleKey: "distributor_invoices" },
  { text: "Products", icon: <InventoryIcon />, path: "/distributor-products", section: "Catalog", moduleKey: "distributor_products" },
  { text: "Stock Requests", icon: <HistoryIcon />, path: "/stock-requests", moduleKey: "stock_requests" },
  { text: "Backordered", icon: <HourglassEmptyIcon />, path: "/backordered", moduleKey: "backordered" },
  { text: "Stock Adjustment", icon: <CompareArrowsIcon />, path: "/distributor-adjustments" },
  {
    text: "Sales Orders", icon: <ShoppingCartIcon />, section: "Orders",
    children: [
      { text: "New Order", path: "/sales-orders", icon: <AddShoppingCartIcon fontSize="small" />, moduleKey: "sales_orders" },
      { text: "Order History", path: "/order-history", icon: <HistoryIcon fontSize="small" />, moduleKey: "order_history" },
    ],
  },
  {
    text: "Payments", icon: <PaymentIcon />,
    children: [
      { text: "Make Payment", path: "/distributor/payments/new", icon: <PaymentIcon fontSize="small" /> },
      { text: "Payment History", path: "/distributor/payments/history", icon: <HistoryIcon fontSize="small" /> },
    ],
  },
];

export default function DistributorSidebar({ mobileOpen, handleDrawerToggle }: { mobileOpen: boolean; handleDrawerToggle: () => void }) {
  return <BaseSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} menuItems={menuItems} />;
}

"use client";
import BaseSidebar, { MenuItemType } from "@/components/layout/BaseSidebar";

import { DashboardIcon, ReceiptLongIcon, DescriptionIcon, NoteAddIcon, MenuBookIcon, AssessmentIcon, HistoryIcon, AssignmentIcon, ShoppingCartIcon, RequestPageIcon, CommuteIcon, NotificationsIcon } from "@/components/icons";

const menuItems: MenuItemType[] = [
  { text: "Overview", icon: <DashboardIcon />, path: "/accounts", section: "Accounts", moduleKey: "accounts_dashboard" },
  { text: "Notifications", icon: <NotificationsIcon />, path: "/notifications" },
  { text: "Reports", icon: <AssessmentIcon />, path: "/accounts/reports", moduleKey: "accounts_reports" },
  { text: "Credit/Debit Notes", icon: <NoteAddIcon />, path: "/credit-notes", moduleKey: "credit_notes" },
  { text: "Travel Allowance", icon: <CommuteIcon />, path: "/travel-allowance", moduleKey: "travel_allowance" },
  {
    text: "Receivables (Sales)", icon: <ReceiptLongIcon />, section: "Transactions",
    children: [
      { text: "Sales Invoices", path: "/stock-invoices", icon: <ReceiptLongIcon fontSize="small" />, moduleKey: "stock_invoices" },
      { text: "Stock Requests", path: "/stock-requests", icon: <HistoryIcon fontSize="small" />, moduleKey: "stock_requests" },
      { text: "Backordered Items", path: "/backordered", icon: <AssignmentIcon fontSize="small" />, moduleKey: "backordered" },
    ],
  },
  {
    text: "Payables (Purchase)", icon: <ShoppingCartIcon />,
    children: [
      { text: "Purchase Invoices", path: "/invoices", icon: <ReceiptLongIcon fontSize="small" />, moduleKey: "invoices" },
      { text: "Purchase Orders", path: "/purchase-orders", icon: <ShoppingCartIcon fontSize="small" />, moduleKey: "purchase_orders" },
      { text: "Material Requests", path: "/material-requests", icon: <RequestPageIcon fontSize="small" /> },
    ],
  },
  {
    text: "Ledgers", icon: <MenuBookIcon />, section: "Books",
    children: [
      { text: "General Ledger", path: "/general-ledgers", icon: <MenuBookIcon fontSize="small" />, moduleKey: "general_ledger" },
      { text: "Customer Ledger", path: "/customer-ledgers", icon: <ReceiptLongIcon fontSize="small" />, moduleKey: "customer_ledger" },
      { text: "Supplier Ledger", path: "/supplier-ledgers", icon: <DescriptionIcon fontSize="small" />, moduleKey: "supplier_ledger" },
    ],
  },
];

export default function AccountsSidebar({ mobileOpen, handleDrawerToggle }: { mobileOpen: boolean; handleDrawerToggle: () => void }) {
  return <BaseSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} menuItems={menuItems} />;
}

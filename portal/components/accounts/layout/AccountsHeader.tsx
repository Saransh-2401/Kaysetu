"use client";
import BaseHeader, { PageTitleRule } from "@/components/layout/BaseHeader";

const titleRules: PageTitleRule[] = [
  { match: "/accounts", title: "Financial Overview", exact: true },
  { match: "/accounts/reports", title: "Financial Reports" },
  { match: "/credit-notes", title: "Credit/Debit Notes" },
  { match: "/stock-invoices", title: "Sales Invoices" },
  { match: "/invoices", title: "Purchase Invoices" },
  { match: "/purchase-orders", title: "Purchase Orders" },
  { match: "/material-requests", title: "Material Requests" },
  { match: "/stock-requests", title: "Stock Requests" },
  { match: "/backordered", title: "Backordered Items" },
  { match: "/general-ledgers", title: "General Ledger" },
  { match: "/customer-ledgers", title: "Customer Ledger" },
  { match: "/supplier-ledgers", title: "Supplier Ledger" },
];

export default function AccountsHeader({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  return <BaseHeader handleDrawerToggle={handleDrawerToggle} titleRules={titleRules} fallbackTitle="Accounts Portal" breadcrumbPrefix="Accounts" />;
}

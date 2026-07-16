"use client";
import BaseHeader, { PageTitleRule } from "@/components/layout/BaseHeader";

const titleRules: PageTitleRule[] = [
  { match: "/admin", title: "Overview", exact: true },
  { match: "/users", title: "All Users", exact: true },
  { match: "/users", title: "User Management" },
  { match: "/companies", title: "Company Management" },
  { match: "/config/notifications", title: "Notifications", exact: true },
  { match: "/config", title: "System Configuration" },
  { match: "/reports", title: "Analytics & Reports" },
  { match: "/order-history", title: "Order History", exact: true },
  { match: "/company", title: "Company Settings", exact: true },
  { match: "/items", title: "Item Master" },
  { match: "/products", title: "Product Master" },
  { match: "/customers", title: "Customer Master" },
  { match: "/suppliers", title: "Supplier Master" },
  { match: "/taxes", title: "Taxes" },
  { match: "/distributors", title: "Distributors" },
  { match: "/attendance", title: "Attendance" },
  { match: "/app-updates", title: "App Updates" },
];

export default function AdminHeader({ handleDrawerToggle }: { handleDrawerToggle: () => void }) {
  return <BaseHeader handleDrawerToggle={handleDrawerToggle} titleRules={titleRules} fallbackTitle="Dashboard" />;
}

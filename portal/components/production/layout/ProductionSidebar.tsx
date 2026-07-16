"use client";
import BaseSidebar, { MenuItemType } from "@/components/layout/BaseSidebar";

import { DashboardIcon, CalendarMonthIcon, EngineeringIcon, AssignmentIndIcon, AccountTreeIcon, AssessmentIcon, AddBoxIcon, ListAltIcon, AssignmentIcon, NotificationsIcon } from "@/components/icons";

const menuItems: MenuItemType[] = [
  { text: "Overview", icon: <DashboardIcon />, path: "/production", section: "Production", moduleKey: "production_dashboard" },
  { text: "Notifications", icon: <NotificationsIcon />, path: "/notifications" },
  { text: "Reports", icon: <AssessmentIcon />, path: "/production/reports", moduleKey: "production_reports" },
  { text: "BOM Master", icon: <AccountTreeIcon />, path: "/bom", section: "Setup", moduleKey: "bom" },
  { text: "Material Requests", icon: <AssignmentIcon />, path: "/material-requests", moduleKey: "material_requests" },
  {
    // Planning left untagged: the Production Manager's matrix grants it but the
    // Quality Manager (who shares this sidebar) does not, so we keep it visible
    // for both rather than hide it from QM on default seed.
    text: "Planning", icon: <CalendarMonthIcon />, section: "Operations",
    children: [
      { text: "Production Plans", path: "/production-planning", icon: <ListAltIcon fontSize="small" /> },
      { text: "Create Plan", path: "/production-planning/create", icon: <AddBoxIcon fontSize="small" /> },
    ],
  },
  { text: "Backordered Items", icon: <AssignmentIcon />, path: "/backordered" },
  {
    text: "Execution (WO)", icon: <EngineeringIcon />,
    children: [
      { text: "Work Orders", path: "/work-orders", icon: <EngineeringIcon fontSize="small" />, moduleKey: "work_orders" },
      { text: "Job Cards", path: "/job-cards", icon: <AssignmentIndIcon fontSize="small" />, moduleKey: "job_cards" },
    ],
  },
];

export default function ProductionSidebar({ mobileOpen, handleDrawerToggle }: { mobileOpen: boolean; handleDrawerToggle: () => void }) {
  return <BaseSidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} menuItems={menuItems} />;
}

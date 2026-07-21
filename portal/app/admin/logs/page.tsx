"use client";
import React, { useState } from "react";
import { Box, Paper, Typography, Stack, Tabs, Tab, CircularProgress, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  ShieldIcon, HistoryIcon, SecurityIcon, LockPersonIcon,
  NotificationsIcon, DeleteIcon, BackupIcon, RouteIcon,
} from "@/components/icons";
import { authService } from "@/lib/auth-service";

const TabLoading = () => (
  <Box sx={{ p: 6, textAlign: "center" }}>
    <CircularProgress size={28} />
  </Box>
);

// Each tab is loaded on demand so the page shell stays light and we never import
// all seven tables at once.
const LoginActivityTab = dynamic(() => import("@/components/admin/logs/LoginActivityTab"), { loading: TabLoading });
const AuditLogsTab = dynamic(() => import("@/components/admin/logs/AuditLogsTab"), { loading: TabLoading });
const AccessLogsTab = dynamic(() => import("@/components/admin/logs/AccessLogsTab"), { loading: TabLoading });
const NotificationsTab = dynamic(() => import("@/components/admin/logs/NotificationsTab"), { loading: TabLoading });
const DeletedDocumentsTab = dynamic(() => import("@/components/admin/logs/DeletedDocumentsTab"), { loading: TabLoading });
const BackupsTab = dynamic(() => import("@/components/admin/logs/BackupsTab"), { loading: TabLoading });
const RouteHistoryTab = dynamic(() => import("@/components/admin/logs/RouteHistoryTab"), { loading: TabLoading });

const TABS = [
  { slug: "login-activity", label: "Login Activity", icon: HistoryIcon, Component: LoginActivityTab },
  { slug: "audit", label: "Audit Logs", icon: SecurityIcon, Component: AuditLogsTab },
  { slug: "access", label: "Access Logs", icon: LockPersonIcon, Component: AccessLogsTab },
  { slug: "notifications", label: "Notifications", icon: NotificationsIcon, Component: NotificationsTab },
  { slug: "deleted", label: "Deleted Documents", icon: DeleteIcon, Component: DeletedDocumentsTab },
  { slug: "backups", label: "Backups", icon: BackupIcon, Component: BackupsTab },
  // Route History is agent-GPS data — only meaningful with the TRACK module.
  { slug: "route-history", label: "Route History", icon: RouteIcon, Component: RouteHistoryTab, moduleKey: "TRACK" },
];

export default function LogsPage() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  // Hide tabs whose backing module the tenant hasn't bought (so we never fetch
  // an endpoint that 403s). Login Activity (index 0) is always present.
  const modules = authService.getOrgContext()?.modules ?? [];
  const tabs = TABS.filter((t) => !t.moduleKey || modules.includes(t.moduleKey));
  const safeTab = Math.min(activeTab, tabs.length - 1);
  const ActiveComponent = tabs[safeTab].Component;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600, mx: "auto" }} data-testid="logs-page">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          }}>
            <ShieldIcon sx={{ color: "#fff", fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} color="text.primary">Logs</Typography>
            <Typography variant="body2" color="text.secondary">
              Audit trail, document access, notifications, deletions, backups, login activity & agent routes
            </Typography>
          </Box>
        </Stack>
      </motion.div>

      {/* Tabs */}
      <Paper elevation={0} sx={{ mb: 2.5, borderRadius: 3, overflow: "hidden" }}>
        <Tabs
          value={safeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          data-testid="logs-tabs-bar"
          sx={{ minHeight: 0 }}
          TabIndicatorProps={{ sx: { height: 3, borderRadius: 3 } }}
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <Tab
                key={t.slug}
                icon={<Icon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={t.label}
                data-testid={`logs-tab-${t.slug}`}
                sx={{ textTransform: "none", fontWeight: 600, minHeight: 0, py: 1.5 }}
              />
            );
          })}
        </Tabs>
      </Paper>

      {/* Active tab — keyed so switching tabs remounts with fresh state */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <ActiveComponent />
      </motion.div>
    </Box>
  );
}

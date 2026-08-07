"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Tabs,
  Tab,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import { motion } from "framer-motion";

// Icons
import { NotificationsActiveIcon, EmailIcon, SmsIcon, ExpandMoreIcon, SaveIcon, CheckCircleIcon, SendIcon, InfoIcon, SettingsIcon } from "@/components/icons";

import { coreService, EmailTemplate, EmailConfiguration, SMSConfiguration, SMSTemplate } from "@/lib/core-service";
import RoleDefaultsManager from "@/components/notifications/RoleDefaultsManager";
import BroadcastComposer from "@/components/notifications/BroadcastComposer";
import OrgAlertsManager from "@/components/notifications/OrgAlertsManager";
import PlatformTemplateList from "@/components/config/PlatformTemplateList";

// Toast Interface
interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
}

// The per-tenant TemplateAccordion / SMSTemplateAccordion editors were removed:
// templates are platform-owned now, rendered read-only by PlatformTemplateList.

export default function NotificationsPage() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  const [smtpConfig, setSmtpConfig] = useState<EmailConfiguration | null>(null);
  const [originalConfig, setOriginalConfig] = useState<EmailConfiguration | null>(null);

  const [loading, setLoading] = useState(true);

  // SMS State
  const [smsTemplates, setSmsTemplates] = useState<SMSTemplate[]>([]);
  const [smsConfig, setSmsConfig] = useState<SMSConfiguration | null>(null);
  const [originalSmsConfig, setOriginalSmsConfig] = useState<SMSConfiguration | null>(null);
  const [savingSmsConfig, setSavingSmsConfig] = useState(false);

  // System Alerts State
  interface UnifiedAlert { key: string; label: string; emailTpl?: EmailTemplate; smsTpl?: SMSTemplate; }
  const [unifiedAlerts, setUnifiedAlerts] = useState<UnifiedAlert[]>([]);

  // SMTP Actions
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ status: string, message: string } | null>(null);
  const [savingSmtp, setSavingSmtp] = useState(false);

  // Test Email/SMS Dialog
  const [testDialog, setTestDialog] = useState(false);
  const [testTarget, setTestTarget] = useState("");
  const [testType, setTestType] = useState<'email' | 'sms'>('email');
  const [sendingTest, setSendingTest] = useState(false);
  const [targetTemplateId, setTargetTemplateId] = useState<number | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastState>({ open: false, message: "", severity: "success" });

  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => setToast({ ...toast, open: false });

  // Error Helper
  const getFriendlyErrorMessage = (errorMsg: string) => {
    if (!errorMsg) return "An unknown error occurred.";
    const msg = String(errorMsg);

    if (msg.includes("550") || msg.toLowerCase().includes("user unknown") || msg.toLowerCase().includes("domain may not exist")) {
      return "Delivery Failed: Account or domain does not exist.";
    }
    if (msg.includes("535") || msg.toLowerCase().includes("incorrect authentication")) {
      return "Authentication Failed: Incorrect Username or Password.";
    }
    if (msg.includes("Connection refused") || msg.includes("10061") || msg.includes("111")) {
      return "Connection Refused. Check Host and Port.";
    }
    if (msg.includes("getaddrinfo failed")) {
      return "Invalid Hostname. Cannot resolve server.";
    }
    if (msg.includes("time out") || msg.includes("timed out")) {
      return "Connection Timed Out. Check Host/Port/Firewall.";
    }
    return msg;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (tab === 0) {
          const [tplRes, configRes] = await Promise.all([
            coreService.getEmailTemplates(),
            coreService.getEmailConfig()
          ]);
          const tplData = Array.isArray(tplRes) ? tplRes : (tplRes as any).results || [];
          if (tplData) setTemplates(tplData);
          if (configRes) {
            setSmtpConfig(configRes);
            setOriginalConfig(configRes);
          }
        } else if (tab === 1) {
          const [smsTplRes, smsConfigRes] = await Promise.all([
            coreService.getSMSTemplates(),
            coreService.getSMSConfig()
          ]);
          const smsTplData = Array.isArray(smsTplRes) ? smsTplRes : (smsTplRes as any).results || [];
          setSmsTemplates(smsTplData);
          setSmsConfig(smsConfigRes);
          setOriginalSmsConfig(smsConfigRes);
        } else if (tab === 2) {
          // Fetch All for Alerts
          const [emailRes, smsRes] = await Promise.all([
            coreService.getEmailTemplates(),
            coreService.getSMSTemplates()
          ]);
          const emails = Array.isArray(emailRes) ? emailRes : (emailRes as any).results || [];
          const sms = Array.isArray(smsRes) ? smsRes : (smsRes as any).results || [];

          const keys = new Set([...emails.map((e: any) => e.trigger_key), ...sms.map((s: any) => s.trigger_key)]);
          const alerts = Array.from(keys).map(k => {
            const e = emails.find((x: any) => x.trigger_key === k);
            const s = sms.find((x: any) => x.trigger_key === k);
            let prettyName = (k as string).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            if (e) prettyName = e.name;
            return { key: k as string, label: prettyName, emailTpl: e, smsTpl: s };
          });
          setUnifiedAlerts(alerts);
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
        showToast("Failed to load configuration", "error");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [tab]);

  const handleSmtpChange = (field: keyof EmailConfiguration, value: any) => {
    if (!smtpConfig) return;
    let newConfig = { ...smtpConfig, [field]: value };

    if (field === 'use_ssl' && value === true) {
      newConfig.use_tls = false;
      if (newConfig.port === 587) newConfig.port = 465;
    }
    else if (field === 'use_tls' && value === true) {
      newConfig.use_ssl = false;
      if (newConfig.port === 465) newConfig.port = 587;
    }

    setSmtpConfig(newConfig);
  };

  const hasChanges = () => {
    if (!smtpConfig || !originalConfig) return false;
    return JSON.stringify(smtpConfig) !== JSON.stringify(originalConfig);
  };

  const saveSmtpConfig = async () => {
    if (!smtpConfig) return;
    setSavingSmtp(true);
    try {
      const saved = await coreService.updateEmailConfig(smtpConfig);
      setSmtpConfig(saved);
      setOriginalConfig(saved);
      showToast("SMTP Configuration saved successfully!", "success");
    } catch (e) {
      showToast("Failed to save SMTP config", "error");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSmsConfigChange = (field: keyof SMSConfiguration, value: string) => {
    if (!smsConfig) return;
    setSmsConfig({ ...smsConfig, [field]: value });
  };

  const hasSmsChanges = () => {
    if (!smsConfig || !originalSmsConfig) return false;
    return JSON.stringify(smsConfig) !== JSON.stringify(originalSmsConfig);
  };

  const saveSmsConfig = async () => {
    if (!smsConfig) return;
    setSavingSmsConfig(true);
    try {
      const saved = await coreService.updateSMSConfig(smsConfig);
      setSmsConfig(saved);
      setOriginalSmsConfig(saved);
      showToast("SMS Configuration saved!", "success");
    } catch (e) {
      showToast("Failed to save SMS config", "error");
    } finally {
      setSavingSmsConfig(false);
    }
  };

  const handleToggleAlert = async (type: 'email' | 'sms', alert: UnifiedAlert, val: boolean) => {
    try {
      if (type === 'email' && alert.emailTpl) {
        await coreService.updateEmailTemplate(alert.emailTpl.id, { is_active: val });
        setUnifiedAlerts(prev => prev.map(a => a.key === alert.key ? { ...a, emailTpl: { ...a.emailTpl!, is_active: val } } : a));
      } else if (type === 'sms' && alert.smsTpl) {
        await coreService.updateSMSTemplate(alert.smsTpl.id, { is_active: val });
        setUnifiedAlerts(prev => prev.map(a => a.key === alert.key ? { ...a, smsTpl: { ...a.smsTpl!, is_active: val } } : a));
      }
      showToast("Status updated", "success");
    } catch (e) {
      showToast("Failed to update status", "error");
    }
  };

  const verifyConnection = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await coreService.verifyEmailConfig(smtpConfig || {});

      if (res.status === 'success') {
        setVerifyResult(res);
        showToast("Connection Successful!", "success");
      } else {
        const friendlyMsg = getFriendlyErrorMessage(res.message);
        setVerifyResult({ status: 'error', message: friendlyMsg });
        showToast(friendlyMsg, "error");
      }
    } catch (e: any) {
      const rawMsg = e.response?.data?.message || e.message || 'Verification failed';
      const friendlyMsg = getFriendlyErrorMessage(rawMsg);
      setVerifyResult({ status: 'error', message: friendlyMsg });
      showToast(friendlyMsg, "error");
    } finally {
      setVerifying(false);
    }
  };

  const openTestDialog = (type: 'email' | 'sms', tplId?: number) => {
    setTestType(type);
    setTargetTemplateId(tplId ?? null);
    setTestTarget("");
    setTestDialog(true);
  };

  const handleSendTest = async () => {
    if (!testTarget) return;
    setSendingTest(true);
    try {
      if (testType === 'email') {
        if (targetTemplateId) {
          await coreService.testEmailTemplate(targetTemplateId, testTarget);
          showToast(`Template test email sent to ${testTarget}`, "success");
        } else {
          await coreService.sendTestEmail(testTarget);
          showToast(`Test email sent to ${testTarget}. Check Inbox/Spam.`, "success");
        }
      } else {
        // SMS
        if (targetTemplateId) {
          await coreService.testSMSTemplate(targetTemplateId, testTarget);
          showToast("Test SMS sent successfully!", "success");
        }
      }
      setTestDialog(false);
    } catch (e: any) {
      const rawMsg = e.response?.data?.message || e.message || 'Unknown error';
      const friendlyMsg = getFriendlyErrorMessage(rawMsg);
      showToast("Failed: " + friendlyMsg, "error");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={4}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ letterSpacing: "-0.02em" }}
            >
              Notifications & Templates
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage alerts, email templates & SMTP settings
            </Typography>
          </Box>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            border: "none",
            boxShadow: "0px 4px 30px rgba(0,0,0,0.02)",
            overflow: "hidden",
            minHeight: 600,
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
            <Tabs
              value={tab}
              onChange={(e, v) => setTab(v)}
              sx={{ "& .MuiTab-root": { py: 3, mr: 2, fontWeight: 600 } }}
            >
              <Tab
                icon={<EmailIcon sx={{ mr: 1 }} />}
                iconPosition="start"
                label="Email Templates"
              />
              <Tab
                icon={<SmsIcon sx={{ mr: 1 }} />}
                iconPosition="start"
                label="SMS Templates"
              />
              <Tab
                icon={<NotificationsActiveIcon sx={{ mr: 1 }} />}
                iconPosition="start"
                label="System Alerts"
              />
              <Tab
                icon={<SettingsIcon sx={{ mr: 1 }} />}
                iconPosition="start"
                label="Role Defaults"
                data-testid="config-notifications-tab-roledefaults"
              />
              <Tab
                icon={<SendIcon sx={{ mr: 1 }} />}
                iconPosition="start"
                label="Send Notification"
                data-testid="config-notifications-tab-broadcast"
              />
            </Tabs>
          </Box>

          <Box sx={{ p: 4 }}>
            {/* TAB 0: EMAIL */}
            {/* TAB 0 — EMAIL TEMPLATES (read-only).
                SMTP settings deliberately removed: KaySetu sends on its own
                account and pays for delivery, so a tenant has nothing to
                configure. Ops maintains the wording in the SuperAdmin console. */}
            {tab === 0 && <PlatformTemplateList channel="email" />}

            {/* TAB 1 — SMS TEMPLATES (read-only), same reasoning. */}
            {tab === 1 && <PlatformTemplateList channel="sms" />}

            {/* TAB 2 — SYSTEM ALERTS.
                Org-wide on/off per event. Previously this toggled message
                templates, which are platform-owned and drive nothing here, so
                the switches changed nothing. */}
            {tab === 2 && <OrgAlertsManager showToast={showToast} />}


            {/* TAB 3: ROLE DEFAULTS (admin) */}
            {tab === 3 && <RoleDefaultsManager />}

            {/* TAB 4: SEND NOTIFICATION / BROADCAST (admin) */}
            {tab === 4 && <BroadcastComposer />}
          </Box>
        </Paper>
      </motion.div>

      {/* Test Dialog */}
      <Dialog open={testDialog} onClose={() => setTestDialog(false)}>
        <DialogTitle>
          {testType === 'email' ? "Send Test Email" : "Send Test SMS"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, minWidth: 400 }}>
          {targetTemplateId && <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
            Sending <b>{testType === 'email' ? "Email" : "SMS"} Template</b> with dummy data.
          </Typography>}
          <TextField
            label={testType === 'email' ? "Recipient Email" : "Recipient Phone Number"}
            fullWidth
            value={testTarget}
            onChange={e => setTestTarget(e.target.value)}
            sx={{ mt: 1 }}
            placeholder={testType === 'email' ? "name@example.com" : "+919876543210"}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSendTest}
            variant="contained"
            disabled={sendingTest}
            startIcon={sendingTest ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            sx={{
              "&.Mui-disabled": {
                bgcolor: alpha(theme.palette.primary.main, 0.7),
                color: "#fff"
              }
            }}
          >
            {sendingTest ? "Sending..." : "Send"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* GLOBAL TOAST */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%', boxShadow: 3 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

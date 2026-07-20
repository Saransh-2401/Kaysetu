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

// Toast Interface
interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
}

function TemplateAccordion({ template, showToast, onUpdate, onTest }: { template: EmailTemplate, showToast: (msg: string, type: 'success' | 'error') => void, onUpdate: (t: EmailTemplate) => void, onTest: () => void }) {
  const theme = useTheme();
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);

  // Sync state if template prop changes
  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
  }, [template]);

  const hasChanges = subject !== template.subject || body !== template.body;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await coreService.updateEmailTemplate(template.id, { subject, body });
      showToast("Template saved successfully!", "success");
      onUpdate(updated);
    } catch (error) {
      console.error(error);
      showToast("Failed to save template.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Accordion
      elevation={0}
      sx={{
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        borderRadius: "12px !important",
        "&:before": { display: "none" },
        mb: 2
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            justifyContent: "space-between",
            pr: 2,
          }}
        >
          <Typography fontWeight={600}>{template.name}</Typography>
          <Chip
            label={template.trigger_key}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          <TextField
            label="Subject Line"
            fullWidth
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            size="small"
          />
          <TextField
            label="HTML Body"
            fullWidth
            multiline
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            helperText="Supports HTML content"
          />

          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Available Variables:
            </Typography>
            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" gap={1}>
              {template.available_variables.map((v) => (
                <Chip
                  key={v}
                  label={v}
                  size="small"
                  sx={{ cursor: "pointer", bgcolor: alpha(theme.palette.primary.main, 0.1) }}
                />
              ))}
            </Stack>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, minHeight: 40 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onTest();
              }}
            >
              Test Send
            </Button>
            {hasChanges && (
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function SMSTemplateAccordion({ template, showToast, onTest }: { template: SMSTemplate, showToast: (msg: string, type: 'success' | 'error') => void, onTest: () => void }) {
  const theme = useTheme();
  const [content, setContent] = useState(template.content);
  const [dltId, setDltId] = useState(template.dlt_template_id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(template.content);
    setDltId(template.dlt_template_id);
  }, [template]);

  const hasChanges = content !== template.content || dltId !== template.dlt_template_id;

  const handleSave = async () => {
    setSaving(true);
    try {
      await coreService.updateSMSTemplate(template.id, { content, dlt_template_id: dltId });
      showToast("SMS Template saved!", "success");
    } catch (error) {
      showToast("Failed to save SMS template.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Accordion
      elevation={0}
      sx={{
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        borderRadius: "12px !important",
        "&:before": { display: "none" },
        mb: 2
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            justifyContent: "space-between",
            pr: 2,
          }}
        >
          <Typography fontWeight={600}>{template.name}</Typography>
          <Chip
            label={template.trigger_key}
            size="small"
            color="secondary"
            variant="outlined"
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          <Alert severity="warning" sx={{ fontSize: '0.85rem' }}>
            Important: The content must EXACTLY match your DLT approved template.
          </Alert>
          <TextField
            label="DLT Template ID"
            fullWidth
            value={dltId}
            onChange={(e) => setDltId(e.target.value)}
            size="small"
            helperText="The Template ID provided by your DLT provider"
          />
          <TextField
            label="SMS Content"
            fullWidth
            multiline
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            helperText="Use ${gpt} for OTP placeholder"
          />

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onTest();
              }}
            >
              Test Send
            </Button>
            {hasChanges && (
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

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
                label="Email Settings"
              />
              <Tab
                icon={<SmsIcon sx={{ mr: 1 }} />}
                iconPosition="start"
                label="SMS Gateways"
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
            {tab === 0 && (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                {/* Templates Section */}
                <Box flex={1.5}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Email Templates
                  </Typography>
                  {loading ? (
                    <Box display="flex" justifyContent="center" py={4}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <Stack spacing={2}>
                      {templates.length === 0 ? (
                        <Typography color="text.secondary">No templates found.</Typography>
                      ) : (
                        templates.map((tpl) => (
                          <TemplateAccordion
                            key={tpl.id}
                            template={tpl}
                            showToast={showToast}
                            onUpdate={(updated) => setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))}
                            onTest={() => openTestDialog('email', tpl.id)}
                          />
                        ))
                      )}
                    </Stack>
                  )}
                </Box>

                {/* SMTP CONFIGURATION SIDEBAR */}
                <Box flex={1}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 3,
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                      borderRadius: 2,
                      position: 'sticky',
                      top: 20
                    }}
                  >
                    <Typography
                      variant="h6"
                      gutterBottom
                      fontWeight={700}
                    >
                      SMTP Configuration
                    </Typography>

                    <Alert icon={<InfoIcon fontSize="inherit" />} severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
                      For <b>SSL</b>, use port <b>465</b>. For <b>TLS</b>, use port <b>587</b>.
                      Toggle ONLY one security method.
                    </Alert>

                    {loading || !smtpConfig ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Stack spacing={2} mt={2}>
                        <TextField
                          label="SMTP Host"
                          size="small"
                          fullWidth
                          value={smtpConfig.host}
                          onChange={e => handleSmtpChange('host', e.target.value)}
                        />
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <TextField
                            label="Port"
                            size="small"
                            fullWidth
                            type="number"
                            value={smtpConfig.port}
                            onChange={e => handleSmtpChange('port', parseInt(e.target.value))}
                            helperText={smtpConfig.use_ssl ? "Usually 465" : "Usually 587"}
                          />
                          <Stack>
                            <FormControlLabel
                              control={<Switch checked={smtpConfig.use_ssl} onChange={e => handleSmtpChange('use_ssl', e.target.checked)} />}
                              label="SSL"
                              labelPlacement="end"
                            />
                            <FormControlLabel
                              control={<Switch checked={smtpConfig.use_tls} onChange={e => handleSmtpChange('use_tls', e.target.checked)} />}
                              label="TLS"
                              labelPlacement="end"
                            />
                          </Stack>
                        </Stack>
                        <TextField
                          label="Username"
                          size="small"
                          fullWidth
                          value={smtpConfig.username}
                          onChange={e => handleSmtpChange('username', e.target.value)}
                        />
                        <TextField
                          label="Password"
                          size="small"
                          fullWidth
                          type="password"
                          data-testid="smtp-config-password-input"
                          value={smtpConfig.password ?? ''}
                          onChange={e => handleSmtpChange('password', e.target.value)}
                          placeholder={smtpConfig.password_set ? '•••••••• (saved — leave blank to keep)' : 'Enter password'}
                          helperText="Stored encrypted. Type a new password to replace; leave blank to keep the current one."
                        />
                        <TextField
                          label="Sender Name"
                          size="small"
                          fullWidth
                          value={smtpConfig.from_name}
                          onChange={e => handleSmtpChange('from_name', e.target.value)}
                          placeholder="e.g. KaySetu"
                          helperText="Display name shown in recipient's inbox"
                        />
                        <TextField
                          label="Default From Email"
                          size="small"
                          fullWidth
                          value={smtpConfig.default_from_email}
                          onChange={e => handleSmtpChange('default_from_email', e.target.value)}
                        />

                        <Stack direction="row" spacing={1} pt={2} alignItems="center">
                          {hasChanges() && (
                            <Button
                              variant="contained"
                              startIcon={savingSmtp ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                              onClick={saveSmtpConfig}
                              disabled={savingSmtp || verifying || sendingTest}
                              color="primary"
                              sx={{
                                "&.Mui-disabled": {
                                  bgcolor: alpha(theme.palette.primary.main, 0.7),
                                  color: "#fff"
                                }
                              }}
                            >
                              {savingSmtp ? "Saving..." : "Save"}
                            </Button>
                          )}

                          <Button
                            variant="outlined"
                            startIcon={verifying ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                            onClick={verifyConnection}
                            disabled={verifying || savingSmtp || sendingTest}
                            size="small"
                            sx={{
                              "&.Mui-disabled": {
                                color: alpha(theme.palette.text.primary, 0.6),
                                borderColor: alpha(theme.palette.divider, 0.5)
                              }
                            }}
                          >
                            {verifying ? "Verifying..." : "Verify"}
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<SendIcon />}
                            onClick={() => openTestDialog('email')} // Generic test
                            size="small"
                            disabled={savingSmtp || verifying || sendingTest}
                            sx={{
                              "&.Mui-disabled": {
                                color: alpha(theme.palette.text.primary, 0.6),
                                borderColor: alpha(theme.palette.divider, 0.5)
                              }
                            }}
                          >
                            Test
                          </Button>
                        </Stack>

                      </Stack>
                    )}
                  </Paper>
                </Box>
              </Stack>
            )}

            {/* TAB 1: SMS */}
            {tab === 1 && (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                {/* SMS Templates */}
                <Box flex={1.5}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    SMS Templates
                  </Typography>
                  {loading ? (
                    <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
                  ) : (
                    <Stack spacing={2}>
                      {smsTemplates.map(tpl => (
                        <SMSTemplateAccordion
                          key={tpl.id}
                          template={tpl}
                          showToast={showToast}
                          onTest={() => openTestDialog('sms', tpl.id)}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>

                {/* SMS Config */}
                <Box flex={1}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 3,
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                      borderRadius: 2,
                      position: 'sticky',
                      top: 20
                    }}
                  >
                    <Typography variant="h6" gutterBottom fontWeight={700}>
                      SMS Hub Configuration
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Configure your SMS Gateway Hub credentials.
                    </Typography>

                    {loading || !smsConfig ? <CircularProgress size={20} /> : (
                      <Stack spacing={2}>
                        <TextField
                          label="API Key"
                          size="small" fullWidth
                          type="password"
                          data-testid="sms-config-apikey-input"
                          value={smsConfig.api_key ?? ''}
                          onChange={e => handleSmsConfigChange('api_key', e.target.value)}
                          placeholder={smsConfig.api_key_set ? '•••••••• (saved — leave blank to keep)' : 'Enter API Key'}
                          helperText="Stored encrypted. Type a new key to replace; leave blank to keep the current one."
                        />
                        <TextField
                          label="Sender ID"
                          size="small" fullWidth
                          value={smsConfig.sender_id}
                          onChange={e => handleSmsConfigChange('sender_id', e.target.value)}
                        />
                        <TextField
                          label="Entity ID"
                          size="small" fullWidth
                          value={smsConfig.entity_id}
                          onChange={e => handleSmsConfigChange('entity_id', e.target.value)}
                        />
                        <Box pt={2}>
                          {hasSmsChanges() && (
                            <Button
                              variant="contained"
                              startIcon={savingSmsConfig ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                              onClick={saveSmsConfig}
                              disabled={savingSmsConfig}
                              sx={{
                                "&.Mui-disabled": {
                                  bgcolor: alpha(theme.palette.primary.main, 0.7),
                                  color: "#fff"
                                }
                              }}
                            >
                              {savingSmsConfig ? "Saving..." : "Save Config"}
                            </Button>
                          )}
                        </Box>
                      </Stack>
                    )}
                  </Paper>
                </Box>
              </Stack>
            )}


            {tab === 2 && (
              <Box maxWidth="lg">
                <Typography variant="h6" fontWeight={700} gutterBottom>System Alerts & Notifications</Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Enable or disable notifications for specific system events.
                </Typography>

                {loading ? <CircularProgress /> : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                          <TableCell><strong>Trigger Event</strong></TableCell>
                          <TableCell align="center"><strong>Email Notification</strong></TableCell>
                          <TableCell align="center"><strong>SMS Notification</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {unifiedAlerts.map(alert => (
                          <TableRow key={alert.key}>
                            <TableCell>
                              <Typography fontWeight={600}>{alert.label}</Typography>
                              <Typography variant="caption" color="text.secondary">{alert.key}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Switch
                                checked={alert.emailTpl?.is_active || false}
                                disabled={!alert.emailTpl}
                                onChange={(e) => handleToggleAlert('email', alert, e.target.checked)}
                              />
                              {!alert.emailTpl && <Typography variant="caption" display="block" color="text.disabled">N/A</Typography>}
                            </TableCell>
                            <TableCell align="center">
                              <Switch
                                checked={alert.smsTpl?.is_active || false}
                                disabled={!alert.smsTpl}
                                onChange={(e) => handleToggleAlert('sms', alert, e.target.checked)}
                              />
                              {!alert.smsTpl && <Typography variant="caption" display="block" color="text.disabled">N/A</Typography>}
                            </TableCell>
                          </TableRow>
                        ))}
                        {unifiedAlerts.length === 0 && (
                          <TableRow><TableCell colSpan={3} align="center">No alerts found</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}

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

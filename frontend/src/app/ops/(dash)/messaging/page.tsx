"use client";
/**
 * Ops → Messaging.
 *
 * The platform owns email/SMS: KaySetu authors every template and pays for
 * delivery, so the credentials and the wording are managed HERE and tenants only
 * ever view the result.
 *
 * Two deliberate constraints, mirrored from the API:
 *  - templates can be EDITED but never created or deleted — the catalog ships
 *    with the code, and a template whose trigger_key no code path looks up could
 *    never fire;
 *  - `trigger_key` / `channel` / `module_code` are read-only, because they are
 *    the contract with the sending code.
 */
import EmailIcon from "@mui/icons-material/EmailOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import SmsIcon from "@mui/icons-material/SmsOutlined";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, List, ListItemButton,
  Paper, Snackbar, Stack, Switch, Tab, Tabs, TextField, Typography,
  FormControlLabel,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

interface MessageTemplate {
  id: number;
  channel: "email" | "sms";
  trigger_key: string;
  name: string;
  description: string;
  module_code: string;
  category: string;
  subject: string;
  body: string;
  content: string;
  dlt_template_id: string;
  available_variables: string[];
  is_active: boolean;
}

interface MessagingConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password?: string;
  smtp_use_tls: boolean;
  smtp_use_ssl: boolean;
  from_email: string;
  from_name: string;
  sms_api_key?: string;
  sms_sender_id: string;
  sms_entity_id: string;
  has_smtp_password: boolean;
  has_sms_api_key: boolean;
  email_ready: boolean;
  sms_ready: boolean;
}

export default function MessagingPage() {
  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── credentials
  const [config, setConfig] = useState<MessagingConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // ── templates
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selected, setSelected] = useState<MessageTemplate | null>(null);
  const [draft, setDraft] = useState<MessageTemplate | null>(null);
  const [savingTpl, setSavingTpl] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<MessagingConfig>("ops", "/sa/messaging-config"),
      api<MessageTemplate[]>("ops", "/sa/message-templates/"),
    ])
      .then(([cfg, tpls]) => {
        setConfig(cfg);
        const list = Array.isArray(tpls) ? tpls : [];
        setTemplates(list);
        setSelected((prev) => list.find((t) => t.id === prev?.id) ?? list[0] ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDraft(selected ? { ...selected } : null); }, [selected]);

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      // Only send secrets when actually retyped — the API treats blank as
      // "keep the stored value", so clearing the box must not wipe delivery
      // for every tenant.
      const payload: Record<string, unknown> = {
        smtp_host: config.smtp_host, smtp_port: config.smtp_port,
        smtp_username: config.smtp_username, smtp_use_tls: config.smtp_use_tls,
        smtp_use_ssl: config.smtp_use_ssl, from_email: config.from_email,
        from_name: config.from_name, sms_sender_id: config.sms_sender_id,
        sms_entity_id: config.sms_entity_id,
      };
      if (config.smtp_password) payload.smtp_password = config.smtp_password;
      if (config.sms_api_key) payload.sms_api_key = config.sms_api_key;

      const saved = await api<MessagingConfig>("ops", "/sa/messaging-config",
        { method: "PATCH", body: payload });
      setConfig(saved);
      setToast("Messaging credentials saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingConfig(false);
    }
  };

  const saveTemplate = async () => {
    if (!draft) return;
    setSavingTpl(true);
    try {
      const saved = await api<MessageTemplate>("ops", `/sa/message-templates/${draft.id}/`, {
        method: "PATCH",
        body: {
          name: draft.name, description: draft.description,
          subject: draft.subject, body: draft.body, content: draft.content,
          dlt_template_id: draft.dlt_template_id, is_active: draft.is_active,
        },
      });
      setTemplates((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
      setSelected(saved);
      setToast(`"${saved.name}" saved — every tenant sees this immediately.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingTpl(false);
    }
  };

  const set = (patch: Partial<MessagingConfig>) =>
    setConfig((c) => (c ? { ...c, ...patch } : c));
  const setDraftField = (patch: Partial<MessageTemplate>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const dirty = !!draft && !!selected && JSON.stringify(draft) !== JSON.stringify(selected);
  const emails = templates.filter((t) => t.channel === "email");
  const smses = templates.filter((t) => t.channel === "sms");

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={3} data-testid="ops-messaging-page">
      <Box>
        <Typography variant="h5" fontWeight={800}>Messaging</Typography>
        <Typography variant="body2" color="text.secondary">
          KaySetu sends every tenant&apos;s email and SMS on these credentials, using the
          templates below. Tenants can view the templates but never edit them.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1}>
        <Chip size="small" label={config?.email_ready ? "Email ready" : "Email not configured"}
          color={config?.email_ready ? "success" : "warning"} data-testid="ops-messaging-email-status" />
        <Chip size="small" label={config?.sms_ready ? "SMS credentials set" : "SMS not configured"}
          color={config?.sms_ready ? "success" : "warning"} data-testid="ops-messaging-sms-status" />
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Credentials" data-testid="ops-messaging-tab-credentials" />
        <Tab label={`Email templates (${emails.length})`} data-testid="ops-messaging-tab-email" />
        <Tab label={`SMS templates (${smses.length})`} data-testid="ops-messaging-tab-sms" />
      </Tabs>

      {/* ── CREDENTIALS ─────────────────────────────────────── */}
      {tab === 0 && config && (
        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start">
          <Paper variant="outlined" sx={{ p: 3, flex: 1, borderRadius: 2, width: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <EmailIcon fontSize="small" /><Typography variant="subtitle1" fontWeight={800}>Email (SMTP)</Typography>
            </Stack>
            <Stack spacing={2}>
              <TextField label="SMTP host" size="small" fullWidth value={config.smtp_host}
                onChange={(e) => set({ smtp_host: e.target.value })}
                slotProps={{ htmlInput: { "data-testid": "ops-smtp-host-input" } }} />
              <Stack direction="row" spacing={2}>
                <TextField label="Port" size="small" type="number" sx={{ width: 140 }}
                  value={config.smtp_port}
                  onChange={(e) => set({ smtp_port: Number(e.target.value) })}
                  slotProps={{ htmlInput: { "data-testid": "ops-smtp-port-input" } }} />
                <TextField label="Username" size="small" fullWidth value={config.smtp_username}
                  onChange={(e) => set({ smtp_username: e.target.value })}
                  slotProps={{ htmlInput: { "data-testid": "ops-smtp-username-input" } }} />
              </Stack>
              <TextField
                label="Password" size="small" fullWidth type="password"
                value={config.smtp_password ?? ""}
                onChange={(e) => set({ smtp_password: e.target.value })}
                placeholder={config.has_smtp_password ? "•••••••• (saved — leave blank to keep)" : "Enter password"}
                helperText="Stored write-only. Type a new password to replace it; leave blank to keep the current one."
                slotProps={{ htmlInput: { "data-testid": "ops-smtp-password-input" } }}
              />
              <Stack direction="row" spacing={2}>
                <TextField label="From email" size="small" fullWidth value={config.from_email}
                  onChange={(e) => set({ from_email: e.target.value })}
                  slotProps={{ htmlInput: { "data-testid": "ops-smtp-from-email-input" } }} />
                <TextField label="From name" size="small" fullWidth value={config.from_name}
                  onChange={(e) => set({ from_name: e.target.value })}
                  slotProps={{ htmlInput: { "data-testid": "ops-smtp-from-name-input" } }} />
              </Stack>
              <Stack direction="row" spacing={2}>
                <FormControlLabel label="Use TLS" control={
                  <Switch checked={config.smtp_use_tls} data-testid="ops-smtp-tls-switch"
                    onChange={(e) => set({
                      smtp_use_tls: e.target.checked,
                      // TLS and SSL are mutually exclusive; ports differ too.
                      smtp_use_ssl: e.target.checked ? false : config.smtp_use_ssl,
                      smtp_port: e.target.checked && config.smtp_port === 465 ? 587 : config.smtp_port,
                    })} />} />
                <FormControlLabel label="Use SSL" control={
                  <Switch checked={config.smtp_use_ssl} data-testid="ops-smtp-ssl-switch"
                    onChange={(e) => set({
                      smtp_use_ssl: e.target.checked,
                      smtp_use_tls: e.target.checked ? false : config.smtp_use_tls,
                      smtp_port: e.target.checked && config.smtp_port === 587 ? 465 : config.smtp_port,
                    })} />} />
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, flex: 1, borderRadius: 2, width: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <SmsIcon fontSize="small" /><Typography variant="subtitle1" fontWeight={800}>SMS</Typography>
            </Stack>
            <Stack spacing={2}>
              <TextField
                label="API key" size="small" fullWidth type="password"
                value={config.sms_api_key ?? ""}
                onChange={(e) => set({ sms_api_key: e.target.value })}
                placeholder={config.has_sms_api_key ? "•••••••• (saved — leave blank to keep)" : "Enter API key"}
                slotProps={{ htmlInput: { "data-testid": "ops-sms-apikey-input" } }}
              />
              <TextField label="Sender ID" size="small" fullWidth value={config.sms_sender_id}
                onChange={(e) => set({ sms_sender_id: e.target.value })}
                slotProps={{ htmlInput: { "data-testid": "ops-sms-senderid-input" } }} />
              <TextField label="DLT entity ID" size="small" fullWidth value={config.sms_entity_id}
                onChange={(e) => set({ sms_entity_id: e.target.value })}
                helperText="Indian carriers reject any SMS sent without a registered DLT entity."
                slotProps={{ htmlInput: { "data-testid": "ops-sms-entityid-input" } }} />
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No SMS gateway is wired into the platform yet. Credentials and DLT ids are stored
                and ready — SMS will start sending as soon as a provider is connected.
              </Alert>
            </Stack>
          </Paper>
        </Stack>
      )}

      {tab === 0 && (
        <Box>
          <Button variant="contained" onClick={saveConfig} disabled={savingConfig}
            data-testid="ops-messaging-save-config-btn">
            {savingConfig ? "Saving…" : "Save credentials"}
          </Button>
        </Box>
      )}

      {/* ── TEMPLATES ───────────────────────────────────────── */}
      {tab > 0 && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
          <Paper variant="outlined" sx={{ width: { xs: "100%", md: 300 }, flexShrink: 0, borderRadius: 2 }}>
            <List disablePadding sx={{ maxHeight: 560, overflowY: "auto" }}>
              {(tab === 1 ? emails : smses).map((t) => (
                <ListItemButton key={t.id} selected={selected?.id === t.id}
                  onClick={() => setSelected(t)}
                  data-testid={`ops-template-item-${t.channel}-${t.trigger_key}`}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>{t.name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {t.trigger_key}
                    </Typography>
                    <Stack direction="row" spacing={0.5} mt={0.5}>
                      {t.module_code && <Chip size="small" label={t.module_code} sx={{ height: 18, fontSize: "0.62rem" }} />}
                      {!t.is_active && <Chip size="small" color="warning" label="off" sx={{ height: 18, fontSize: "0.62rem" }} />}
                    </Stack>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          </Paper>

          {draft && (
            <Paper variant="outlined" sx={{ flex: 1, p: 3, borderRadius: 2, width: "100%" }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <Typography variant="subtitle1" fontWeight={800}>{draft.name}</Typography>
                <Chip size="small" icon={<LockIcon sx={{ fontSize: 13 }} />}
                  label={draft.trigger_key} sx={{ height: 22, fontSize: "0.68rem" }} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                The trigger, channel and variables are fixed by the code that sends this message —
                only the wording can change here.
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={2}>
                <TextField label="Name" size="small" fullWidth value={draft.name}
                  onChange={(e) => setDraftField({ name: e.target.value })} />
                {draft.channel === "email" ? (
                  <>
                    <TextField label="Subject" size="small" fullWidth value={draft.subject}
                      onChange={(e) => setDraftField({ subject: e.target.value })}
                      slotProps={{ htmlInput: { "data-testid": "ops-template-subject-input" } }} />
                    <TextField label="HTML body" size="small" fullWidth multiline minRows={12}
                      value={draft.body} onChange={(e) => setDraftField({ body: e.target.value })}
                      helperText="Inline CSS only — mail clients strip <style> blocks."
                      slotProps={{ htmlInput: { "data-testid": "ops-template-body-input", style: { fontFamily: "monospace", fontSize: 12 } } }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>PREVIEW</Typography>
                      <Box component="iframe" title="preview" sandbox="" srcDoc={draft.body}
                        data-testid="ops-template-preview"
                        sx={{ width: "100%", height: 380, mt: 1, border: "1px solid #e5e7eb", borderRadius: 2, bgcolor: "#f4f5f7" }} />
                    </Box>
                  </>
                ) : (
                  <>
                    <TextField label="Message" size="small" fullWidth multiline minRows={4}
                      value={draft.content} onChange={(e) => setDraftField({ content: e.target.value })}
                      slotProps={{ htmlInput: { "data-testid": "ops-template-content-input" } }} />
                    <TextField label="DLT template id" size="small" fullWidth value={draft.dlt_template_id}
                      onChange={(e) => setDraftField({ dlt_template_id: e.target.value })}
                      helperText="Without this the carrier rejects the send, so the message is skipped."
                      slotProps={{ htmlInput: { "data-testid": "ops-template-dlt-input" } }} />
                  </>
                )}

                {draft.available_variables?.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      AVAILABLE VARIABLES
                    </Typography>
                    <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                      {draft.available_variables.map((v) => (
                        <Chip key={v} size="small" label={`{${v}}`}
                          sx={{ height: 22, fontSize: "0.68rem", fontFamily: "monospace" }} />
                      ))}
                    </Stack>
                  </Box>
                )}

                <FormControlLabel
                  // The label wraps rather than being clipped by the card edge.
                  sx={{ alignItems: "flex-start", m: 0, "& .MuiFormControlLabel-label": { pt: 0.75 } }}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Active</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Turn off to stop sending this message entirely.
                      </Typography>
                    </Box>
                  }
                  control={<Switch checked={draft.is_active} data-testid="ops-template-active-switch"
                    onChange={(e) => setDraftField({ is_active: e.target.checked })} />} />

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Button variant="contained" onClick={saveTemplate} disabled={!dirty || savingTpl}
                    data-testid="ops-template-save-btn">
                    {savingTpl ? "Saving…" : "Save template"}
                  </Button>
                  {/* Say WHY the button is inert, instead of leaving a dead control. */}
                  {!dirty && !savingTpl && (
                    <Typography variant="caption" color="text.secondary">
                      No changes to save
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Paper>
          )}
        </Stack>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
        message={toast ?? ""} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} />
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>
    </Stack>
  );
}

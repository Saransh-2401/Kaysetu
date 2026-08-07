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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LockIcon from "@mui/icons-material/LockOutlined";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SmsIcon from "@mui/icons-material/SmsOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  MenuItem,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  FormControlLabel,
  alpha,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { EmptyState, PageHeader, SectionHeader, Surface, enterSx } from "@/components/ui/kit";
import { RADIUS } from "@/theme";
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
  sms_provider: string;
  sms_api_key?: string;
  sms_sender_id: string;
  sms_entity_id: string;
  sms_endpoint: string;
  fcm_service_account?: string;
  has_smtp_password: boolean;
  has_sms_api_key: boolean;
  has_fcm_key: boolean;
  email_ready: boolean;
  sms_ready: boolean;
  push_ready: boolean;
}

/** Channel readiness tile — states the consequence, not just the state. */
function ReadyCard({
  icon,
  channel,
  ready,
  readyHint,
  blockedHint,
  testId,
  index,
}: {
  icon: React.ReactNode;
  channel: string;
  ready: boolean;
  readyHint: string;
  blockedHint: string;
  testId: string;
  index: number;
}) {
  const theme = useTheme();
  const c = ready ? theme.palette.success.main : theme.palette.warning.main;
  return (
    <Surface padded={false} sx={enterSx(index)}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 2 }}>
        <Box
          aria-hidden
          sx={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: "9px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(c, 0.13),
            color: c,
            "& .MuiSvgIcon-root": { fontSize: 18 },
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
            <Typography variant="body2" fontWeight={700}>
              {channel}
            </Typography>
            {/* Icon + label, so readiness never depends on colour alone. */}
            <Chip
              size="small"
              data-testid={testId}
              icon={
                ready ? (
                  <CheckCircleIcon sx={{ fontSize: 12 }} />
                ) : (
                  <ErrorOutlineIcon sx={{ fontSize: 12 }} />
                )
              }
              label={ready ? "Ready" : "Not configured"}
              sx={{
                height: 20,
                fontSize: "0.65rem",
                fontWeight: 700,
                bgcolor: alpha(c, 0.13),
                color: ready ? "success.dark" : "warning.dark",
                "& .MuiChip-icon": { color: "inherit", ml: "5px" },
              }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            {ready ? readyHint : blockedHint}
          </Typography>
        </Box>
      </Stack>
    </Surface>
  );
}

export default function MessagingPage() {
  const theme = useTheme();
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

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
  }, [selected]);

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      // Only send secrets when actually retyped — the API treats blank as
      // "keep the stored value", so clearing the box must not wipe delivery
      // for every tenant.
      const payload: Record<string, unknown> = {
        smtp_host: config.smtp_host,
        smtp_port: config.smtp_port,
        smtp_username: config.smtp_username,
        smtp_use_tls: config.smtp_use_tls,
        smtp_use_ssl: config.smtp_use_ssl,
        from_email: config.from_email,
        from_name: config.from_name,
        sms_provider: config.sms_provider,
        sms_sender_id: config.sms_sender_id,
        sms_entity_id: config.sms_entity_id,
        sms_endpoint: config.sms_endpoint,
      };
      if (config.smtp_password) payload.smtp_password = config.smtp_password;
      if (config.sms_api_key) payload.sms_api_key = config.sms_api_key;
      if (config.fcm_service_account)
        payload.fcm_service_account = config.fcm_service_account;

      const saved = await api<MessagingConfig>("ops", "/sa/messaging-config", {
        method: "PATCH",
        body: payload,
      });
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
          name: draft.name,
          description: draft.description,
          subject: draft.subject,
          body: draft.body,
          content: draft.content,
          dlt_template_id: draft.dlt_template_id,
          is_active: draft.is_active,
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

  const set = (patch: Partial<MessagingConfig>) => setConfig((c) => (c ? { ...c, ...patch } : c));
  const setDraftField = (patch: Partial<MessageTemplate>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const dirty = !!draft && !!selected && JSON.stringify(draft) !== JSON.stringify(selected);
  const emails = templates.filter((t) => t.channel === "email");
  const smses = templates.filter((t) => t.channel === "sms");

  if (loading) {
    return (
      <Box data-testid="ops-messaging-page">
        <PageHeader
          title="Messaging"
          subtitle="Platform-owned email, SMS and push"
          icon={<MarkEmailReadIcon />}
        />
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={82} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={420} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box data-testid="ops-messaging-page">
      <PageHeader
        title="Messaging"
        subtitle="KaySetu sends every tenant's email and SMS on these credentials — tenants can view the templates but never edit them"
        icon={<MarkEmailReadIcon />}
      />

      {/* ── Channel readiness ───────────────────────────────────── */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          mb: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <ReadyCard
          index={0}
          icon={<EmailIcon />}
          channel="Email"
          ready={Boolean(config?.email_ready)}
          readyHint="SMTP is configured and sending."
          blockedHint="No SMTP host or password — email will not send."
          testId="ops-messaging-email-status"
        />
        <ReadyCard
          index={1}
          icon={<SmsIcon />}
          channel="SMS"
          ready={Boolean(config?.sms_ready)}
          readyHint="Gateway and DLT identity are set."
          blockedHint="No gateway or API key — SMS is skipped."
          testId="ops-messaging-sms-status"
        />
        <ReadyCard
          index={2}
          icon={<NotificationsActiveIcon />}
          channel="Push"
          ready={Boolean(config?.push_ready)}
          readyHint="Firebase service account stored — devices can be reached."
          blockedHint="No Firebase service account — push notifications are skipped."
          testId="ops-messaging-push-status"
        />
      </Box>

      <Surface padded={false} sx={enterSx(3)}>
        <Box sx={{ px: 1.5, borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}` }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab label="Credentials" data-testid="ops-messaging-tab-credentials" />
            <Tab label={`Email templates (${emails.length})`} data-testid="ops-messaging-tab-email" />
            <Tab label={`SMS templates (${smses.length})`} data-testid="ops-messaging-tab-sms" />
          </Tabs>
        </Box>

        {/* ── CREDENTIALS ─────────────────────────────────────── */}
        {tab === 0 && config && (
          <Box sx={{ p: 2.5 }}>
            <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} alignItems="stretch">
              {/* Email */}
              <Surface sx={{ flex: 1, width: "100%" }}>
                <SectionHeader
                  title="Email (SMTP)"
                  subtitle="The mailbox every tenant notification is sent from"
                  icon={<EmailIcon />}
                />
                <Stack spacing={2}>
                  <TextField
                    label="SMTP host"
                    size="small"
                    fullWidth
                    value={config.smtp_host}
                    onChange={(e) => set({ smtp_host: e.target.value })}
                    slotProps={{ htmlInput: { "data-testid": "ops-smtp-host-input" } }}
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Port"
                      size="small"
                      type="number"
                      sx={{ width: 130 }}
                      value={config.smtp_port}
                      onChange={(e) => set({ smtp_port: Number(e.target.value) })}
                      slotProps={{ htmlInput: { "data-testid": "ops-smtp-port-input" } }}
                    />
                    <TextField
                      label="Username"
                      size="small"
                      fullWidth
                      value={config.smtp_username}
                      onChange={(e) => set({ smtp_username: e.target.value })}
                      slotProps={{ htmlInput: { "data-testid": "ops-smtp-username-input" } }}
                    />
                  </Stack>
                  <TextField
                    label="Password"
                    size="small"
                    fullWidth
                    type="password"
                    value={config.smtp_password ?? ""}
                    onChange={(e) => set({ smtp_password: e.target.value })}
                    placeholder={config.has_smtp_password ? "•••••••••• saved" : "Enter password"}
                    helperText={
                      config.has_smtp_password
                        ? "A password is stored. Type a new one to replace it, or leave blank to keep it."
                        : "Stored write-only — it is never sent back to this screen."
                    }
                    slotProps={{
                      htmlInput: { "data-testid": "ops-smtp-password-input" },
                      // Without shrink the placeholder is hidden behind the label
                      // until the field is focused, so a stored secret looked blank.
                      inputLabel: { shrink: true },
                      input: {
                        endAdornment: config.has_smtp_password ? (
                          <Chip
                            size="small"
                            color="success"
                            variant="outlined"
                            label="Saved"
                            data-testid="ops-smtp-password-saved-chip"
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        ) : undefined,
                      },
                    }}
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="From email"
                      size="small"
                      fullWidth
                      value={config.from_email}
                      onChange={(e) => set({ from_email: e.target.value })}
                      slotProps={{
                        htmlInput: { "data-testid": "ops-smtp-from-email-input", inputMode: "email" },
                      }}
                    />
                    <TextField
                      label="From name"
                      size="small"
                      fullWidth
                      value={config.from_name}
                      onChange={(e) => set({ from_name: e.target.value })}
                      slotProps={{ htmlInput: { "data-testid": "ops-smtp-from-name-input" } }}
                    />
                  </Stack>
                  <Box
                    sx={{
                      p: 1.25,
                      borderRadius: "10px",
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      Encryption — TLS and SSL are mutually exclusive
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <FormControlLabel
                        label={<Typography variant="body2">Use TLS</Typography>}
                        control={
                          <Switch
                            checked={config.smtp_use_tls}
                            data-testid="ops-smtp-tls-switch"
                            onChange={(e) =>
                              set({
                                smtp_use_tls: e.target.checked,
                                // TLS and SSL are mutually exclusive; ports differ too.
                                smtp_use_ssl: e.target.checked ? false : config.smtp_use_ssl,
                                smtp_port:
                                  e.target.checked && config.smtp_port === 465 ? 587 : config.smtp_port,
                              })
                            }
                          />
                        }
                      />
                      <FormControlLabel
                        label={<Typography variant="body2">Use SSL</Typography>}
                        control={
                          <Switch
                            checked={config.smtp_use_ssl}
                            data-testid="ops-smtp-ssl-switch"
                            onChange={(e) =>
                              set({
                                smtp_use_ssl: e.target.checked,
                                smtp_use_tls: e.target.checked ? false : config.smtp_use_tls,
                                smtp_port:
                                  e.target.checked && config.smtp_port === 587 ? 465 : config.smtp_port,
                              })
                            }
                          />
                        }
                      />
                    </Stack>
                  </Box>
                </Stack>
              </Surface>

              {/* SMS + Push */}
              <Surface sx={{ flex: 1, width: "100%" }}>
                <SectionHeader
                  title="SMS"
                  subtitle="Indian carriers reject sends without DLT registration"
                  icon={<SmsIcon />}
                  color={theme.palette.info.main}
                />
                <Stack spacing={2}>
                  <TextField
                    label="API key"
                    size="small"
                    fullWidth
                    type="password"
                    value={config.sms_api_key ?? ""}
                    onChange={(e) => set({ sms_api_key: e.target.value })}
                    placeholder={config.has_sms_api_key ? "•••••••••• saved" : "Enter API key"}
                    helperText={
                      config.has_sms_api_key
                        ? "An API key is stored. Type a new one to replace it, or leave blank to keep it."
                        : "Stored write-only — it is never sent back to this screen."
                    }
                    slotProps={{
                      htmlInput: { "data-testid": "ops-sms-apikey-input" },
                      inputLabel: { shrink: true }, // else the placeholder stays hidden
                      input: {
                        endAdornment: config.has_sms_api_key ? (
                          <Chip
                            size="small"
                            color="success"
                            variant="outlined"
                            label="Saved"
                            data-testid="ops-sms-apikey-saved-chip"
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        ) : undefined,
                      },
                    }}
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Sender ID"
                      size="small"
                      fullWidth
                      value={config.sms_sender_id}
                      onChange={(e) => set({ sms_sender_id: e.target.value })}
                      slotProps={{ htmlInput: { "data-testid": "ops-sms-senderid-input" } }}
                    />
                    <TextField
                      label="DLT entity ID"
                      size="small"
                      fullWidth
                      value={config.sms_entity_id}
                      onChange={(e) => set({ sms_entity_id: e.target.value })}
                      helperText="Carriers reject SMS without a registered DLT entity."
                      slotProps={{ htmlInput: { "data-testid": "ops-sms-entityid-input" } }}
                    />
                  </Stack>
                  <TextField
                    select
                    label="Gateway"
                    size="small"
                    fullWidth
                    value={config.sms_provider || ""}
                    onChange={(e) => set({ sms_provider: e.target.value })}
                    helperText="Which gateway KaySetu sends on. Without one, SMS cannot send."
                    slotProps={{ htmlInput: { "data-testid": "ops-sms-provider-select" } }}
                  >
                    <MenuItem value="">Not configured</MenuItem>
                    <MenuItem value="smsgatewayhub">SMSGatewayHub</MenuItem>
                    <MenuItem value="msg91">MSG91</MenuItem>
                    <MenuItem value="textlocal">Textlocal</MenuItem>
                    <MenuItem value="generic">Generic HTTP (custom URL)</MenuItem>
                  </TextField>

                  {config.sms_provider === "generic" && (
                    <TextField
                      label="Endpoint URL"
                      size="small"
                      fullWidth
                      value={config.sms_endpoint || ""}
                      onChange={(e) => set({ sms_endpoint: e.target.value })}
                      helperText="Supports {phone} {text} {sender} {api_key} {entity_id} {dlt_template_id}."
                      slotProps={{ htmlInput: { "data-testid": "ops-sms-endpoint-input", inputMode: "url" } }}
                    />
                  )}

                  <Divider sx={{ my: 0.5 }} />

                  <SectionHeader
                    title="Push (Firebase)"
                    subtitle="Devices register their token on sign-in"
                    icon={<NotificationsActiveIcon />}
                    color={theme.palette.secondary.main}
                  />
                  <TextField
                    label="Service account JSON"
                    size="small"
                    fullWidth
                    multiline
                    minRows={4}
                    value={config.fcm_service_account ?? ""}
                    onChange={(e) => set({ fcm_service_account: e.target.value })}
                    placeholder={
                      config.has_fcm_key
                        ? "•••••••• saved — paste a new JSON to replace it"
                        : '{"type":"service_account","project_id":"...","private_key":"..."}'
                    }
                    helperText={
                      config.has_fcm_key
                        ? "A service account is stored. Paste a new JSON to replace it, or leave blank to keep it."
                        : "Firebase Console → Project settings → Service accounts → Generate new private key, then paste the whole file. The old “server key” no longer works: Google retired that API in 2024."
                    }
                    slotProps={{
                      htmlInput: {
                        "data-testid": "ops-fcm-key-input",
                        style: { fontFamily: "monospace", fontSize: 11 },
                      },
                      inputLabel: { shrink: true },
                    }}
                  />
                  {config.has_fcm_key && (
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      label="Service account saved"
                      sx={{ alignSelf: "flex-start", height: 22, fontSize: "0.68rem" }}
                    />
                  )}
                </Stack>
              </Surface>
            </Stack>

            {/* Save bar sticks to the bottom so it's reachable without scrolling back. */}
            <Box
              sx={{
                position: "sticky",
                bottom: 0,
                mt: 2.5,
                mx: -2.5,
                mb: -2.5,
                px: 2.5,
                py: 1.75,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexWrap: "wrap",
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                backdropFilter: "blur(8px)",
                borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Button
                variant="contained"
                onClick={saveConfig}
                disabled={savingConfig}
                data-testid="ops-messaging-save-config-btn"
              >
                {savingConfig ? "Saving…" : "Save credentials"}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Applies to every tenant immediately.
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── TEMPLATES ───────────────────────────────────────── */}
        {tab > 0 && (
          <Box sx={{ p: 2.5 }}>
            {(tab === 1 ? emails : smses).length === 0 ? (
              <EmptyState
                icon={tab === 1 ? <EmailIcon /> : <SmsIcon />}
                message={`No ${tab === 1 ? "email" : "SMS"} templates in the catalogue`}
                hint="Templates ship with the backend code — none are registered for this channel."
              />
            ) : (
              <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems="flex-start">
                {/* Template list */}
                <Surface padded={false} sx={{ width: { xs: "100%", md: 290 }, flexShrink: 0 }}>
                  <List disablePadding sx={{ maxHeight: 620, overflowY: "auto" }}>
                    {(tab === 1 ? emails : smses).map((t) => {
                      const isSelected = selected?.id === t.id;
                      return (
                        <ListItemButton
                          key={t.id}
                          selected={isSelected}
                          onClick={() => setSelected(t)}
                          data-testid={`ops-template-item-${t.channel}-${t.trigger_key}`}
                          sx={{
                            px: 1.75,
                            py: 1.25,
                            borderLeft: `3px solid ${
                              isSelected ? theme.palette.secondary.main : "transparent"
                            }`,
                            "&.Mui-selected, &.Mui-selected:hover": {
                              bgcolor: alpha(theme.palette.secondary.main, 0.08),
                            },
                          }}
                        >
                          <Box sx={{ minWidth: 0, width: "100%" }}>
                            <Typography
                              variant="body2"
                              fontWeight={isSelected ? 700 : 600}
                              noWrap
                              sx={{ fontSize: "0.8rem" }}
                            >
                              {t.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{
                                display: "block",
                                fontSize: "0.66rem",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              }}
                            >
                              {t.trigger_key}
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.6 }}>
                              {t.module_code && (
                                <Chip
                                  size="small"
                                  label={t.module_code}
                                  sx={{ height: 17, fontSize: "0.58rem", fontWeight: 700 }}
                                />
                              )}
                              {!t.is_active && (
                                <Chip
                                  size="small"
                                  label="off"
                                  sx={{
                                    height: 17,
                                    fontSize: "0.58rem",
                                    fontWeight: 700,
                                    bgcolor: alpha(theme.palette.warning.main, 0.15),
                                    color: "warning.dark",
                                  }}
                                />
                              )}
                            </Stack>
                          </Box>
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Surface>

                {/* Editor */}
                {draft && (
                  <Surface sx={{ flex: 1, width: "100%" }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }} flexWrap="wrap">
                      <Typography variant="subtitle1" sx={{ fontSize: "0.95rem" }}>
                        {draft.name}
                      </Typography>
                      <Chip
                        size="small"
                        icon={<LockIcon sx={{ fontSize: 12 }} />}
                        label={draft.trigger_key}
                        sx={{
                          height: 21,
                          fontSize: "0.65rem",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          "& .MuiChip-icon": { ml: "6px" },
                        }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      The trigger, channel and variables are fixed by the code that sends this message —
                      only the wording can change here.
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Stack spacing={2}>
                      <TextField
                        label="Name"
                        size="small"
                        fullWidth
                        value={draft.name}
                        onChange={(e) => setDraftField({ name: e.target.value })}
                      />

                      {draft.channel === "email" ? (
                        <>
                          <TextField
                            label="Subject"
                            size="small"
                            fullWidth
                            value={draft.subject}
                            onChange={(e) => setDraftField({ subject: e.target.value })}
                            slotProps={{ htmlInput: { "data-testid": "ops-template-subject-input" } }}
                          />
                          <TextField
                            label="HTML body"
                            size="small"
                            fullWidth
                            multiline
                            minRows={12}
                            value={draft.body}
                            onChange={(e) => setDraftField({ body: e.target.value })}
                            helperText="Inline CSS only — mail clients strip <style> blocks."
                            slotProps={{
                              htmlInput: {
                                "data-testid": "ops-template-body-input",
                                style: {
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                  fontSize: 12,
                                },
                              },
                            }}
                          />
                          <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                              Preview
                            </Typography>
                            <Box
                              component="iframe"
                              title="Email template preview"
                              sandbox=""
                              srcDoc={draft.body}
                              data-testid="ops-template-preview"
                              sx={{
                                width: "100%",
                                height: 380,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                borderRadius: RADIUS.md,
                                bgcolor: "#f4f5f7",
                              }}
                            />
                          </Box>
                        </>
                      ) : (
                        <>
                          <TextField
                            label="Message"
                            size="small"
                            fullWidth
                            multiline
                            minRows={4}
                            value={draft.content}
                            onChange={(e) => setDraftField({ content: e.target.value })}
                            helperText={`${draft.content.length} characters`}
                            slotProps={{ htmlInput: { "data-testid": "ops-template-content-input" } }}
                          />
                          <TextField
                            label="DLT template id"
                            size="small"
                            fullWidth
                            value={draft.dlt_template_id}
                            onChange={(e) => setDraftField({ dlt_template_id: e.target.value })}
                            helperText="Without this the carrier rejects the send, so the message is skipped."
                            slotProps={{ htmlInput: { "data-testid": "ops-template-dlt-input" } }}
                          />
                        </>
                      )}

                      {draft.available_variables?.length > 0 && (
                        <Box>
                          <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                            Available variables
                          </Typography>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                            {draft.available_variables.map((v) => (
                              <Chip
                                key={v}
                                size="small"
                                label={`{${v}}`}
                                sx={{
                                  height: 21,
                                  fontSize: "0.66rem",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                                }}
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}

                      <FormControlLabel
                        // The label wraps rather than being clipped by the card edge.
                        sx={{ alignItems: "flex-start", m: 0, "& .MuiFormControlLabel-label": { pt: 0.5 } }}
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              Active
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Turn off to stop sending this message entirely.
                            </Typography>
                          </Box>
                        }
                        control={
                          <Switch
                            checked={draft.is_active}
                            data-testid="ops-template-active-switch"
                            onChange={(e) => setDraftField({ is_active: e.target.checked })}
                          />
                        }
                      />

                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Button
                          variant="contained"
                          onClick={saveTemplate}
                          disabled={!dirty || savingTpl}
                          data-testid="ops-template-save-btn"
                        >
                          {savingTpl ? "Saving…" : "Save template"}
                        </Button>
                        {/* Say WHY the button is inert, instead of leaving a dead control. */}
                        {!dirty && !savingTpl && (
                          <Typography variant="caption" color="text.secondary">
                            No changes to save
                          </Typography>
                        )}
                        {dirty && !savingTpl && (
                          <Typography variant="caption" color="warning.dark" fontWeight={600}>
                            Unsaved changes
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </Surface>
                )}
              </Stack>
            )}
          </Box>
        )}
      </Surface>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

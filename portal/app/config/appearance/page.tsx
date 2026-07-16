"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  Card,
  CardActionArea,
  CircularProgress,
  Paper,
  TextField,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { motion } from "framer-motion";
import { CheckCircleIcon, PaletteIcon, SaveIcon, PublicIcon, TuneIcon } from "@/components/icons";
import { toast } from "sonner";

import {
  SCHEMES,
  ColorScheme,
  CustomSchemeInput,
  buildCustomScheme,
  DEFAULT_CUSTOM_INPUT,
  CUSTOM_SCHEME_KEY,
} from "@/theme/schemes";
import { readableOn } from "@/theme/colorMath";
import { useAppTheme } from "@/components/ClientThemeWrapper";
import { coreService, Company } from "@/lib/core-service";

/** A small mock of the CRM chrome rendered in a scheme's colors. */
function SchemePreview({ scheme }: { scheme: ColorScheme }) {
  const s = scheme.light;
  return (
    <Box
      sx={{ bgcolor: s.background, p: 2, display: "flex", gap: 1, height: 132 }}
      data-testid={`appearance-preview-${scheme.key}`}
    >
      <Box
        sx={{
          width: 34,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${scheme.primary} 0%, ${scheme.gradientEnd} 100%)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.75,
          py: 1,
        }}
      >
        <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: scheme.secondary }} />
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{ width: 16, height: 4, borderRadius: 1, bgcolor: alpha(readableOn(scheme.primary), 0.5) }}
          />
        ))}
      </Box>

      <Box
        sx={{
          flex: 1,
          bgcolor: s.paper,
          borderRadius: 2,
          p: 1.5,
          boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Box sx={{ height: 7, width: "55%", borderRadius: 1, bgcolor: alpha(s.textPrimary, 0.85) }} />
        <Box sx={{ height: 5, width: "80%", borderRadius: 1, bgcolor: alpha(s.textSecondary, 0.5) }} />
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: "auto" }}>
          <Box
            sx={{
              px: 1,
              py: 0.4,
              borderRadius: 1,
              fontSize: 9,
              fontWeight: 700,
              color: readableOn(scheme.primary),
              background: `linear-gradient(135deg, ${scheme.primary}, ${scheme.gradientEnd})`,
            }}
          >
            Action
          </Box>
          <Box
            sx={{
              px: 1,
              py: 0.4,
              borderRadius: 1,
              fontSize: 9,
              fontWeight: 700,
              color: readableOn(scheme.secondary),
              bgcolor: scheme.secondary,
            }}
          >
            Tag
          </Box>
          <Box sx={{ flex: 1 }} />
          {[scheme.success, scheme.warning, scheme.error].map((c) => (
            <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: c }} />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

function ColorField({
  label,
  value,
  onChange,
  testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testid: string;
}) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 150 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          component="input"
          type="color"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          data-testid={testid}
          sx={{
            width: 42,
            height: 38,
            p: 0,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            cursor: "pointer",
            bgcolor: "transparent",
          }}
        />
        <TextField
          size="small"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          sx={{ width: 110 }}
          inputProps={{ "data-testid": `${testid}-hex`, maxLength: 7 }}
        />
      </Stack>
    </Stack>
  );
}

export default function AppearancePage() {
  const { schemeKey, setScheme, customInput, setCustom, fontKey, setFont, fonts } = useAppTheme();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [savedScheme, setSavedScheme] = useState<string>(schemeKey);
  const [savedCustomJson, setSavedCustomJson] = useState<string>("");
  const [savedFont, setSavedFont] = useState<string>(fontKey);
  const [customDraft, setCustomDraft] = useState<CustomSchemeInput>(
    customInput ?? DEFAULT_CUSTOM_INPUT
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await coreService.getCurrentCompany();
        setCompanyId(c.id);
        const key = c.active_color_scheme || schemeKey;
        setSavedScheme(key);
        if (c.custom_color_scheme) {
          setCustomDraft(c.custom_color_scheme);
          setSavedCustomJson(JSON.stringify(c.custom_color_scheme));
        }
        if (c.active_font) setSavedFont(c.active_font);
      } catch {
        /* keep local */
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCustom = schemeKey === CUSTOM_SCHEME_KEY;
  const schemeDirty = isCustom
    ? savedScheme !== CUSTOM_SCHEME_KEY || JSON.stringify(customDraft) !== savedCustomJson
    : schemeKey !== savedScheme;
  const dirty = schemeDirty || fontKey !== savedFont;

  const updateCustom = (patch: Partial<CustomSchemeInput>) => {
    const next = { ...customDraft, ...patch };
    setCustomDraft(next);
    setCustom(next); // live preview + select the custom scheme
  };

  const handleSave = async () => {
    if (companyId == null) {
      toast.error("Company not loaded yet — try again in a moment.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Company> = {
        active_color_scheme: schemeKey,
        active_font: fontKey,
      };
      if (isCustom) payload.custom_color_scheme = customDraft;
      await coreService.updateCompany(companyId, payload);
      setSavedScheme(schemeKey);
      setSavedFont(fontKey);
      if (isCustom) setSavedCustomJson(JSON.stringify(customDraft));
      toast.success("Appearance applied across the entire CRM.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save color scheme.");
    } finally {
      setSaving(false);
    }
  };

  const customScheme = buildCustomScheme(customDraft);

  return (
    <Box className="page-enter" sx={{ p: { xs: 2, md: 3 } }} data-testid="appearance-page">
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <PaletteIcon sx={{ color: "primary.main" }} />
            <Typography variant="h5" fontWeight={800} color="text.primary">
              Appearance
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Pick a color scheme — or build your own — for the whole CRM. Tap a card to preview it live,
            then save to apply it for every user.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || saving || loading}
          data-testid="appearance-save-btn"
        >
          {dirty ? "Save as global default" : "Saved"}
        </Button>
      </Stack>

      {/* Global notice */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          mb: 3,
          p: 1.5,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.info.main, 0.08),
          border: (t) => `1px solid ${alpha(t.palette.info.main, 0.2)}`,
        }}
        data-testid="appearance-global-notice"
      >
        <PublicIcon fontSize="small" sx={{ color: "info.main" }} />
        <Typography variant="caption" color="text.secondary">
          This is a <b>global</b> setting — the selected scheme is stored centrally and applied to all
          roles across the CRM.
        </Typography>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              gap: 2.5,
            }}
          >
            {[...SCHEMES, customScheme].map((scheme) => {
              const selected = scheme.key === schemeKey;
              const isGlobal = scheme.key === savedScheme;
              const isCustomCard = scheme.key === CUSTOM_SCHEME_KEY;
              return (
                <motion.div
                  key={scheme.key}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                >
                  <Card
                    elevation={0}
                    data-testid={`appearance-scheme-card-${scheme.key}`}
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      border: (t) =>
                        `2px solid ${selected ? t.palette.primary.main : alpha(t.palette.divider, 0.6)}`,
                      boxShadow: selected
                        ? (t) => `0 10px 28px ${alpha(t.palette.primary.main, 0.25)}`
                        : "0 4px 14px rgba(0,0,0,0.06)",
                      transition: "border-color .2s, box-shadow .2s",
                    }}
                  >
                    <CardActionArea
                      onClick={() => (isCustomCard ? setCustom(customDraft) : setScheme(scheme.key))}
                      data-testid={`appearance-scheme-select-${scheme.key}`}
                    >
                      <SchemePreview scheme={scheme} />
                      <Box sx={{ p: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            {isCustomCard && <TuneIcon fontSize="small" sx={{ color: "text.secondary" }} />}
                            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                              {isCustomCard ? "Custom" : scheme.name}
                            </Typography>
                          </Stack>
                          {selected && (
                            <CheckCircleIcon
                              sx={{ color: "primary.main" }}
                              data-testid={`appearance-selected-${scheme.key}`}
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.5, minHeight: 32 }}
                        >
                          {isCustomCard ? "Define your own brand colors below." : scheme.description}
                        </Typography>

                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.5 }}>
                          {[scheme.primary, scheme.secondary, ...scheme.chart.slice(2)].map((c, i) => (
                            <Box
                              key={`${scheme.key}-sw-${i}`}
                              sx={{
                                width: 22,
                                height: 22,
                                borderRadius: "6px",
                                bgcolor: c,
                                border: "1px solid rgba(0,0,0,0.08)",
                              }}
                            />
                          ))}
                          <Box sx={{ flex: 1 }} />
                          {isGlobal && (
                            <Chip
                              size="small"
                              label="Global"
                              color="primary"
                              variant="outlined"
                              data-testid={`appearance-global-chip-${scheme.key}`}
                            />
                          )}
                        </Stack>
                      </Box>
                    </CardActionArea>
                  </Card>
                </motion.div>
              );
            })}
          </Box>

          {/* Custom palette editor */}
          {isCustom && (
            <Paper
              elevation={0}
              data-testid="appearance-custom-editor"
              sx={{
                mt: 3,
                p: { xs: 2, md: 3 },
                borderRadius: 3,
                border: (t) => `1px solid ${alpha(t.palette.divider, 0.6)}`,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <TuneIcon sx={{ color: "primary.main" }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Custom palette
                </Typography>
              </Stack>

              <TextField
                label="Scheme name"
                size="small"
                value={customDraft.name ?? "Custom"}
                onChange={(e) => updateCustom({ name: e.target.value })}
                sx={{ mb: 2.5, maxWidth: 280 }}
                inputProps={{ "data-testid": "appearance-custom-name" }}
              />

              <Typography variant="overline" color="text.secondary">
                Brand & surfaces
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={2.5} sx={{ mt: 1, mb: 2.5 }}>
                <ColorField label="Primary" value={customDraft.primary} onChange={(v) => updateCustom({ primary: v })} testid="appearance-custom-primary" />
                <ColorField label="Secondary" value={customDraft.secondary} onChange={(v) => updateCustom({ secondary: v })} testid="appearance-custom-secondary" />
                <ColorField label="Background" value={customDraft.background} onChange={(v) => updateCustom({ background: v })} testid="appearance-custom-background" />
                <ColorField label="Surface / Paper" value={customDraft.paper} onChange={(v) => updateCustom({ paper: v })} testid="appearance-custom-paper" />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="overline" color="text.secondary">
                Status colors
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={2.5} sx={{ mt: 1 }}>
                <ColorField label="Success" value={customDraft.success ?? "#16A34A"} onChange={(v) => updateCustom({ success: v })} testid="appearance-custom-success" />
                <ColorField label="Warning" value={customDraft.warning ?? "#F59E0B"} onChange={(v) => updateCustom({ warning: v })} testid="appearance-custom-warning" />
                <ColorField label="Error" value={customDraft.error ?? "#DC2626"} onChange={(v) => updateCustom({ error: v })} testid="appearance-custom-error" />
                <ColorField label="Info" value={customDraft.info ?? "#0EA5E9"} onChange={(v) => updateCustom({ info: v })} testid="appearance-custom-info" />
              </Stack>
            </Paper>
          )}

          {/* Font picker */}
          <Box sx={{ mt: 4 }} data-testid="appearance-font-section">
            <Typography variant="h6" fontWeight={800} color="text.primary">
              Font
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Sets the typeface for the entire CRM. Tap to preview live, then save.
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(3, 1fr)",
                  md: "repeat(4, 1fr)",
                },
                gap: 2,
              }}
            >
              {fonts.map((f) => {
                const selected = f.key === fontKey;
                const isGlobalFont = f.key === savedFont;
                return (
                  <Card
                    key={f.key}
                    elevation={0}
                    data-testid={`appearance-font-card-${f.key}`}
                    sx={{
                      borderRadius: 3,
                      border: (t) =>
                        `2px solid ${selected ? t.palette.primary.main : alpha(t.palette.divider, 0.6)}`,
                      boxShadow: selected
                        ? (t) => `0 8px 22px ${alpha(t.palette.primary.main, 0.22)}`
                        : "0 3px 12px rgba(0,0,0,0.05)",
                      transition: "border-color .2s, box-shadow .2s",
                    }}
                  >
                    <CardActionArea
                      onClick={() => setFont(f.key)}
                      data-testid={`appearance-font-select-${f.key}`}
                    >
                      <Box sx={{ p: 2, fontFamily: f.family }}>
                        <Typography sx={{ fontFamily: f.family, fontWeight: 700, fontSize: 30, lineHeight: 1 }}>
                          Ag
                        </Typography>
                        <Typography sx={{ fontFamily: f.family, fontSize: 13, color: "text.secondary", mt: 0.75 }}>
                          The quick brown fox
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          px: 2,
                          pb: 1.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={700} fontSize={14} noWrap>
                            {f.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {f.note}
                          </Typography>
                        </Box>
                        {selected ? (
                          <CheckCircleIcon
                            sx={{ color: "primary.main", flexShrink: 0 }}
                            data-testid={`appearance-font-selected-${f.key}`}
                          />
                        ) : isGlobalFont ? (
                          <Chip size="small" label="Global" color="primary" variant="outlined" />
                        ) : null}
                      </Box>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

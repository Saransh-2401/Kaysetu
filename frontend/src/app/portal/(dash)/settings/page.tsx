"use client";
import PaletteIcon from "@mui/icons-material/Palette";
import {
  Box, Button, Card, CardActionArea, CardContent, Chip, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api, updatePortalOrg } from "@/lib/api";
import { SCHEMES } from "@/schemes";

interface OrgSettings {
  company_name: string;
  legal_name: string;
  gstin: string;
  industry: string;
  labels: Record<string, string>;
  appearance: { scheme?: string };
  setup_state: { done?: string[]; completed?: boolean };
}

export default function SettingsPage() {
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api<OrgSettings>("portal", "/t/org").then(setOrg);
  }, []);

  if (!org) return null;

  const save = async (patch: Partial<OrgSettings>, message: string) => {
    const updated = await api<OrgSettings>("portal", "/t/org", { method: "PATCH", body: patch });
    setOrg(updated);
    updatePortalOrg({
      labels: updated.labels,
      appearance: updated.appearance,
      name: updated.company_name,
      setup_state: updated.setup_state,
    });
    setToast(message);
  };

  return (
    <Box sx={{ maxWidth: 760 }} data-testid="portal-settings-container">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Settings</Typography>
        <Button component={Link} href="/portal/setup" data-testid="portal-settings-rerun-wizard-btn">
          Re-run setup wizard
        </Button>
      </Stack>

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="portal-settings-company-card">
        <CardContent>
          <Typography variant="h6" gutterBottom>Company</Typography>
          <Stack spacing={2}>
            <TextField label="Company name" value={org.company_name}
              onChange={(e) => setOrg({ ...org, company_name: e.target.value })}
              inputProps={{ "data-testid": "portal-settings-companyname-input" }} />
            <TextField label="Legal name" value={org.legal_name}
              onChange={(e) => setOrg({ ...org, legal_name: e.target.value })}
              inputProps={{ "data-testid": "portal-settings-legalname-input" }} />
            <TextField label="GSTIN" value={org.gstin}
              onChange={(e) => setOrg({ ...org, gstin: e.target.value.toUpperCase() })}
              inputProps={{ "data-testid": "portal-settings-gstin-input", maxLength: 15 }} />
            <Button variant="contained" sx={{ alignSelf: "flex-start" }}
              onClick={() => save(
                { company_name: org.company_name, legal_name: org.legal_name, gstin: org.gstin },
                "Company saved",
              )}
              data-testid="portal-settings-companysave-btn">
              Save company
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }} data-testid="portal-settings-terminology-card">
        <CardContent>
          <Typography variant="h6" gutterBottom>Terminology</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            What things are called across your portal (and your team&apos;s app).
          </Typography>
          <Stack spacing={2}>
            {[
              ["catalog_item", "One sellable thing"],
              ["catalog", "The list of them"],
              ["party_customer", "Who you sell to"],
              ["party_supplier", "Who you buy from"],
            ].map(([key, help]) => (
              <TextField key={key} label={help} value={org.labels[key] ?? ""}
                onChange={(e) => setOrg({ ...org, labels: { ...org.labels, [key]: e.target.value } })}
                inputProps={{ "data-testid": `portal-settings-label-${key}-input` }} />
            ))}
            <Button variant="contained" sx={{ alignSelf: "flex-start" }}
              onClick={() => save({ labels: org.labels }, "Terminology saved")}
              data-testid="portal-settings-labelsave-btn">
              Save terminology
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" data-testid="portal-settings-appearance-card">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <PaletteIcon color="primary" />
            <Typography variant="h6">Appearance</Typography>
          </Stack>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            {SCHEMES.map((scheme) => {
              const selected = (org.appearance.scheme ?? "navy-gold") === scheme.key;
              return (
                <Card key={scheme.key} variant="outlined"
                  sx={{ borderColor: selected ? scheme.primary : undefined, borderWidth: selected ? 2 : 1 }}>
                  <CardActionArea
                    onClick={() => {
                      const appearance = { scheme: scheme.key };
                      setOrg({ ...org, appearance });
                      save({ appearance }, `Theme: ${scheme.name}`);
                    }}
                    data-testid={`portal-settings-scheme-${scheme.key}`}>
                    <Box sx={{ height: 44, display: "flex" }}>
                      <Box sx={{ flex: 3, bgcolor: scheme.primary }} />
                      <Box sx={{ flex: 1, bgcolor: scheme.secondary }} />
                      <Box sx={{ flex: 1, bgcolor: scheme.background }} />
                    </Box>
                    <CardContent sx={{ py: 1.5 }}>
                      <Typography variant="subtitle2">
                        {scheme.name} {selected && <Chip size="small" color="primary" label="active" />}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Snackbar open={toast !== null} autoHideDuration={2000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

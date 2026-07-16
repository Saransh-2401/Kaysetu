"use client";
/**
 * Setup Wizard (spec Part C, W1-W10 subset live today):
 * Company -> Industry & Terminology -> Appearance -> Team -> Catalog -> Done.
 * Every step is skippable; progress persists in OrgSettings.setup_state so the
 * wizard is resumable and re-runnable from Settings.
 */
import CelebrationIcon from "@mui/icons-material/Celebration";
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip, MenuItem, Snackbar,
  Stack, Step, StepButton, Stepper, TextField, Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, getContext, updatePortalOrg, type PortalContext } from "@/lib/api";
import { SCHEMES } from "@/schemes";

const STEPS = [
  { key: "company", label: "Company" },
  { key: "terminology", label: "Industry & Terms" },
  { key: "appearance", label: "Appearance" },
  { key: "team", label: "Team" },
  { key: "catalog", label: "Catalog" },
  { key: "done", label: "Done" },
];

const INDUSTRY_PRESETS: Record<string, Record<string, string>> = {
  manufacturing: { catalog_item: "Product", catalog: "Products", party_customer: "Customer", party_supplier: "Supplier", visit: "Visit" },
  distribution: { catalog_item: "Product", catalog: "Products", party_customer: "Retailer", party_supplier: "Supplier", visit: "Visit" },
  services: { catalog_item: "Service", catalog: "Services", party_customer: "Client", party_supplier: "Vendor", visit: "Meeting" },
  generic: { catalog_item: "Item", catalog: "Catalog", party_customer: "Customer", party_supplier: "Supplier", visit: "Visit" },
};

interface OrgSettings {
  company_name: string;
  legal_name: string;
  gstin: string;
  industry: string;
  labels: Record<string, string>;
  appearance: { scheme?: string };
  setup_state: { done?: string[]; completed?: boolean };
}

export default function SetupWizardPage() {
  const router = useRouter();
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Step-local state
  const [invite, setInvite] = useState({ email: "", full_name: "", role_slug: "", password: "" });
  const [roles, setRoles] = useState<{ slug: string; name: string }[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [item, setItem] = useState({ name: "", kind: "product", price: "0", tax_rate: "18" });
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    api<OrgSettings>("portal", "/t/org").then((data) => {
      setOrg(data);
      const done = data.setup_state.done ?? [];
      const firstPending = STEPS.findIndex((step) => step.key !== "done" && !done.includes(step.key));
      setActive(firstPending === -1 ? STEPS.length - 1 : firstPending);
    });
    api<{ results: { slug: string; name: string }[] }>("portal", "/t/roles/").then((page) => setRoles(page.results));
    api<{ count: number }>("portal", "/t/users/").then((page) => setTeamCount(page.count));
    api<{ count: number }>("portal", "/t/catalog/").then((page) => setItemCount(page.count));
  }, []);

  if (!org) return null;

  const markDone = async (stepKey: string, patch: Partial<OrgSettings> = {}) => {
    const done = Array.from(new Set([...(org.setup_state.done ?? []), stepKey]));
    const completed = stepKey === "done" || (org.setup_state.completed ?? false);
    const setup_state = { done, completed };
    const updated = await api<OrgSettings>("portal", "/t/org", {
      method: "PATCH",
      body: { ...patch, setup_state },
    });
    setOrg(updated);
    updatePortalOrg({
      labels: updated.labels,
      appearance: updated.appearance,
      setup_state: updated.setup_state,
      name: updated.company_name,
    });
    if (stepKey !== "done") setActive((step) => step + 1);
  };

  const skip = () => setActive((step) => Math.min(step + 1, STEPS.length - 1));
  const stepKey = STEPS[active].key;

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }} data-testid="portal-setup-container">
      <Typography variant="h5" gutterBottom>
        Set up your workspace
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        About 5 minutes. Every step can be skipped and finished later from Settings.
      </Typography>

      <Stepper activeStep={active} nonLinear alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((step, index) => (
          <Step key={step.key} completed={(org.setup_state.done ?? []).includes(step.key)}>
            <StepButton onClick={() => setActive(index)} data-testid={`portal-setup-step-${step.key}`}>
              {step.label}
            </StepButton>
          </Step>
        ))}
      </Stepper>

      {stepKey === "company" && (
        <Card variant="outlined" data-testid="portal-setup-company-card">
          <CardContent>
            <Typography variant="h6" gutterBottom>Company profile</Typography>
            <Stack spacing={2}>
              <TextField label="Company name" value={org.company_name}
                onChange={(e) => setOrg({ ...org, company_name: e.target.value })}
                inputProps={{ "data-testid": "portal-setup-companyname-input" }} />
              <TextField label="Legal name" value={org.legal_name}
                onChange={(e) => setOrg({ ...org, legal_name: e.target.value })}
                inputProps={{ "data-testid": "portal-setup-legalname-input" }} />
              <TextField label="GSTIN" value={org.gstin}
                onChange={(e) => setOrg({ ...org, gstin: e.target.value.toUpperCase() })}
                inputProps={{ "data-testid": "portal-setup-gstin-input", maxLength: 15 }} />
            </Stack>
          </CardContent>
        </Card>
      )}

      {stepKey === "terminology" && (
        <Card variant="outlined" data-testid="portal-setup-terminology-card">
          <CardContent>
            <Typography variant="h6" gutterBottom>Industry & terminology</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Pick a preset, then fine-tune what things are called across your portal.
            </Typography>
            <TextField select fullWidth label="Industry preset" value={org.industry} sx={{ mb: 2 }}
              onChange={(e) => setOrg({
                ...org,
                industry: e.target.value,
                labels: { ...org.labels, ...INDUSTRY_PRESETS[e.target.value] },
              })}
              data-testid="portal-setup-industry-select">
              <MenuItem value="manufacturing">Manufacturing</MenuItem>
              <MenuItem value="distribution">Distribution & FMCG</MenuItem>
              <MenuItem value="services" data-testid="portal-setup-industry-option-services">Services / Insurance</MenuItem>
              <MenuItem value="generic">Other</MenuItem>
            </TextField>
            <Stack spacing={2}>
              {[
                ["catalog_item", "One sellable thing (Product / Service / Policy)"],
                ["catalog", "The list of them (Products / Services / Policies)"],
                ["party_customer", "Who you sell to (Customer / Client / Retailer)"],
                ["party_supplier", "Who you buy from (Supplier / Vendor)"],
              ].map(([key, help]) => (
                <TextField key={key} label={help} value={org.labels[key] ?? ""}
                  onChange={(e) => setOrg({ ...org, labels: { ...org.labels, [key]: e.target.value } })}
                  inputProps={{ "data-testid": `portal-setup-label-${key}-input` }} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {stepKey === "appearance" && (
        <Box data-testid="portal-setup-appearance-grid"
          sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          {SCHEMES.map((scheme) => {
            const selected = (org.appearance.scheme ?? "navy-gold") === scheme.key;
            return (
              <Card key={scheme.key} variant="outlined"
                sx={{ borderColor: selected ? scheme.primary : undefined, borderWidth: selected ? 2 : 1 }}>
                <CardActionArea onClick={() => setOrg({ ...org, appearance: { scheme: scheme.key } })}
                  data-testid={`portal-setup-scheme-${scheme.key}`}>
                  <Box sx={{ height: 56, display: "flex" }}>
                    <Box sx={{ flex: 3, bgcolor: scheme.primary }} />
                    <Box sx={{ flex: 1, bgcolor: scheme.secondary }} />
                    <Box sx={{ flex: 1, bgcolor: scheme.background }} />
                  </Box>
                  <CardContent>
                    <Typography variant="subtitle1">
                      {scheme.name} {selected && <Chip size="small" color="primary" label="selected" />}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{scheme.description}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}

      {stepKey === "team" && (
        <Card variant="outlined" data-testid="portal-setup-team-card">
          <CardContent>
            <Typography variant="h6" gutterBottom>Invite your team</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {teamCount} member{teamCount === 1 ? "" : "s"} so far. They sign in with your org code.
            </Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Full name" fullWidth value={invite.full_name}
                  onChange={(e) => setInvite({ ...invite, full_name: e.target.value })}
                  inputProps={{ "data-testid": "portal-setup-teamname-input" }} />
                <TextField label="Email" fullWidth value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  inputProps={{ "data-testid": "portal-setup-teamemail-input" }} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField select label="Role" fullWidth value={invite.role_slug}
                  onChange={(e) => setInvite({ ...invite, role_slug: e.target.value })}
                  data-testid="portal-setup-teamrole-select">
                  {roles.map((role) => (
                    <MenuItem key={role.slug} value={role.slug}
                      data-testid={`portal-setup-teamrole-option-${role.slug}`}>
                      {role.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Password" type="password" fullWidth value={invite.password}
                  onChange={(e) => setInvite({ ...invite, password: e.target.value })}
                  inputProps={{ "data-testid": "portal-setup-teampassword-input" }} />
              </Stack>
              <Button variant="outlined" disabled={!invite.email || !invite.full_name || invite.password.length < 8}
                onClick={async () => {
                  await api("portal", "/t/users/", { method: "POST", body: invite });
                  setTeamCount((count) => count + 1);
                  setInvite({ email: "", full_name: "", role_slug: "", password: "" });
                  setToast("Member added");
                }}
                data-testid="portal-setup-teamadd-btn">
                Add member
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {stepKey === "catalog" && (
        <Card variant="outlined" data-testid="portal-setup-catalog-card">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Add your first {(org.labels.catalog_item ?? "item").toLowerCase()}s
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {itemCount} added so far. Excel import arrives soon — quick-add works today.
            </Typography>
            <Stack spacing={2}>
              <TextField label="Name" value={item.name}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                inputProps={{ "data-testid": "portal-setup-itemname-input" }} />
              <Stack direction="row" spacing={2}>
                <TextField select label="Type" fullWidth value={item.kind}
                  onChange={(e) => setItem({ ...item, kind: e.target.value })}
                  data-testid="portal-setup-itemkind-select">
                  <MenuItem value="product">Product</MenuItem>
                  <MenuItem value="service" data-testid="portal-setup-itemkind-option-service">Service</MenuItem>
                </TextField>
                <TextField label="Price (₹)" fullWidth value={item.price}
                  onChange={(e) => setItem({ ...item, price: e.target.value })}
                  inputProps={{ "data-testid": "portal-setup-itemprice-input" }} />
                <TextField label="Tax %" fullWidth value={item.tax_rate}
                  onChange={(e) => setItem({ ...item, tax_rate: e.target.value })}
                  inputProps={{ "data-testid": "portal-setup-itemtax-input" }} />
              </Stack>
              <Button variant="outlined" disabled={!item.name}
                onClick={async () => {
                  await api("portal", "/t/catalog/", { method: "POST", body: item });
                  setItemCount((count) => count + 1);
                  setItem({ name: "", kind: item.kind, price: "0", tax_rate: "18" });
                  setToast("Added");
                }}
                data-testid="portal-setup-itemadd-btn">
                Add
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {stepKey === "done" && (
        <Card variant="outlined" data-testid="portal-setup-done-card">
          <CardContent sx={{ textAlign: "center", py: 5 }}>
            <CelebrationIcon color="secondary" sx={{ fontSize: 56 }} />
            <Typography variant="h5" gutterBottom>You&apos;re all set!</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {(org.setup_state.done ?? []).length} of {STEPS.length - 1} steps completed.
              Everything can be changed anytime in Settings.
            </Typography>
            <Button variant="contained" size="large"
              onClick={async () => {
                await markDone("done");
                router.push("/portal");
              }}
              data-testid="portal-setup-finish-btn">
              Go to my dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {stepKey !== "done" && (
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
          <Button onClick={skip} data-testid="portal-setup-skip-btn">Skip for now</Button>
          <Button variant="contained"
            onClick={() =>
              markDone(
                stepKey,
                stepKey === "company"
                  ? { company_name: org.company_name, legal_name: org.legal_name, gstin: org.gstin }
                  : stepKey === "terminology"
                    ? { industry: org.industry, labels: org.labels }
                    : stepKey === "appearance"
                      ? { appearance: org.appearance }
                      : {},
              )
            }
            data-testid="portal-setup-savenext-btn">
            Save & continue
          </Button>
        </Stack>
      )}

      {(org.setup_state.done ?? []).includes("appearance") === false && stepKey === "appearance" && (
        <Alert severity="info" sx={{ mt: 2 }}>
          The portal re-colors instantly when you save.
        </Alert>
      )}

      <Snackbar open={toast !== null} autoHideDuration={2000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

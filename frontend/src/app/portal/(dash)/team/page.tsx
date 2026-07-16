"use client";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { api, type Paginated } from "@/lib/api";

interface TeamUser {
  id: number;
  email: string;
  phone: string;
  full_name: string;
  role_slug: string | null;
  is_owner: boolean;
  is_active: boolean;
  last_login: string | null;
}

interface Role {
  id: number;
  name: string;
  slug: string;
  is_system: boolean;
}

const EMPTY_FORM = { email: "", full_name: "", phone: "", role_slug: "", password: "" };

export default function TeamPage() {
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Paginated<TeamUser>>("portal", "/t/users/")
      .then((page) => setRows(page.results))
      .catch((err) => setError(err.message));
    api<Paginated<Role>>("portal", "/t/roles/")
      .then((page) => setRoles(page.results))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      await api("portal", "/t/users/", { method: "POST", body: form });
      setToast("Team member added — they can sign in with your org code");
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <Box data-testid="portal-team-container">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Team</Typography>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setOpen(true)}
          data-testid="portal-team-add-btn">
          Add member
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Table size="small" data-testid="portal-team-table">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last login</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover data-testid={`portal-team-row-${row.id}`}>
              <TableCell>
                {row.full_name} {row.is_owner && <Chip size="small" color="secondary" label="owner" />}
              </TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>{row.role_slug ?? "—"}</TableCell>
              <TableCell>
                <Chip size="small" label={row.is_active ? "active" : "disabled"}
                  color={row.is_active ? "success" : "default"} />
              </TableCell>
              <TableCell>
                {row.last_login ? new Date(row.last_login).toLocaleString("en-IN") : "never"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" data-testid="portal-team-add-dialog">
        <DialogTitle>Add team member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full name" required value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              inputProps={{ "data-testid": "portal-team-name-input" }} />
            <TextField label="Email" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              inputProps={{ "data-testid": "portal-team-email-input" }} />
            <TextField label="Phone" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              inputProps={{ "data-testid": "portal-team-phone-input" }} />
            <TextField select label="Role" value={form.role_slug}
              onChange={(e) => setForm({ ...form, role_slug: e.target.value })}
              data-testid="portal-team-role-select">
              {roles.map((role) => (
                <MenuItem key={role.slug} value={role.slug} data-testid={`portal-team-role-option-${role.slug}`}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Password" type="password" required helperText="Minimum 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              inputProps={{ "data-testid": "portal-team-password-input", minLength: 8 }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} data-testid="portal-team-cancel-btn">Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!form.email || !form.full_name || form.password.length < 8}
            data-testid="portal-team-save-btn">
            Add member
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

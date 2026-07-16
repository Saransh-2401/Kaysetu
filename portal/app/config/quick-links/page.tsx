"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Alert,
  AlertTitle,
  CircularProgress,
  TextField,
  MenuItem,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Chip,
  useTheme,
  alpha,
} from "@mui/material";
import { GridViewIcon, AddIcon, DeleteOutlineIcon } from "@/components/icons";
import { toast } from "sonner";

import { roleService, quickLinkService, RoleRow, QuickLink } from "@/lib/permission-service";
import { PAGE_REGISTRY } from "@/lib/page-registry";
import { authService } from "@/lib/auth-service";

export default function RoleQuickLinksAdminPage() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [pendingPath, setPendingPath] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await authService.getCurrentUser();
        if (me?.role !== "admin" && me?.role !== "mdo") {
          setAllowed(false);
          return;
        }
        const roleList = await roleService.list();
        setRoles(roleList);
        const first = roleList.find((r) => !r.is_full_access) || roleList[0];
        setSelectedRole(first?.slug || "");
      } catch {
        toast.error("Failed to load roles.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadLinks = async (slug: string) => {
    if (!slug) return;
    setLinksLoading(true);
    try {
      setLinks(await quickLinkService.listRole(slug));
    } catch {
      toast.error("Failed to load quick links.");
    } finally {
      setLinksLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRole) loadLinks(selectedRole);
    setPendingPath("");
  }, [selectedRole]);

  const existingPaths = useMemo(() => new Set(links.map((l) => l.path)), [links]);
  const addable = PAGE_REGISTRY.filter((p) => !existingPaths.has(p.path));

  const handleAdd = async () => {
    const page = PAGE_REGISTRY.find((p) => p.path === pendingPath);
    if (!page) return;
    setBusy(true);
    try {
      await quickLinkService.addRole({
        role: selectedRole,
        label: page.label,
        path: page.path,
        module_key: page.moduleKey,
      });
      setPendingPath("");
      await loadLinks(selectedRole);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the link.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: number) => {
    setBusy(true);
    try {
      await quickLinkService.removeRole(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch {
      toast.error("Could not remove the link.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!allowed) {
    return (
      <Alert severity="warning" data-testid="qladmin-access-denied">
        <AlertTitle>Administrators only</AlertTitle>
        Predefined Quick Links can only be managed by an admin or MDO.
      </Alert>
    );
  }

  const selected = roles.find((r) => r.slug === selectedRole);

  return (
    <Box data-testid="role-quick-links-page">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <GridViewIcon color="primary" sx={{ fontSize: 28 }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            Quick Links
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Set the predefined header shortcuts each role sees. Users can&rsquo;t remove these — they can only add their own on top.
          </Typography>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, mt: 2, p: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }} sx={{ mb: 2 }}>
          <TextField
            select
            label="Role"
            size="small"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            sx={{ minWidth: 240 }}
            data-testid="qladmin-role-select"
          >
            {roles.map((r) => (
              <MenuItem key={r.slug} value={r.slug}>
                {r.name} {r.is_system ? "" : "(custom)"}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={1} sx={{ flex: 1 }} alignItems="flex-end">
            <TextField
              select
              label="Add a page"
              size="small"
              value={pendingPath}
              onChange={(e) => setPendingPath(e.target.value)}
              sx={{ minWidth: 240, flex: 1 }}
              data-testid="qladmin-page-select"
              disabled={addable.length === 0}
            >
              {addable.length === 0 ? (
                <MenuItem value="" disabled>
                  All pages already added
                </MenuItem>
              ) : (
                addable.map((p) => (
                  <MenuItem key={p.path} value={p.path}>
                    {p.label}
                  </MenuItem>
                ))
              )}
            </TextField>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              disabled={busy || !pendingPath}
              data-testid="qladmin-add-btn"
              sx={{ borderRadius: 2 }}
            >
              Add
            </Button>
          </Stack>
        </Stack>

        <Typography variant="overline" color="text.secondary">
          Predefined links for {selected?.name}
        </Typography>

        {linksLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        ) : links.length === 0 ? (
          <Alert severity="info" variant="outlined" sx={{ mt: 1, borderRadius: 2 }} data-testid="qladmin-empty">
            No predefined quick links for this role yet. {selected && !selected.is_system ? "Custom roles start empty by design." : "Add some above."}
          </Alert>
        ) : (
          <List dense sx={{ mt: 0.5 }}>
            {links.map((l) => (
              <ListItem
                key={l.id}
                data-testid={`qladmin-link-${l.id}`}
                sx={{
                  border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                  borderRadius: 2,
                  mb: 1,
                }}
                secondaryAction={
                  <Tooltip title="Remove">
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => handleRemove(l.id)}
                      disabled={busy}
                      data-testid={`qladmin-remove-${l.id}`}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600 }}>{l.label}</Typography>}
                  secondary={<Chip size="small" variant="outlined" label={l.path} sx={{ mt: 0.5, height: 20 }} />}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}

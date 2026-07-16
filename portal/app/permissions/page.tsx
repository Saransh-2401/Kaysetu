"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Switch,
  Checkbox,
  Button,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Stack,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  MenuItem,
  useTheme,
  alpha,
} from "@mui/material";
import { LockPersonIcon, SaveIcon, RestartAltIcon, VerifiedUserIcon, AddIcon, EditIcon, DeleteOutlineIcon } from "@/components/icons";
import { toast } from "sonner";

import {
  permissionService,
  roleService,
  ModulePermission,
  RolePermissionRow,
  RoleRow,
} from "@/lib/permission-service";
import { APIError } from "@/lib/api-client";
import {
  MODULE_GROUPS,
  PERMISSION_ACTION_KEYS,
  ACTION_LABELS,
  normaliseModuleMap,
  emptyActions,
  fullModuleMap,
} from "@/lib/permission-modules";
import { authService } from "@/lib/auth-service";

type RoleDraft = {
  accessType: "full" | "custom";
  modules: Record<string, ModulePermission>;
};

/** Build a role's editable draft from its matrix row (full-access roles are fixed). */
function buildDraft(role: RoleRow, row?: RolePermissionRow): RoleDraft {
  if (role.is_full_access) {
    return { accessType: "full", modules: fullModuleMap() };
  }
  const accessType = (row?.access_type as "full" | "custom") || "custom";
  // Unseeded editable role → fail-open default (everything on) so the admin
  // sees current effective access and restricts from there.
  const fallbackEnabled = row ? row.access_type === "full" : true;
  return { accessType, modules: normaliseModuleMap(row?.permissions, fallbackEnabled) };
}

export default function PermissionMatrixPage() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(true);

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RoleDraft>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Create / edit / delete dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAll = async (preferSlug?: string) => {
    const [roleList, rows] = await Promise.all([
      roleService.list(),
      permissionService.listAll(),
    ]);
    const byRole: Record<string, RolePermissionRow> = {};
    rows.forEach((r) => (byRole[r.role] = r));

    const next: Record<string, RoleDraft> = {};
    roleList.forEach((role) => {
      next[role.slug] = buildDraft(role, byRole[role.slug]);
    });

    setRoles(roleList);
    setDrafts(next);
    setSelectedRole((cur) => {
      if (preferSlug && next[preferSlug]) return preferSlug;
      if (cur && next[cur]) return cur;
      const firstEditable = roleList.find((r) => !r.is_full_access) || roleList[0];
      return firstEditable?.slug || "";
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        const me = await authService.getCurrentUser();
        if (me?.role !== "admin" && me?.role !== "mdo") {
          setAllowed(false);
          return;
        }
        await loadAll();
      } catch {
        toast.error("Failed to load the permission matrix.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const markDirty = (role: string) =>
    setDirty((prev) => new Set(prev).add(role));

  const updateRole = (role: string, mutate: (d: RoleDraft) => RoleDraft) => {
    setDrafts((prev) => ({ ...prev, [role]: mutate(prev[role]) }));
    markDirty(role);
  };

  const setAccessType = (role: string, type: "full" | "custom") =>
    updateRole(role, (d) => ({ ...d, accessType: type }));

  const setModuleEnabled = (role: string, key: string, enabled: boolean) =>
    updateRole(role, (d) => {
      const mod = d.modules[key];
      const actions = enabled ? { ...mod.actions, view: true } : mod.actions;
      return { ...d, modules: { ...d.modules, [key]: { enabled, actions } } };
    });

  const setAction = (
    role: string,
    key: string,
    action: keyof ModulePermission["actions"],
    val: boolean
  ) =>
    updateRole(role, (d) => {
      const mod = d.modules[key];
      return {
        ...d,
        modules: {
          ...d.modules,
          [key]: { ...mod, actions: { ...mod.actions, [action]: val } },
        },
      };
    });

  const handleSave = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    try {
      const payload: Record<string, { accessType: string; modules: Record<string, ModulePermission> }> = {};
      dirty.forEach((role) => {
        const roleDef = roles.find((r) => r.slug === role);
        if (roleDef?.is_full_access) return; // admin/mdo are always full — skip
        const d = drafts[role];
        payload[role] = { accessType: d.accessType, modules: d.modules };
      });
      if (Object.keys(payload).length === 0) {
        setDirty(new Set());
        setSaving(false);
        return;
      }
      await permissionService.saveBulk(payload);
      permissionService.clearCache(); // affected users pick up changes on next load
      setDirty(new Set());
      toast.success("Permissions saved.");
    } catch {
      toast.error("Could not save permissions. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetRole = (role: string) =>
    updateRole(role, (d) => ({
      ...d,
      modules: Object.fromEntries(
        Object.keys(d.modules).map((k) => [
          k,
          { enabled: false, actions: emptyActions(false) },
        ])
      ),
    }));

  // ── Role CRUD ──────────────────────────────────────────────────────────
  const handleCreateRole = async () => {
    const name = createName.trim();
    if (!name) return;
    setBusy(true);
    try {
      // New custom roles start fully restricted (custom, nothing enabled); the
      // admin then enables modules in the grid below and saves.
      const created = await roleService.create({
        name,
        description: createDesc.trim(),
        permissions: { accessType: "custom", modules: {} },
      });
      permissionService.clearCache();
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      await loadAll(created.slug);
      toast.success(`Role “${created.name}” created. Configure its permissions below, then Save changes.`);
    } catch (e) {
      const msg = e instanceof APIError ? (e.details?.name as string) || e.message : "Could not create role.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRoleMeta = async () => {
    const name = editName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await roleService.update(selectedRole, { name, description: editDesc.trim() });
      setEditOpen(false);
      await loadAll(selectedRole);
      toast.success("Role updated.");
    } catch (e) {
      const msg = e instanceof APIError ? (e.details?.name as string) || e.message : "Could not update role.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    const slug = deleteTarget.slug;
    setBusy(true);
    try {
      await roleService.remove(slug, reassignTo || undefined);
      permissionService.clearCache();
      const closingSelected = selectedRole === slug;
      setDeleteTarget(null);
      setReassignTo("");
      setDirty((prev) => {
        const n = new Set(prev);
        n.delete(slug);
        return n;
      });
      await loadAll(closingSelected ? undefined : selectedRole);
      toast.success("Role deleted.");
    } catch (e) {
      // 409 → users still assigned; surface the reassign picker.
      if (e instanceof APIError && e.status === 409) {
        toast.message("Choose a role to move existing users to, then delete.");
        // keep dialog open; user_count already shown via deleteTarget
      } else {
        const msg = e instanceof APIError ? (e.details?.reassign_to as string) || e.message : "Could not delete role.";
        toast.error(msg);
      }
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
      <Alert severity="warning" data-testid="perm-access-denied">
        <AlertTitle>Administrators only</AlertTitle>
        The Permission Matrix can only be managed by an admin or MDO.
      </Alert>
    );
  }

  const selected = roles.find((r) => r.slug === selectedRole);
  const draft = drafts[selectedRole];
  const isFullRole = !!selected?.is_full_access;
  const gridDisabled = isFullRole || draft?.accessType === "full";
  const reassignOptions = roles.filter((r) => r.slug !== deleteTarget?.slug && r.is_active);

  return (
    <Box data-testid="permission-matrix-page">
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <LockPersonIcon color="primary" sx={{ fontSize: 30 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Permission Matrix
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Control which modules and actions each role can access. Changes take
              effect the next time the user loads the app.
            </Typography>
          </Box>
        </Stack>
        {/* Two distinct actions: create a role, and save pending matrix edits. */}
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexShrink: 0 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            data-testid="perm-create-role-btn"
            sx={{ borderRadius: 2 }}
          >
            New Role
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || dirty.size === 0}
            data-testid="perm-save-btn"
            sx={{ borderRadius: 2 }}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Stack>
      </Stack>

      {/* Master–detail: roles list (left) + permission grid (right) */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, alignItems: "flex-start" }}>
        {/* LEFT — roles list (selection + management) */}
        <Paper
          variant="outlined"
          data-testid="perm-role-tabs"
          sx={{
            width: { xs: "100%", md: 300 },
            flexShrink: 0,
            borderRadius: 2,
            overflow: "hidden",
            alignSelf: "flex-start",
            display: "flex",
            flexDirection: "column",
            maxHeight: { md: "calc(100vh - 210px)" },
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Roles
            </Typography>
            <Chip label={roles.length} size="small" />
          </Box>
          <List dense disablePadding sx={{ overflowY: "auto" }}>
            {roles.map((r) => {
              const isSel = r.slug === selectedRole;
              return (
                <ListItemButton
                  key={r.slug}
                  selected={isSel}
                  onClick={() => setSelectedRole(r.slug)}
                  data-testid={`perm-role-tab-${r.slug}`}
                  sx={{
                    py: 1,
                    borderLeft: "3px solid",
                    borderColor: isSel ? "primary.main" : "transparent",
                    transition: "background-color .15s ease",
                  }}
                >
                  <ListItemText
                    disableTypography
                    primary={
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontWeight: isSel ? 700 : 600, color: isSel ? "primary.main" : "text.primary" }}
                        >
                          {r.name}
                        </Typography>
                        {r.is_full_access && (
                          <Tooltip title="Always full access">
                            <VerifiedUserIcon sx={{ fontSize: 14, color: "success.main" }} />
                          </Tooltip>
                        )}
                        {dirty.has(r.slug) && (
                          <Tooltip title="Unsaved changes">
                            <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "warning.main" }} />
                          </Tooltip>
                        )}
                      </Stack>
                    }
                    secondary={
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                        <Box
                          component="span"
                          sx={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            px: 0.6,
                            py: "1px",
                            borderRadius: 0.75,
                            bgcolor: r.is_system
                              ? alpha(theme.palette.info.main, 0.12)
                              : alpha(theme.palette.secondary.main, 0.14),
                            color: r.is_system ? "info.main" : "secondary.main",
                          }}
                        >
                          {r.is_system ? "System" : "Custom"}
                        </Box>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {r.user_count} user{r.user_count === 1 ? "" : "s"}
                        </Typography>
                      </Stack>
                    }
                  />
                  {!r.is_system && (
                    <Stack direction="row" sx={{ ml: 0.5 }}>
                      <Tooltip title="Rename / edit">
                        <IconButton
                          size="small"
                          data-testid={`perm-role-edit-${r.slug}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRole(r.slug);
                            setEditName(r.name);
                            setEditDesc(r.description || "");
                            setEditOpen(true);
                          }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete role">
                        <IconButton
                          size="small"
                          color="error"
                          data-testid={`perm-role-delete-${r.slug}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRole(r.slug);
                            setReassignTo("");
                            setDeleteTarget(r);
                          }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </Paper>

        {/* RIGHT — selected role detail */}
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            minWidth: 0,
            borderRadius: 2,
            display: "flex",
            flexDirection: "column",
            maxHeight: { md: "calc(100vh - 210px)" },
            overflow: "hidden",
          }}
        >
          {/* Detail header: role meta + custom-role actions */}
          <Box
            sx={{
              flexShrink: 0,
              px: 2.5,
              py: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {selected?.name}
                </Typography>
                {selected?.is_full_access && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    icon={<VerifiedUserIcon sx={{ fontSize: 16 }} />}
                    label="Full access"
                    sx={{ fontWeight: 600, "& .MuiChip-icon": { ml: 0.75, mr: -0.25 } }}
                  />
                )}
              </Stack>
              {selected?.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {selected.description}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {selected?.is_system ? "System role" : "Custom role"}
                {typeof selected?.user_count === "number" &&
                  ` · ${selected.user_count} user${selected.user_count === 1 ? "" : "s"} assigned`}
              </Typography>
              {dirty.size > 0 && (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={`${dirty.size} unsaved`}
                  data-testid="perm-unsaved-indicator"
                  sx={{ mt: 0.75, height: 22, fontWeight: 700 }}
                />
              )}
            </Box>
            <Stack spacing={1.25} alignItems="flex-end" sx={{ flexShrink: 0 }}>
              {selected && !selected.is_system && (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => {
                      setEditName(selected.name);
                      setEditDesc(selected.description || "");
                      setEditOpen(true);
                    }}
                    data-testid="perm-edit-role-btn"
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() => {
                      setReassignTo("");
                      setDeleteTarget(selected);
                    }}
                    data-testid="perm-delete-role-btn"
                  >
                    Delete
                  </Button>
                </Stack>
              )}
              {/* Access type lives in this first row, at the right end; Clear all sits beneath it */}
              {!isFullRole && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
                  <Box sx={{ textAlign: "right" }}>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={draft.accessType}
                      onChange={(_, v) => v && setAccessType(selectedRole, v)}
                      data-testid={`perm-access-${selectedRole}`}
                    >
                      <ToggleButton value="full" data-testid="perm-access-full">
                        Full access
                      </ToggleButton>
                      <ToggleButton value="custom" data-testid="perm-access-custom">
                        Custom
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<RestartAltIcon />}
                    onClick={() => handleResetRole(selectedRole)}
                    disabled={gridDisabled}
                    data-testid="perm-reset-role-btn"
                  >
                    Clear all
                  </Button>
                </Box>
              )}
            </Stack>
          </Box>

          {isFullRole ? (
            <Box sx={{ p: 2.5, flex: 1 }}>
              <Alert severity="success" icon={<VerifiedUserIcon sx={{ fontSize: 20 }} />} sx={{ borderRadius: 2 }}>
                This role always has full access to every module and action — it
                is not configurable.
              </Alert>
            </Box>
          ) : (
            <>
              {draft.accessType === "full" ? (
                <Box sx={{ px: 2.5, pb: 2.5, flex: 1 }}>
                  <Alert severity="success" sx={{ borderRadius: 2 }}>
                    Full access — every module and action is granted. Switch to
                    “Custom” to restrict.
                  </Alert>
                </Box>
              ) : (
                /* Scrollable matrix — table scrolls; sub-header above and footer below stay fixed */
                <Box sx={{ flex: 1, minHeight: 0, px: 2.5, pb: 2, display: "flex" }}>
                  <TableContainer
                    sx={{
                      flex: 1,
                      overflow: "auto",
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 2,
                      "& td, & th": { borderColor: theme.palette.divider },
                    }}
                  >
                    <Table stickyHeader size="small" sx={{ tableLayout: "fixed", minWidth: 720 }}>
                      <TableHead>
                        <TableRow
                          sx={{
                            "& th": {
                              bgcolor: theme.palette.grey[100],
                              borderBottom: `2px solid ${theme.palette.divider}`,
                              fontWeight: 700,
                            },
                          }}
                        >
                          <TableCell
                            sx={{ position: "sticky", left: 0, zIndex: 3, width: "26%", bgcolor: theme.palette.grey[100] }}
                          >
                            Module
                          </TableCell>
                          <TableCell align="center">Enabled</TableCell>
                          {PERMISSION_ACTION_KEYS.map((a) => (
                            <TableCell key={a} align="center" sx={{ px: 0.5 }}>
                              {ACTION_LABELS[a]}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {MODULE_GROUPS.map((group) => (
                          <React.Fragment key={group.group}>
                            <TableRow>
                              <TableCell
                                colSpan={2 + PERMISSION_ACTION_KEYS.length}
                                sx={{ py: 0.5, bgcolor: alpha(theme.palette.primary.main, 0.06) }}
                              >
                                <Typography
                                  variant="overline"
                                  sx={{ fontWeight: 700, color: "primary.main", letterSpacing: "0.08em" }}
                                >
                                  {group.group}
                                </Typography>
                              </TableCell>
                            </TableRow>
                            {group.modules.map((m) => {
                              const mod = draft.modules[m.key];
                              return (
                                <TableRow key={m.key} hover>
                                  <TableCell
                                    sx={{
                                      fontWeight: 500,
                                      position: "sticky",
                                      left: 0,
                                      zIndex: 1,
                                      bgcolor: "background.paper",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {m.label}
                                  </TableCell>
                                  <TableCell align="center" sx={{ p: 0 }}>
                                    <Switch
                                      size="small"
                                      checked={!!mod?.enabled}
                                      disabled={gridDisabled}
                                      onChange={(e) => setModuleEnabled(selectedRole, m.key, e.target.checked)}
                                      data-testid={`perm-mod-${selectedRole}-${m.key}-enabled`}
                                    />
                                  </TableCell>
                                  {PERMISSION_ACTION_KEYS.map((a) => (
                                    <TableCell key={a} align="center" sx={{ p: 0 }}>
                                      <Checkbox
                                        size="small"
                                        checked={!!mod?.actions?.[a]}
                                        disabled={gridDisabled || !mod?.enabled}
                                        onChange={(e) => setAction(selectedRole, m.key, a, e.target.checked)}
                                        data-testid={`perm-act-${selectedRole}-${m.key}-${a}`}
                                      />
                                    </TableCell>
                                  ))}
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>

      {/* Subtle helper note (moved out of the way, from the old top banner) */}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        Administrators and MDO always have full access; an unconfigured role keeps full access until you customise it.
        System roles can&rsquo;t be renamed or deleted — custom roles can.
      </Typography>

      {/* Create role dialog */}
      <Dialog open={createOpen} onClose={() => !busy && setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create role</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Give the role a name. After it is created, configure its module
            permissions in the grid and click “Save changes”.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Role name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            sx={{ mb: 2 }}
            data-testid="perm-create-name-input"
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Description (optional)"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            data-testid="perm-create-desc-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={busy} data-testid="perm-create-cancel-btn">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateRole}
            disabled={busy || !createName.trim()}
            data-testid="perm-create-submit-btn"
          >
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit role dialog */}
      <Dialog open={editOpen} onClose={() => !busy && setEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Edit role</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Role name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            data-testid="perm-edit-name-input"
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Description (optional)"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            data-testid="perm-edit-desc-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRoleMeta}
            disabled={busy || !editName.trim()}
            data-testid="perm-edit-submit-btn"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete role dialog (with reassignment when users are attached) */}
      <Dialog open={!!deleteTarget} onClose={() => !busy && setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
        <DialogContent>
          {deleteTarget && deleteTarget.user_count > 0 ? (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                {deleteTarget.user_count} user{deleteTarget.user_count === 1 ? " is" : "s are"} still
                assigned to this role. Choose a role to move them to before deleting.
              </DialogContentText>
              <TextField
                select
                fullWidth
                label="Reassign users to"
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                data-testid="perm-reassign-select"
              >
                {reassignOptions.map((r) => (
                  <MenuItem key={r.slug} value={r.slug}>
                    {r.name}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <DialogContentText>
              This role has no users assigned. This action cannot be undone.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteRole}
            disabled={busy || (!!deleteTarget && deleteTarget.user_count > 0 && !reassignTo)}
            data-testid="perm-delete-confirm-btn"
          >
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

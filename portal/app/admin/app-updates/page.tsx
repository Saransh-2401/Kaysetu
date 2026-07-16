"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  CircularProgress,
  Button,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { motion } from "framer-motion";
import { SystemUpdateIcon, CloudUploadIcon, DeleteIcon, DownloadIcon, CheckCircleIcon, WarningIcon, AddIcon, CloseIcon, AndroidIcon } from "@/components/icons";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface AppVersion {
  id: number;
  version: string;
  version_code: number;
  apk_file: string;
  download_url: string;
  release_notes: string;
  force_update: boolean;
  is_active: boolean;
  file_size: number;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  count: number;
  results: AppVersion[];
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppUpdatesPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppVersion | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formVersion, setFormVersion] = useState("");
  const [formVersionCode, setFormVersionCode] = useState("");
  const [formReleaseNotes, setFormReleaseNotes] = useState("");
  const [formForceUpdate, setFormForceUpdate] = useState(false);
  const [formApkFile, setFormApkFile] = useState<File | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<PaginatedResponse>("/core/app-versions/");
      setVersions(data.results || []);
    } catch (err) {
      console.error("Failed to fetch versions:", err);
      toast.error("Failed to load app versions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const resetForm = () => {
    setFormVersion("");
    setFormVersionCode("");
    setFormReleaseNotes("");
    setFormForceUpdate(false);
    setFormApkFile(null);
  };

  const handleUpload = async () => {
    if (!formVersion.trim() || !formVersionCode.trim() || !formApkFile) {
      toast.error("Version, version code, and APK file are required");
      return;
    }

    const versionCode = parseInt(formVersionCode);
    if (isNaN(versionCode) || versionCode <= 0) {
      toast.error("Version code must be a positive integer");
      return;
    }

    const duplicateVersion = versions.find(
      (v) => v.version === formVersion.trim()
    );
    if (duplicateVersion) {
      toast.error(`Version ${formVersion.trim()} already exists`);
      return;
    }

    const duplicateCode = versions.find((v) => v.version_code === versionCode);
    if (duplicateCode) {
      toast.error(
        `Version code ${versionCode} is already used by v${duplicateCode.version}`
      );
      return;
    }

    const maxExistingCode = versions.reduce(
      (max, v) => Math.max(max, v.version_code),
      0
    );
    if (versionCode <= maxExistingCode) {
      toast.error(
        `Version code must be higher than ${maxExistingCode}`
      );
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);

      const formData = new FormData();
      formData.append("version", formVersion.trim());
      formData.append("version_code", String(versionCode));
      formData.append("release_notes", formReleaseNotes.trim() || "Bug fixes and improvements");
      formData.append("force_update", String(formForceUpdate));
      formData.append("is_active", "true");
      formData.append("apk_file", formApkFile);

      setUploadProgress(30);

      await apiClient.post("/core/app-versions/", formData);

      setUploadProgress(100);
      toast.success(`Version ${formVersion} uploaded successfully!`);
      setDialogOpen(false);
      resetForm();
      fetchVersions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleToggleActive = async (version: AppVersion) => {
    try {
      const formData = new FormData();
      formData.append("is_active", String(!version.is_active));
      await apiClient.patch(`/core/app-versions/${version.id}/`, formData);
      toast.success(
        `v${version.version} ${!version.is_active ? "activated" : "deactivated"}`
      );
      fetchVersions();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/core/app-versions/${deleteTarget.id}/`);
      toast.success(`v${deleteTarget.version} deleted`);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchVersions();
    } catch {
      toast.error("Failed to delete version");
    } finally {
      setDeleting(false);
    }
  };

  const latestActive = versions.find((v) => v.is_active);

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600, mx: "auto" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 4 }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                }}
              >
                <SystemUpdateIcon sx={{ color: "#fff", fontSize: 28 }} />
              </Box>
              <Box>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color="text.primary"
                >
                  App Updates
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage mobile app versions and APK releases
                </Typography>
              </Box>
            </Stack>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{
                borderRadius: 3,
                px: 3,
                py: 1.2,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              New Release
            </Button>
          </Stack>
        </motion.div>

        {/* Current Version Card */}
        {latestActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 4,
                borderRadius: 4,
                border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                background: alpha(theme.palette.success.main, 0.05),
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <AndroidIcon
                  sx={{ fontSize: 40, color: theme.palette.success.main }}
                />
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Live Version
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    v{latestActive.version}{" "}
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                    >
                      (Code: {latestActive.version_code})
                    </Typography>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {latestActive.release_notes}
                  </Typography>
                </Box>
                <Stack alignItems="flex-end" spacing={0.5}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Active"
                    color="success"
                    size="small"
                  />
                  {latestActive.force_update && (
                    <Chip
                      icon={<WarningIcon />}
                      label="Force Update"
                      color="warning"
                      size="small"
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(latestActive.file_size)} &middot;{" "}
                    {formatDate(latestActive.created_at)}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          </motion.div>
        )}

        {/* Version History Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              border: `1px solid ${alpha(
                theme.palette.divider,
                isDark ? 0.1 : 0.15
              )}`,
              overflow: "hidden",
            }}
          >
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Version History
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All released versions of the Salexa mobile app
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ p: 6, textAlign: "center" }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading versions...
                </Typography>
              </Box>
            ) : versions.length === 0 ? (
              <Box sx={{ p: 6, textAlign: "center" }}>
                <SystemUpdateIcon
                  sx={{ fontSize: 48, color: "text.disabled", mb: 1 }}
                />
                <Typography variant="body1" color="text.secondary">
                  No versions uploaded yet
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  Click &quot;New Release&quot; to upload your first APK
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Release Notes</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Uploaded</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {versions.map((v, idx) => (
                      <TableRow
                        key={v.id}
                        sx={{
                          "&:hover": {
                            bgcolor: alpha(theme.palette.primary.main, 0.03),
                          },
                          ...(idx === 0 && v.is_active
                            ? {
                                bgcolor: alpha(
                                  theme.palette.success.main,
                                  0.03
                                ),
                              }
                            : {}),
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            v{v.version}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {v.version_code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              maxWidth: 300,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {v.release_notes}
                          </Typography>
                          {v.force_update && (
                            <Chip
                              label="Force"
                              color="warning"
                              size="small"
                              sx={{ ml: 1, height: 20, fontSize: 11 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatFileSize(v.file_size)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(v.created_at)}
                          </Typography>
                          {v.uploaded_by_name && (
                            <Typography variant="caption" color="text.disabled">
                              by {v.uploaded_by_name}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={v.is_active ? "Active" : "Inactive"}
                            color={v.is_active ? "success" : "default"}
                            size="small"
                            onClick={() => handleToggleActive(v)}
                            sx={{ cursor: "pointer" }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="flex-end"
                          >
                            <Tooltip title="Download APK">
                              <IconButton
                                size="small"
                                component="a"
                                href={v.download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setDeleteTarget(v);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </motion.div>

        {/* Upload Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => !uploading && setDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4 } }}
        >
          <DialogTitle>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <CloudUploadIcon color="primary" />
                <Typography component="span" variant="h6" fontWeight={700}>
                  New Release
                </Typography>
              </Stack>
              <IconButton
                size="small"
                onClick={() => !uploading && setDialogOpen(false)}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={3} sx={{ pt: 1 }}>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Version"
                  placeholder="1.1.0"
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                  fullWidth
                  required
                  helperText="Semantic version (e.g. 1.2.0)"
                />
                <TextField
                  label="Version Code"
                  placeholder="2"
                  value={formVersionCode}
                  onChange={(e) =>
                    setFormVersionCode(e.target.value.replace(/\D/g, ""))
                  }
                  fullWidth
                  required
                  helperText="Must be higher than previous"
                  type="number"
                />
              </Stack>

              <TextField
                label="Release Notes"
                placeholder="What's new in this version..."
                value={formReleaseNotes}
                onChange={(e) => setFormReleaseNotes(e.target.value)}
                fullWidth
                multiline
                rows={3}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formForceUpdate}
                    onChange={(e) => setFormForceUpdate(e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Force Update
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Users must update before using the app
                    </Typography>
                  </Box>
                }
              />

              {/* APK Upload */}
              <Box
                sx={{
                  border: `2px dashed ${
                    formApkFile
                      ? theme.palette.success.main
                      : alpha(theme.palette.primary.main, 0.3)
                  }`,
                  borderRadius: 3,
                  p: 3,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  bgcolor: formApkFile
                    ? alpha(theme.palette.success.main, 0.05)
                    : "transparent",
                  "&:hover": {
                    borderColor: theme.palette.primary.main,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                  },
                }}
                onClick={() =>
                  document.getElementById("apk-file-input")?.click()
                }
              >
                <input
                  id="apk-file-input"
                  type="file"
                  accept=".apk"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (!file.name.endsWith(".apk")) {
                        toast.error("Only .apk files are allowed");
                        return;
                      }
                      setFormApkFile(file);
                    }
                  }}
                />
                {formApkFile ? (
                  <Stack alignItems="center" spacing={1}>
                    <AndroidIcon
                      sx={{ fontSize: 40, color: theme.palette.success.main }}
                    />
                    <Typography variant="body1" fontWeight={600}>
                      {formApkFile.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatFileSize(formApkFile.size)} — Click to change
                    </Typography>
                  </Stack>
                ) : (
                  <Stack alignItems="center" spacing={1}>
                    <CloudUploadIcon
                      sx={{
                        fontSize: 40,
                        color: alpha(theme.palette.primary.main, 0.5),
                      }}
                    />
                    <Typography variant="body1" fontWeight={600}>
                      Click to upload APK
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      .apk files only
                    </Typography>
                  </Stack>
                )}
              </Box>

              {uploading && (
                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={uploadProgress}
                    sx={{ borderRadius: 2, height: 6 }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Uploading... {uploadProgress}%
                  </Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2.5 }}>
            <Button
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={uploading}
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={uploading || !formApkFile || !formVersion || !formVersionCode}
              startIcon={
                uploading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <CloudUploadIcon />
                )
              }
              sx={{ textTransform: "none", borderRadius: 2, px: 3 }}
            >
              {uploading ? "Uploading..." : "Upload & Publish"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => !deleting && setDeleteDialogOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4 } }}
        >
          <DialogTitle>
            <Typography component="span" variant="h6" fontWeight={700}>
              Delete Version?
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Are you sure you want to delete{" "}
              <strong>v{deleteTarget?.version}</strong> (Code:{" "}
              {deleteTarget?.version_code})? This will also remove the APK file
              and cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
              disabled={deleting}
              startIcon={
                deleting ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <DeleteIcon />
                )
              }
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}

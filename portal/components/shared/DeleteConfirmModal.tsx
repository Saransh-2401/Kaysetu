"use client";
import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    LinearProgress,
    Paper,
    alpha,
    useTheme,
} from "@mui/material";
import { WarningAmberIcon } from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";

interface DeleteConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    itemName?: string;
    loading?: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    open,
    onClose,
    onConfirm,
    title = "Confirm Deletion",
    message = "Are you sure you want to delete this item? This action cannot be undone.",
    itemName,
    loading = false,
}) => {
    const theme = useTheme();
    const [timer, setTimer] = useState(3);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (open && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [open, timer]);

    useEffect(() => {
        if (open) {
            setTimer(3);
        }
    }, [open]);

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 1,
                    p: 1,
                },
            }}
        >
            <DialogContent sx={{ textAlign: "center", pt: 4 }}>
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 12 }}
                >
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            bgcolor: alpha(theme.palette.error.main, 0.1),
                            color: "error.main",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 24px",
                        }}
                    >
                        <WarningAmberIcon sx={{ fontSize: 40 }} />
                    </Box>
                </motion.div>

                <Typography variant="h5" fontWeight={800} gutterBottom>
                    {title}
                </Typography>

                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    {message}
                </Typography>

                {itemName && (
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2,
                            bgcolor: alpha(theme.palette.error.main, 0.02),
                            borderColor: alpha(theme.palette.error.main, 0.2),
                            mb: 3,
                        }}
                    >
                        <Typography variant="subtitle1" fontWeight={700} color="error.dark">
                            {itemName}
                        </Typography>
                    </Paper>
                )}

                <AnimatePresence>
                    {timer > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <Box sx={{ width: "100%", mt: 2 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                                    Confirm button will enable in {timer}s...
                                </Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={((3 - timer) / 3) * 100}
                                    color="error"
                                    sx={{ height: 6, borderRadius: 1 }}
                                />
                            </Box>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 0, justifyContent: "center", gap: 2 }}>
                <Button
                    onClick={onClose}
                    disabled={loading}
                    variant="outlined"
                    sx={{
                        borderRadius: 2,
                        px: 4,
                        borderColor: theme.palette.divider,
                        color: "text.primary",
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={onConfirm}
                    disabled={timer > 0 || loading}
                    variant="contained"
                    color="error"
                    sx={{
                        borderRadius: 2,
                        px: 4,
                        boxShadow: theme.shadows[4],
                    }}
                >
                    {loading ? "Deleting..." : "Confirm Delete"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteConfirmModal;

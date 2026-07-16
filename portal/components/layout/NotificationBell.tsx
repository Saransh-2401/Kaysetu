"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useRouter } from "next/navigation";

import {
  CheckIcon,
  NotificationsActiveIcon,
  NotificationsIcon,
  SettingsIcon,
} from "@/components/icons";
import { notificationService, type FeedItem } from "@/lib/notification-service";

const POLL_MS = 45000;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const theme = useTheme();
  const router = useRouter();
  const gold = theme.palette.secondary.main;
  const slate = theme.palette.primary.main;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  const open = Boolean(anchorEl);

  const loadSummary = useCallback(async () => {
    try {
      const s = await notificationService.getSummary();
      if (mounted.current) setUnread(s.unread || 0);
    } catch {
      /* silent — header badge must never throw */
    }
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationService.getFeed({ limit: "8" });
      if (mounted.current) {
        setItems(res.results || []);
        setUnread(res.unread || 0);
      }
    } catch {
      /* silent */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadSummary();
    const id = setInterval(loadSummary, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [loadSummary]);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    loadFeed();
  };
  const handleClose = () => setAnchorEl(null);

  const handleItemClick = async (item: FeedItem) => {
    if (!item.is_read) {
      // Optimistic update, then reconcile with the server so a failed request
      // can't leave the badge showing a stale (too-low) count.
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)),
      );
      setUnread((u) => Math.max(0, u - 1));
      try {
        await notificationService.markRead(item.id);
      } catch {
        loadSummary();
      }
    }
    handleClose();
    router.push("/notifications");
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    setUnread(0);
    try {
      await notificationService.markAllRead();
    } catch {
      loadSummary(); // resync the badge if the request failed
    }
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          data-testid="notification-bell-btn"
          onClick={handleOpen}
          sx={{ color: alpha(slate, 0.6), "&:hover": { color: gold } }}
          aria-label="notifications"
        >
          <Badge
            data-testid="notification-bell-badge"
            badgeContent={unread}
            max={99}
            color="error"
            overlap="circular"
          >
            {unread > 0 ? <NotificationsActiveIcon /> : <NotificationsIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        data-testid="notification-menu"
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 380,
              maxWidth: "92vw",
              borderRadius: 2,
              border: `1px solid ${alpha(gold, 0.12)}`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
            },
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5 }}
        >
          <Typography sx={{ fontWeight: 800, color: slate }}>
            Notifications
          </Typography>
          <Button
            data-testid="notification-markall-btn"
            size="small"
            startIcon={<CheckIcon fontSize="small" />}
            onClick={handleMarkAll}
            disabled={unread === 0}
            sx={{ textTransform: "none", color: gold, minWidth: 0 }}
          >
            Mark all read
          </Button>
        </Stack>
        <Divider />

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        ) : items.length === 0 ? (
          <Box
            data-testid="notification-empty-state"
            sx={{ textAlign: "center", py: 5, px: 2 }}
          >
            <NotificationsIcon sx={{ fontSize: 36, color: alpha(slate, 0.25) }} />
            <Typography sx={{ mt: 1, color: "text.secondary", fontSize: "0.9rem" }}>
              You're all caught up
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0, maxHeight: 420, overflowY: "auto" }}>
            {items.map((item) => (
              <ListItemButton
                key={item.id}
                data-testid={`notification-item-${item.id}`}
                onClick={() => handleItemClick(item)}
                sx={{
                  alignItems: "flex-start",
                  gap: 1.25,
                  px: 2,
                  py: 1.25,
                  backgroundColor: item.is_read
                    ? "transparent"
                    : alpha(gold, 0.06),
                }}
              >
                <Box
                  sx={{
                    mt: 0.75,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    backgroundColor: item.is_read ? "transparent" : gold,
                    border: item.is_read
                      ? `1px solid ${alpha(slate, 0.2)}`
                      : "none",
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    sx={{
                      fontWeight: item.is_read ? 500 : 700,
                      fontSize: "0.85rem",
                      color: slate,
                    }}
                    noWrap
                  >
                    {item.subject}
                  </Typography>
                  <Typography
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.8rem",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.message}
                  </Typography>
                  <Typography
                    sx={{ color: alpha(slate, 0.45), fontSize: "0.7rem", mt: 0.25 }}
                  >
                    {timeAgo(item.created_at)}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}

        <Divider />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.5, py: 1 }}
        >
          <Button
            data-testid="notification-viewall-btn"
            size="small"
            onClick={() => {
              handleClose();
              router.push("/notifications");
            }}
            sx={{ textTransform: "none", color: slate, fontWeight: 600 }}
          >
            View all
          </Button>
          <Tooltip title="Notification settings">
            <IconButton
              data-testid="notification-settings-btn"
              size="small"
              onClick={() => {
                handleClose();
                router.push("/notifications?tab=preferences");
              }}
              sx={{ color: alpha(slate, 0.6), "&:hover": { color: gold } }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Popover>
    </>
  );
}

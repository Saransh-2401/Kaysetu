"use client";
import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";

import { ExpandMoreIcon } from "@/components/icons";
import type {
  NotificationChannel,
  NotificationEvent,
} from "@/lib/notification-service";

interface Props {
  events: NotificationEvent[];
  channels: NotificationChannel[];
  channelLabels: Record<string, string>;
  categories: string[];
  getValue: (ev: NotificationEvent, ch: NotificationChannel) => boolean;
  onToggle: (ev: NotificationEvent, ch: NotificationChannel, value: boolean) => void;
  showRelevant?: boolean;
  testIdPrefix: string;
}

/**
 * Reusable channel matrix grouped by category. Used for both the per-user
 * preference screen and the admin role-default screen — the only difference is
 * the data source the parent wires into getValue / onToggle.
 */
export default function NotificationMatrix({
  events,
  channels,
  channelLabels,
  categories,
  getValue,
  onToggle,
  showRelevant = false,
  testIdPrefix,
}: Props) {
  const theme = useTheme();
  const gold = theme.palette.secondary.main;
  const slate = theme.palette.primary.main;

  const orderedCategories = categories.filter((c) =>
    events.some((e) => e.category === c),
  );

  return (
    <Box>
      {orderedCategories.map((category, idx) => {
        const rows = events.filter((e) => e.category === category);
        return (
          <Accordion
            key={category}
            defaultExpanded={idx === 0}
            elevation={0}
            data-testid={`${testIdPrefix}-category-${category.replace(/\W+/g, "-").toLowerCase()}`}
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              borderRadius: "12px !important",
              "&:before": { display: "none" },
              mb: 1.5,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 700, color: slate }}>
                {category}
              </Typography>
              <Chip
                label={rows.length}
                size="small"
                sx={{ ml: 1, height: 20, bgcolor: alpha(gold, 0.12), color: gold }}
              />
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: alpha(slate, 0.7) }}>
                      Alert
                    </TableCell>
                    {channels.map((ch) => (
                      <TableCell
                        key={ch}
                        align="center"
                        sx={{ fontWeight: 700, color: alpha(slate, 0.7), width: 80 }}
                      >
                        {channelLabels[ch] || ch}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((ev) => (
                    <TableRow
                      key={ev.key}
                      data-testid={`${testIdPrefix}-row-${ev.key}`}
                      hover
                    >
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                            {ev.label}
                          </Typography>
                          {showRelevant && ev.relevant && (
                            <Chip
                              label="For you"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                                bgcolor: alpha(gold, 0.12),
                                color: gold,
                              }}
                            />
                          )}
                          {ev.mandatory && (
                            <Chip
                              label="Required"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                                bgcolor: alpha(slate, 0.08),
                                color: alpha(slate, 0.7),
                              }}
                            />
                          )}
                        </Stack>
                        <Typography
                          sx={{ color: "text.secondary", fontSize: "0.72rem", mt: 0.25 }}
                        >
                          {ev.description}
                        </Typography>
                      </TableCell>
                      {channels.map((ch) => {
                        // In-app is forced on for mandatory events.
                        const forced = ev.mandatory && ch === "in_app";
                        const value = forced ? true : getValue(ev, ch);
                        const sw = (
                          <Switch
                            size="small"
                            checked={value}
                            disabled={forced}
                            onChange={(e) => onToggle(ev, ch, e.target.checked)}
                            data-testid={`${testIdPrefix}-${ev.key}-${ch}-switch`}
                          />
                        );
                        return (
                          <TableCell key={ch} align="center">
                            {ch === "sms" ? (
                              <Tooltip title="SMS delivers only for alert types that have a DLT-approved template configured.">
                                <span>{sw}</span>
                              </Tooltip>
                            ) : (
                              sw
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

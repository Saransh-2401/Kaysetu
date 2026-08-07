"use client";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getToken, type Scope } from "@/lib/api";

/** Client-side guard: no token for the scope -> bounce to its login page. */
export default function AuthGuard({ scope, children }: { scope: Scope; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken(scope)) {
      router.replace("/ops/login");
    } else {
      setReady(true);
    }
  }, [router, scope]);

  if (!ready) {
    return (
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={28} data-testid={`${scope}-authguard-spinner`} />
          <Typography variant="caption" color="text.secondary">
            Checking your session…
          </Typography>
        </Stack>
      </Box>
    );
  }
  return <>{children}</>;
}

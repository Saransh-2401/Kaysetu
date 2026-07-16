"use client";
import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getToken, type Scope } from "@/lib/api";

/** Client-side guard: no token for the scope -> bounce to its login page. */
export default function AuthGuard({ scope, children }: { scope: Scope; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken(scope)) {
      router.replace(scope === "ops" ? "/ops/login" : "/portal/login");
    } else {
      setReady(true);
    }
  }, [router, scope]);

  if (!ready) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <CircularProgress data-testid={`${scope}-authguard-spinner`} />
      </Box>
    );
  }
  return <>{children}</>;
}

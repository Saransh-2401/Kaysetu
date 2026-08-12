import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "KaySetu: Your Business. Unified. | ERP + CRM Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#10234b",
          padding: "60px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle background glow */}
        <div
          style={{
            position: "absolute",
            right: "-10%",
            bottom: "-20%",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,150,136,0.25) 0%, rgba(0,150,136,0) 70%)",
          }}
        />

        {/* Top bar: Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#009688",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "28px",
              fontWeight: "bold",
            }}
          >
            K
          </div>
          <span
            style={{
              color: "#ffffff",
              fontSize: "32px",
              fontWeight: "bold",
              letterSpacing: "-0.02em",
            }}
          >
            KaySetu
          </span>
        </div>

        {/* Center content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "900px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 16px",
              borderRadius: "100px",
              backgroundColor: "rgba(0, 150, 136, 0.15)",
              border: "1px solid rgba(0, 150, 136, 0.3)",
              color: "#26a69a",
              fontSize: "18px",
              fontWeight: "600",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            UNIFIED ERP + CRM PLATFORM
          </div>

          <h1
            style={{
              color: "#ffffff",
              fontSize: "64px",
              fontWeight: "700",
              lineHeight: "1.1",
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            Smarter operations, from field to finance.
          </h1>

          <p
            style={{
              color: "#94a0b4",
              fontSize: "24px",
              lineHeight: "1.4",
              margin: 0,
            }}
          >
            Sales, distribution, inventory, finance & workforce — unified on one intelligent GST-ready platform.
          </p>
        </div>

        {/* Footer info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: "24px",
          }}
        >
          <span style={{ color: "#009688", fontSize: "20px", fontWeight: "600" }}>
            kaysetu.kayease.com
          </span>
          <span style={{ color: "#94a0b4", fontSize: "18px" }}>
            By Kayease Studio
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

import { ImageResponse } from "next/og";
import { defaultDescription, siteName } from "@/lib/seo";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f6f7f3",
          color: "#18181b",
          padding: "72px",
          fontFamily: "Arial, sans-serif",
          border: "20px solid #18181b",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 30,
            fontWeight: 700,
            textTransform: "uppercase",
            color: "#047857",
          }}
        >
          <span>{siteName}.ro</span>
          <span>Bacalaureat</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <h1
            style={{
              margin: 0,
              maxWidth: 900,
              fontSize: 84,
              lineHeight: 0.96,
              fontWeight: 800,
            }}
          >
            Subiecte și bareme Bac
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 880,
              fontSize: 34,
              lineHeight: 1.25,
              color: "#3f3f46",
            }}
          >
            {defaultDescription}
          </p>
        </div>
      </div>
    ),
    size,
  );
}

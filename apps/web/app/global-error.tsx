"use client";

import { useEffect } from "react";
import { captureAppException } from "@/lib/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureAppException(error, {
      area: "global-error",
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "system-ui, -apple-system, sans-serif", color: "#fff", backgroundColor: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>Something went wrong</h2>
          <p style={{ color: "#a1a1aa", fontSize: "0.875rem", marginBottom: "1.5rem" }}>An unexpected error occurred. Please try again.</p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.625rem 1.5rem",
              backgroundColor: "#fff",
              color: "#000",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.025em",
              textTransform: "uppercase",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

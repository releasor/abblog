"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
            出错了
          </h1>
          <p style={{ color: "#71717a", marginBottom: "0.5rem" }}>
            应用遇到了一个意外错误，请刷新页面重试。
          </p>
          {error.message && (
            <p style={{ color: "#a1a1aa", fontSize: "0.875rem", marginBottom: "1.5rem", maxWidth: "28rem", wordBreak: "break-word" }}>
              {error.message}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#fff",
              background: "#18181b",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}

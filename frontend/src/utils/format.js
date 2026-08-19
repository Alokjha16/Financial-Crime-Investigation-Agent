// ─── Indian Currency Formatter ────────────────────────────────────────────────
// Usage: fmtINR(4800000) → "₹4.8Cr"
//        fmtINR(480000)  → "₹4.8L"
//        fmtINR(75000)   → "₹75K"
//        fmtINR(48000)   → "₹48K"
export function fmtINR(amount) {
  if (amount === null || amount === undefined) return "N/A";
  const n = Number(amount);
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n}`;
}

// ─── Relative Time ────────────────────────────────────────────────────────────
// Usage: relativeTime("2026-08-16T10:41:09Z") → "2s ago"
export function relativeTime(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)   return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)   return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)    return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ─── Timestamp Formatter ─────────────────────────────────────────────────────
// Usage: fmtTimestamp("2026-08-12T10:41:02Z") → "12 Aug 2026, 10:41:02 IST"
export function fmtTimestamp(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  });
}

// ─── Short date ────────────────────────────────────────────────────────────────
export function fmtDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

// Parses a .env file the way it is actually found on people's machines, on any OS.
//
// Two dashboard modules used to each hand-parse `.env` with `split("\n")` + `trim()`. That already
// tolerated Windows line endings (trim() drops the \r), but not the other things a Windows editor does:
// a UTF-8 byte-order mark on the first line turned the first key into "﻿RAZORPAY_…" and silently
// unset it; `export KEY=value` lines and quoted values were not understood. One parser, one behaviour.
//
// Deliberately small: KEY=value lines, `#` comments, an optional `export `, and one pair of matching
// quotes around a value. No interpolation, no multi-line values.
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

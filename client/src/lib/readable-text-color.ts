function expandHex(hex: string): string {
  const stripped = hex.replace(/^#/, "");
  if (stripped.length === 3) {
    return stripped.split("").map((c) => c + c).join("");
  }
  return stripped;
}

function channelLuminance(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const expanded = expandHex(hex);
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(primary: string, secondary: string): string {
  const primaryLum = relativeLuminance(primary);
  const secondaryLum = relativeLuminance(secondary);
  const whiteLum = 1;
  const blackLum = 0;

  const whiteMinContrast = Math.min(
    contrastRatio(whiteLum, primaryLum),
    contrastRatio(whiteLum, secondaryLum),
  );
  const blackMinContrast = Math.min(
    contrastRatio(blackLum, primaryLum),
    contrastRatio(blackLum, secondaryLum),
  );

  return whiteMinContrast >= blackMinContrast ? "#ffffff" : "#000000";
}

function expandHex(hex: string): string {
  const stripped = hex.replace(/^#/, "");
  if (stripped.length === 3) {
    return stripped.split("").map((c) => c + c).join("");
  }
  return stripped;
}

function toRgb(hex: string): [number, number, number] {
  const expanded = expandHex(hex);
  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function blendHex(
  base: string,
  overlay: string,
  overlayAlpha: number,
): string {
  const [br, bg, bb] = toRgb(base);
  const [or, og, ob] = toRgb(overlay);
  const a = Math.max(0, Math.min(1, overlayAlpha));
  return toHex(
    or * a + br * (1 - a),
    og * a + bg * (1 - a),
    ob * a + bb * (1 - a),
  );
}

function channelLuminance(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
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

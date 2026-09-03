export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function donutChart(segments: Segment[], opts: { size?: number; thickness?: number; centerLabel?: string; centerSub?: string } = {}): string {
  const size = opts.size ?? 240;
  const thickness = opts.thickness ?? 40;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;

  let angle = -90;
  const parts: string[] = [];
  for (const s of segments) {
    const frac = s.value / total;
    if (frac === 0) continue;
    if (frac >= 1) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}"/>`);
      continue;
    }
    const largeArc = frac > 0.5 ? 1 : 0;
    const sx = cx + r * Math.cos((angle * Math.PI) / 180);
    const sy = cy + r * Math.sin((angle * Math.PI) / 180);
    angle += frac * 360;
    const ex = cx + r * Math.cos((angle * Math.PI) / 180);
    const ey = cy + r * Math.sin((angle * Math.PI) / 180);
    parts.push(
      `<path d="M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}" fill="none" stroke="${s.color}" stroke-width="${thickness}"/>`,
    );
  }

  const center = opts.centerLabel
    ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="700" fill="#18181b">${opts.centerLabel}</text>` +
      (opts.centerSub
        ? `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="#71717a">${opts.centerSub}</text>`
        : '')
    : '';

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="content breakdown">${parts.join('')}${center}</svg>`;
}

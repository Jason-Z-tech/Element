/** Maßstäbe für die Kurve Trefferquote gegen Energie (logarithmische y-Achse). */

export interface PlotBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface Scales {
  readonly box: PlotBox;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  x(eStar: number): number;
  y(sigma: number): number;
  /** Umkehrung von x: Pixel -> Anregungsenergie. */
  xInverse(px: number): number;
}

export function makeScales(box: PlotBox, xMin: number, xMax: number, yMin: number, yMax: number): Scales {
  const lyMin = Math.log10(yMin);
  const lyMax = Math.log10(yMax);
  return {
    box,
    xMin,
    xMax,
    yMin,
    yMax,
    x: (e) => box.left + ((e - xMin) / (xMax - xMin)) * (box.right - box.left),
    y: (s) => {
      const clamped = Math.min(Math.max(s, yMin), yMax);
      return box.bottom - ((Math.log10(clamped) - lyMin) / (lyMax - lyMin)) * (box.bottom - box.top);
    },
    xInverse: (px) => xMin + ((px - box.left) / (box.right - box.left)) * (xMax - xMin),
  };
}

/** Zehnerpotenzen zwischen yMin und yMax (einschließlich). */
export function decadeTicks(yMin: number, yMax: number): number[] {
  const ticks: number[] = [];
  for (let e = Math.ceil(Math.log10(yMin) - 1e-9); e <= Math.floor(Math.log10(yMax) + 1e-9); e++) {
    ticks.push(Math.pow(10, e));
  }
  return ticks;
}

/** Kleinster Wert aus 1, 2, 5 mal Zehnerpotenz, der mindestens x ist. */
function niceCeil(x: number): number {
  const decade = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 2, 5, 10]) {
    if (m * decade >= x * (1 - 1e-12)) return m * decade;
  }
  return 10 * decade;
}

/**
 * y-Bereich: umfasst alle gezeigten Werte mit etwas Luft nach oben, unten eine
 * ganze Zehnerpotenz, mindestens zwei Dekaden. Nach unten begrenzt (darunter
 * liegende Kurventeile werden abgeschnitten).
 */
export function yDomain(values: readonly number[], floor: number): { yMin: number; yMax: number } {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0);
  if (positive.length === 0) return { yMin: floor, yMax: floor * 100 };
  const hi = Math.max(...positive);
  const lo = Math.min(...positive);
  const yMax = niceCeil(hi * 1.15);
  let yMin = Math.pow(10, Math.floor(Math.log10(Math.max(lo * 0.7, floor))));
  if (yMax / yMin < 100) yMin = Math.pow(10, Math.floor(Math.log10(yMax / 100) + 1e-9));
  return { yMin, yMax };
}

/** SVG-Pfad einer Kurve; Teile unterhalb von yMin werden ausgelassen. */
export function curvePath(scales: Scales, f: (eStar: number) => number, steps = 240): string {
  let d = '';
  let pen = false;
  for (let i = 0; i <= steps; i++) {
    const e = scales.xMin + (i / steps) * (scales.xMax - scales.xMin);
    const s = f(e);
    if (!(s >= scales.yMin)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${scales.x(e).toFixed(1)} ${scales.y(s).toFixed(1)}`;
    pen = true;
  }
  return d;
}

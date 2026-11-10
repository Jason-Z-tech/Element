/** Zahlen und Namen in deutscher Schreibweise. */

const cache = new Map<string, Intl.NumberFormat>();

function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}-${max}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max });
    cache.set(key, f);
  }
  return f;
}

/** Zahl mit fester Zahl von Nachkommastellen. */
export function num(x: number, digits = 1): string {
  return nf(digits, digits).format(x);
}

/** Wirkungsquerschnitt in fb: Stellen je nach Größe. */
export function fb(x: number): string {
  const a = Math.abs(x);
  if (a >= 100) return num(x, 0);
  if (a >= 10) return num(x, 1);
  if (a >= 1) return num(x, 1);
  return num(x, 2);
}

/** Zeitspanne mit passender Einheit. */
export function duration(t_s: number): string {
  if (t_s < 1e-3) return `${num(t_s * 1e6, t_s < 1e-5 ? 1 : 0)} µs`;
  if (t_s < 1) return `${num(t_s * 1e3, t_s < 0.01 ? 2 : 1)} ms`;
  if (t_s < 120) return `${num(t_s, t_s < 10 ? 2 : 1)} s`;
  return `${num(t_s / 60, 1)} min`;
}

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

function superscript(text: string): string {
  return [...text].map((c) => SUPERSCRIPT[c] ?? c).join('');
}

/** Zehnerpotenz-Schreibweise, z. B. 6·10¹². */
export function sci(x: number, digits = 1): string {
  if (x === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const mantissa = x / Math.pow(10, exp);
  const m = Number(mantissa.toFixed(digits));
  if (m >= 10) return `1·10${superscript(String(exp + 1))}`;
  const mText = nf(0, digits).format(m);
  return mText === '1' ? `10${superscript(String(exp))}` : `${mText}·10${superscript(String(exp))}`;
}

/** Zerlegt eine Kern-Kennung wie „295-120“ oder „291Og“ in Massenzahl und Symbol. */
export function nuclideParts(id: string): { mass: string; symbol: string } {
  const m = /^(\d+)-?(.+)$/.exec(id);
  if (!m) return { mass: '', symbol: id };
  return { mass: m[1]!, symbol: m[2]! };
}

/** Kern als Text mit hochgestellter Massenzahl, z. B. ²⁹⁵120. */
export function nuclideText(id: string): string {
  const { mass, symbol } = nuclideParts(id);
  return `${superscript(mass)}${symbol}`;
}

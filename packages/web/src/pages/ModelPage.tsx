import { stage2 } from '@elementjaeger/core';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import calibrationFile from '../../../../docs/daten/stufe2-eichung.json';
import limitsFile from '../../../../docs/daten/stufe2-grenzen.json';
import testFile from '../../../../docs/daten/stufe2-pruefung.json';
import { fb, num } from '../format';
import { runEnsemble, type EnsembleProgress } from '../stage2/pool';

interface Row {
  id: string;
  role: string;
  reaction: string;
  neutrons: number;
  eCm: number;
  eStarModel: number;
  width: number;
  energyFrom: string;
  measured_pb: number;
  errPlus_pb: number;
  errMinus_pb: number;
  lab: string;
  reference: string;
  status: string;
  model_pb: number;
  bandLow_pb: number;
  bandMedian_pb: number;
  bandHigh_pb: number;
  ratio: number;
  inBand: boolean;
}
interface Group {
  name: string;
  points: number;
  meanFactor: number;
  scatterFactor: number;
  inBand: number;
}
interface ResultFile {
  modelVersion: string;
  seed: number;
  members: number;
  cascades: number;
  summary: { points: number; meanFactor: number; scatterFactor: number; inBand: number; groups: Group[] };
  results: Row[];
}
interface Limit {
  label: string;
  limit_pb: number;
  lab: string;
  eStarAtMax: number;
  modelMax_pb: number;
  bandLow_pb: number;
  bandHigh_pb: number;
  fractionAboveLimit: number;
}

const calibration = calibrationFile as unknown as ResultFile;
const test = testFile as unknown as ResultFile;
const limits = (limitsFile as unknown as { results: Limit[] }).results;

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** „Ca48+Pu244“ -> „⁴⁸Ca + ²⁴⁴Pu“. */
function reactionLabel(id: string): string {
  return id
    .split('+')
    .map((part) => {
      const m = /^([A-Za-z]+)(\d+)$/.exec(part);
      return m ? [...m[2]!].map((c) => SUP[c]).join('') + m[1] : part;
    })
    .join(' + ');
}
/** Wirkungsquerschnitt in pb mit passender Stellenzahl. */
function pb(x: number): string {
  if (x === 0) return '0';
  if (x >= 100) return num(x, 0);
  if (x >= 10) return num(x, 1);
  if (x >= 0.1) return num(x, 2);
  if (x >= 0.001) return num(x, 4);
  return x.toExponential(1).replace('.', ',');
}
function factor(ratio: number): string {
  return ratio >= 1 ? `× ${num(ratio, ratio >= 10 ? 0 : 1)}` : `÷ ${num(1 / ratio, 1 / ratio >= 10 ? 0 : 1)}`;
}
const heavy = (r: Row): boolean => !r.reaction.startsWith('Ca48');

const LO = 1e-3;
const HI = 1e3;

function Scatter({ onPick, picked }: { onPick(row: Row): void; picked: Row | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<Row | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const o = new ResizeObserver(measure);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const W = Math.max(280, Math.min(width, 760));
  const H = Math.min(W, 520);
  const box = { left: 56, right: W - 14, top: 16, bottom: H - 46 };
  const clamp = (v: number) => Math.min(HI, Math.max(LO, v));
  const x = (v: number) => box.left + ((Math.log10(clamp(v)) + 3) / 6) * (box.right - box.left);
  const y = (v: number) => box.bottom - ((Math.log10(clamp(v)) + 3) / 6) * (box.bottom - box.top);
  const ticks = [1e-3, 1e-2, 1e-1, 1, 10, 100, 1000];
  const tick = (t: number) => (t >= 1 ? num(t, 0) : num(t, t >= 0.1 ? 1 : t >= 0.01 ? 2 : 3));
  const rows: Row[] = [...calibration.results, ...test.results];
  const shown = hover ?? picked;
  return (
    <div class="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gerechneter gegen gemessenen Wirkungsquerschnitt. Alle Werte stehen auch in den Tabellen darunter." onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line class="grid" x1={box.left} x2={box.right} y1={y(t)} y2={y(t)} />
            <line class="grid" x1={x(t)} x2={x(t)} y1={box.top} y2={box.bottom} />
            <text class="tick" x={box.left - 8} y={y(t)} text-anchor="end" dominant-baseline="middle">{tick(t)}</text>
            {(W >= 520 || Math.round(Math.log10(t)) % 2 !== 0) && <text class="tick" x={x(t)} y={box.bottom + 17} text-anchor="middle">{tick(t)}</text>}
          </g>
        ))}
        {/* Rechnung = Messung, und Faktor 10 darüber und darunter */}
        <line class="diag" x1={x(LO)} y1={y(LO)} x2={x(HI)} y2={y(HI)} />
        <line class="diag diag-10" x1={x(LO)} y1={y(LO * 10)} x2={x(HI / 10)} y2={y(HI)} />
        <line class="diag diag-10" x1={x(LO * 10)} y1={y(LO)} x2={x(HI)} y2={y(HI / 10)} />
        <text class="direct-label" x={x(HI / 10) - 6} y={y(HI) + 14} text-anchor="end">Faktor 10 zu hoch</text>
        <text class="direct-label" x={x(HI) - 6} y={y(HI / 10) + 14} text-anchor="end">Faktor 10 zu tief</text>
        <text class="axis-title" x={(box.left + box.right) / 2} y={H - 8} text-anchor="middle">gemessen (pb)</text>
        <text class="axis-title" x={4} y={12}>gerechnet (pb)</text>
        {rows.map((r) => {
          const cls = r.role === 'eichung' ? 'pt-cal' : heavy(r) ? 'pt-heavy' : 'pt-test';
          const active = shown?.id === r.id;
          return (
            <g
              key={r.id}
              class={`mpoint ${cls} ${active ? 'is-active' : ''}`}
              tabIndex={0}
              role="img"
              aria-label={`${reactionLabel(r.reaction)}, ${r.neutrons}n: gemessen ${pb(r.measured_pb)} pb, gerechnet ${pb(r.model_pb)} pb`}
              onPointerEnter={() => setHover(r)}
              onFocus={() => setHover(r)}
              onBlur={() => setHover(null)}
              onClick={() => onPick(r)}
            >
              <rect class="hit" x={x(r.measured_pb) - 12} y={y(r.model_pb) - 12} width="24" height="24" />
              {r.role !== 'eichung' && <line class="mark" x1={x(r.measured_pb)} x2={x(r.measured_pb)} y1={y(r.bandHigh_pb)} y2={y(r.bandLow_pb)} />}
              {r.role !== 'eichung' && <line class="mark" x1={x(r.measured_pb - r.errMinus_pb)} x2={x(r.measured_pb + r.errPlus_pb)} y1={y(r.model_pb)} y2={y(r.model_pb)} />}
              <circle class="dot" cx={x(r.measured_pb)} cy={y(r.model_pb)} r={r.role === 'eichung' ? 3 : 5} />
            </g>
          );
        })}
      </svg>
      {shown && (
        <div class={`tooltip ${x(shown.measured_pb) > W / 2 ? 'is-flipped' : ''}`} style={{ left: `${(x(shown.measured_pb) / W) * 100}%`, top: `${Math.max(8, (y(shown.model_pb) / H) * 100 - 6)}%` }} role="status">
          <div class="tooltip-head">
            {reactionLabel(shown.reaction)}, {shown.neutrons}n <span>· {shown.role === 'eichung' ? 'Eichung' : 'Prüfung'}</span>
          </div>
          <div class="tooltip-row"><span></span><strong>{pb(shown.measured_pb)} pb</strong><span>gemessen ({shown.lab})</span></div>
          <div class="tooltip-row"><span></span><strong>{pb(shown.model_pb)} pb</strong><span>gerechnet, {factor(shown.ratio)}</span></div>
          <div class="tooltip-row tooltip-sub"><span></span><strong>{pb(shown.bandLow_pb)} … {pb(shown.bandHigh_pb)} pb</strong><span>68-%-Band</span></div>
        </div>
      )}
    </div>
  );
}

function ResultTable({ rows, caption, onPick, picked }: { rows: Row[]; caption: string; onPick(r: Row): void; picked: Row | null }) {
  return (
    <div class="table-wrap">
      <table>
        <caption class="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Reaktion</th>
            <th scope="col">Kanal</th>
            <th scope="col" class="n">E* (MeV)</th>
            <th scope="col" class="n">gemessen (pb)</th>
            <th scope="col" class="n">gerechnet (pb)</th>
            <th scope="col" class="n">68-%-Band (pb)</th>
            <th scope="col" class="n">Abweichung</th>
            <th scope="col">im Band</th>
            <th scope="col">Experiment</th>
            <th scope="col">Quelle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} class={picked?.id === r.id ? 'is-selected' : ''}>
              <td>
                <button type="button" class="link" onClick={() => onPick(r)}>{reactionLabel(r.reaction)}</button>
              </td>
              <td>{r.neutrons}n</td>
              <td class="n">{num(r.eStarModel, 1)}</td>
              <td class="n">{pb(r.measured_pb)} <span class="err">+{pb(r.errPlus_pb)} −{pb(r.errMinus_pb)}</span></td>
              <td class="n"><strong>{pb(r.model_pb)}</strong></td>
              <td class="n">{pb(r.bandLow_pb)} … {pb(r.bandHigh_pb)}</td>
              <td class="n">{factor(r.ratio)}</td>
              <td>{r.inBand ? 'ja' : 'nein'}</td>
              <td>{r.lab}</td>
              <td title={r.reference}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Recompute({ row, file, index }: { row: Row; file: ResultFile; index: number }) {
  const [progress, setProgress] = useState<EnsembleProgress | null>(null);
  const [result, setResult] = useState<{ low: number; median: number; high: number; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = useRef<{ cancel(): void } | null>(null);
  useEffect(() => {
    setProgress(null);
    setResult(null);
    setError(null);
    return () => job.current?.cancel();
  }, [row.id]);
  const start = () => {
    const [p, t] = row.reaction.split('+');
    const parse = (text: string) => {
      const m = /^([A-Za-z]+)(\d+)$/.exec(text)!;
      const z: Record<string, number> = { Ca: 20, Ti: 22, Cr: 24, Th: 90, U: 92, Pu: 94, Am: 95, Cm: 96, Bk: 97, Cf: 98 };
      return { symbol: m[1]!, z: z[m[1]!]!, a: Number(m[2]) };
    };
    const n = row.width > 0 ? 5 : 1;
    const energies = Array.from({ length: n }, (_, j) => (n === 1 ? row.eCm : row.eCm - row.width / 2 + (row.width * (j + 0.5)) / n));
    const begun = Date.now();
    setResult(null);
    setError(null);
    const run = runEnsemble(
      { reaction: { id: row.reaction, projectile: parse(p!), target: parse(t!) }, energies, seed: file.seed + index, members: file.members, cascades: file.cascades },
      setProgress,
    );
    job.current = run;
    run.promise
      .then((values) => {
        const b = stage2.band(values, file.members, row.neutrons);
        setResult({ low: b.low, median: b.median, high: b.high, seconds: (Date.now() - begun) / 1000 });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  const running = progress !== null && result === null && error === null;
  const same = result !== null && Math.abs(result.low - row.bandLow_pb) <= 1e-9 * row.bandLow_pb && Math.abs(result.high - row.bandHigh_pb) <= 1e-9 * row.bandHigh_pb;
  return (
    <div class="recompute">
      <p>
        <strong>{reactionLabel(row.reaction)}, {row.neutrons}n</strong> bei E_cm = {num(row.eCm, 1)} MeV ({row.lab}; {row.reference}). Gemessen{' '}
        {pb(row.measured_pb)} pb, gerechnet {pb(row.model_pb)} pb ({factor(row.ratio)}), 68-%-Band der Referenzrechnung {pb(row.bandLow_pb)} …{' '}
        {pb(row.bandHigh_pb)} pb.
      </p>
      <button type="button" class="secondary" disabled={running} onClick={start}>
        {running ? 'Rechnet …' : 'Im Browser nachrechnen'}
      </button>
      {progress && (
        <p class="hint" role="status">
          {progress.done} von {progress.total} Ziehungen, {num(progress.rate, 0)} Ziehungen pro Sekunde auf {progress.workers}{' '}
          {progress.workers === 1 ? 'Kern' : 'Kernen'}.
        </p>
      )}
      {result && (
        <p>
          Dein Browser: 68-%-Band {pb(result.low)} … {pb(result.high)} pb (Median {pb(result.median)} pb) in {num(result.seconds, 1)} s.{' '}
          {same ? 'Stimmt mit der Referenzrechnung überein.' : 'Weicht von der Referenzrechnung ab; bitte melden.'}
        </p>
      )}
      {error && <p class="error" role="alert">Die Rechnung ist fehlgeschlagen: {error}</p>}
    </div>
  );
}

/** Zusammenfassung je Reaktion: kleinste und größte Abweichung. */
function byReaction(rows: Row[]): { reaction: string; points: number; min: number; max: number; inBand: number }[] {
  const map = new Map<string, { reaction: string; points: number; min: number; max: number; inBand: number }>();
  for (const r of rows) {
    const e = map.get(r.reaction) ?? { reaction: r.reaction, points: 0, min: Infinity, max: 0, inBand: 0 };
    e.points++;
    e.min = Math.min(e.min, r.ratio);
    e.max = Math.max(e.max, r.ratio);
    if (r.inBand) e.inBand++;
    map.set(r.reaction, e);
  }
  return [...map.values()];
}

export function ModelPage() {
  const [picked, setPicked] = useState<Row | null>(null);
  const groups = test.summary.groups;
  const ca = groups.find((g) => g.name === '48Ca');
  const hv = groups.find((g) => g.name !== '48Ca');
  const pickedInfo = useMemo(() => {
    if (!picked) return null;
    const file = picked.role === 'eichung' ? calibration : test;
    return { file, index: file.results.findIndex((r) => r.id === picked.id) };
  }, [picked]);
  return (
    <main class="model-page">
      <section class="panel">
        <h2>Wie gut ist das Modell?</h2>
        <p class="lead">
          Stufe 2 rechnet die Trefferquote aus drei Wahrscheinlichkeiten: Einfang, Verschmelzen, Überleben. Geeicht wurden genau zwei
          Zahlen an {calibration.summary.points} Messungen mit ⁴⁸Ca-Strahl. Danach wurde der Parametersatz eingefroren und an{' '}
          {test.summary.points} weiteren Messungen geprüft, ohne etwas nachzustellen.
        </p>
        <dl class="readout readout-model">
          <div>
            <dt>Eichung: Streuung Rechnung gegen Messung</dt>
            <dd>Faktor {num(calibration.summary.scatterFactor, 1)}</dd>
          </div>
          {ca && (
            <div>
              <dt>Prüfung mit ⁴⁸Ca ({ca.points} Messungen)</dt>
              <dd>Faktor {num(ca.scatterFactor, 1)}, im Mittel {factor(ca.meanFactor)}</dd>
            </div>
          )}
          {hv && (
            <div>
              <dt>Prüfung mit ⁵⁰Ti und ⁵⁴Cr ({hv.points} Messungen)</dt>
              <dd>Faktor {num(hv.scatterFactor, 1)}, im Mittel {factor(hv.meanFactor)}</dd>
            </div>
          )}
          <div>
            <dt>Prüf-Messungen im 68-%-Band</dt>
            <dd>{test.summary.inBand} von {test.summary.points}</dd>
          </div>
        </dl>
        <p class="hint">
          „Streuung“ ist das quadratische Mittel der Abweichungen im Logarithmus, als Faktor ausgedrückt. Modell {test.modelVersion}; jede Zeile
          mit {test.members} Ziehungen der unsicheren Eingangsgrößen gerechnet.
        </p>
      </section>

      <section class="panel verdict">
        <h2>Befund</h2>
        <p class="lead">
          <strong>Das Modell besteht die Prüfung in dieser Fassung nicht.</strong> Es trifft die Eich-Reaktionen auf etwa eine Größenordnung
          und von den Prüf-Reaktionen nur ⁴⁸Ca + ²⁴⁴Pu. Die übrigen rechnet es um Faktoren von 3 bis über 100 000 zu tief. Für Vorhersagen
          für die Elemente 119 und 120 ist es so nicht gut genug; die Zahlen auf der Seite „Ergebnisse“ tragen deshalb einen großen Vorbehalt.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Prüf-Reaktion</th>
                <th scope="col" class="n">Messungen</th>
                <th scope="col" class="n">Rechnung gegen Messung</th>
                <th scope="col" class="n">im 68-%-Band</th>
              </tr>
            </thead>
            <tbody>
              {byReaction(test.results).map((g) => (
                <tr key={g.reaction}>
                  <td>{reactionLabel(g.reaction)}</td>
                  <td class="n">{g.points}</td>
                  <td class="n">{g.points === 1 ? factor(g.min) : `${factor(g.min)} bis ${factor(g.max)}`}</td>
                  <td class="n">{g.inBand} von {g.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="hint">
          Nach dem ersten Blick auf die Prüf-Reaktionen wurde nichts nachgestellt. Die wahrscheinlichen Ursachen stehen im Modell-Dokument
          (docs/modell-stufe2.md, Abschnitt 16).
        </p>
      </section>

      <section class="panel chart-panel">
        <h2>Messwert gegen Rechnung</h2>
        <ul class="legend" aria-label="Legende">
          <li><span class="key key-dot key-s1"></span>Prüfung, ⁴⁸Ca-Strahl</li>
          <li><span class="key key-dot key-s2"></span>Prüfung, ⁵⁰Ti- und ⁵⁴Cr-Strahl</li>
          <li><span class="key key-dot key-cal"></span>Eichung</li>
          <li><span class="key key-line key-diag"></span>Rechnung = Messung</li>
        </ul>
        <Scatter onPick={setPicked} picked={picked} />
        <p class="hint">Senkrechte Balken: 68-%-Band der Rechnung. Waagrechte Balken: Fehler der Messung. Beide Achsen sind logarithmisch. Klick auf einen Punkt wählt die Messung.</p>
        {picked && pickedInfo && <Recompute row={picked} file={pickedInfo.file} index={pickedInfo.index} />}
      </section>

      <section class="panel">
        <h2>Prüf-Reaktionen</h2>
        <ResultTable rows={test.results} caption="Prüf-Reaktionen: Messwert gegen Rechnung" onPick={setPicked} picked={picked} />
        <p class="hint">
          Quelle: P = Originalarbeit gelesen, X = EXFOR-Datenbank der IAEA, X+ = EXFOR, vom Autor bestätigt, S = Zahl aus einer Arbeit, die das
          Original zitiert. E* ist mit dem Q-Wert unserer Massentabelle gerechnet.
        </p>
      </section>

      <section class="panel">
        <h2>Obergrenzen aus erfolglosen Suchen</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Reaktion</th>
                <th scope="col" class="n">Obergrenze (fb)</th>
                <th scope="col" class="n">gerechnet, Maximum (fb)</th>
                <th scope="col" class="n">bei E* (MeV)</th>
                <th scope="col" class="n">68-%-Band (fb)</th>
                <th scope="col" class="n">Ziehungen über der Grenze</th>
                <th scope="col">Experiment</th>
              </tr>
            </thead>
            <tbody>
              {limits.map((l) => (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td class="n">&lt; {fb(l.limit_pb * 1000)}</td>
                  <td class="n"><strong>{pb(l.modelMax_pb * 1000)}</strong></td>
                  <td class="n">{num(l.eStarAtMax, 0)}</td>
                  <td class="n">{pb(l.bandLow_pb * 1000)} … {pb(l.bandHigh_pb * 1000)}</td>
                  <td class="n">{num(100 * l.fractionAboveLimit, 0)} %</td>
                  <td>{l.lab}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="hint">Eine Rechnung, die deutlich über einer Obergrenze liegt, widerspräche dem Experiment.</p>
      </section>

      <details class="panel">
        <summary><h2>Eich-Reaktionen ({calibration.summary.points} Messungen)</h2></summary>
        <ResultTable rows={calibration.results} caption="Eich-Reaktionen: Messwert gegen Rechnung" onPick={setPicked} picked={picked} />
      </details>
    </main>
  );
}

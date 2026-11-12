import { stage2 } from '@elementjaeger/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import predictionsFile from '../../../../docs/daten/stufe2-vorhersagen.json';
import testFile from '../../../../docs/daten/stufe2-pruefung.json';
import { num } from '../format';
import { PACKET_SIZE, runEnsemble } from '../stage2/pool';
import { clearPackets, loadPackets, savePacket } from '../stage2/store';

interface ChannelPoint {
  neutrons: number;
  sigma_fb: number;
  statError_fb: number;
  low_fb: number;
  median_fb: number;
  high_fb: number;
}
interface Point {
  eStar_MeV: number;
  eCm_MeV: number;
  eLab_MeV: number;
  seed: number;
  channels: ChannelPoint[];
  total: { sigma_fb: number; low_fb: number; median_fb: number; high_fb: number };
}
interface ReactionResult {
  id: string;
  element: number;
  label: string;
  compound: string;
  qValue_MeV: number;
  points: Point[];
}
interface PredictionFile {
  modelVersion: string;
  createdAt: string;
  seed: number;
  members: number;
  cascades: number;
  note: string;
  reactions: ReactionResult[];
}
const file = predictionsFile as unknown as PredictionFile;
const testSummary = (testFile as unknown as { summary: { scatterFactor: number; points: number; inBand: number } }).summary;

/** Veröffentlichte Vorhersagen und Obergrenzen zum Vergleich (Quellen im Modell-Dokument). */
const COMPARE: Record<string, { published: { label: string; eStar?: number; fb: number }[]; limit_fb?: number; limitLab?: string }> = {
  'Ti50+Cf249': {
    published: [
      { label: 'Zhang et al. 2026 (4n)', eStar: 41, fb: 48.2 },
      { label: 'Siwek-Wilczyńska et al. 2012', fb: 6 },
    ],
    limit_fb: 200,
    limitLab: 'TASCA, GSI',
  },
  'Cr54+Cm248': {
    published: [
      { label: 'Zhang et al. 2026 (3n)', eStar: 32, fb: 5.25 },
      { label: 'Siwek-Wilczyńska et al. 2012', fb: 1 },
    ],
    limit_fb: 580,
    limitLab: 'SHIP, GSI',
  },
  'V51+Bk249': { published: [{ label: 'Zhang et al. 2026 (3n)', eStar: 34, fb: 12.33 }] },
  'Ti50+Bk249': { published: [{ label: 'Siwek-Wilczyńska et al. 2012', fb: 30 }], limit_fb: 65, limitLab: 'TASCA, GSI' },
  'V51+Cm248': { published: [] },
  'Cr54+Am243': { published: [] },
};

function fbText(x: number): string {
  if (x === 0) return '0';
  if (x >= 100) return num(x, 0);
  if (x >= 10) return num(x, 1);
  if (x >= 0.1) return num(x, 2);
  if (x >= 0.001) return num(x, 4);
  return x.toExponential(1).replace('.', ',');
}
const best = (r: ReactionResult): Point => r.points.reduce((a, b) => (b.total.sigma_fb > a.total.sigma_fb ? b : a));
const bestChannel = (p: Point): ChannelPoint => p.channels.reduce((a, b) => (b.sigma_fb > a.sigma_fb ? b : a));

function download(name: string, type: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(): string {
  const rows = ['Reaktion;Element;Compoundkern;Kanal;E_stern_MeV;E_cm_MeV;E_lab_MeV;sigma_fb;stat_Fehler_fb;Band_16_fb;Median_fb;Band_84_fb;Modell;Zeitstempel;Seed;Ziehungen;Kaskaden'];
  for (const r of file.reactions) {
    for (const p of r.points) {
      const meta = `${file.modelVersion};${file.createdAt};${p.seed};${file.members};${file.cascades}`;
      for (const c of p.channels) {
        rows.push(`${r.id};${r.element};${r.compound};${c.neutrons}n;${p.eStar_MeV};${p.eCm_MeV};${p.eLab_MeV};${c.sigma_fb};${c.statError_fb};${c.low_fb};${c.median_fb};${c.high_fb};${meta}`);
      }
      rows.push(`${r.id};${r.element};${r.compound};Summe 2n-5n;${p.eStar_MeV};${p.eCm_MeV};${p.eLab_MeV};${p.total.sigma_fb};;${p.total.low_fb};${p.total.median_fb};${p.total.high_fb};${meta}`);
    }
  }
  return rows.join('\n') + '\n';
}

const Y_LO = 1e-5;
const Y_HI = 1e3;

function Mini({ r }: { r: ReactionResult }) {
  const W = 340;
  const H = 240;
  const box = { left: 56, right: W - 10, top: 12, bottom: H - 34 };
  const x = (e: number) => box.left + ((e - 26) / 30) * (box.right - box.left);
  const y = (v: number) => box.bottom - ((Math.log10(Math.min(Y_HI, Math.max(Y_LO, v))) + 5) / 8) * (box.bottom - box.top);
  const cmp = COMPARE[r.id]!;
  const top = r.points.map((p) => `${x(p.eStar_MeV).toFixed(1)} ${y(p.total.high_fb).toFixed(1)}`);
  const bottom = r.points.map((p) => `${x(p.eStar_MeV).toFixed(1)} ${y(p.total.low_fb).toFixed(1)}`).reverse();
  const median = r.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.eStar_MeV).toFixed(1)} ${y(p.total.median_fb).toFixed(1)}`).join('');
  const ticks = [1e-4, 1e-2, 1, 100];
  return (
    <figure class="mini">
      <figcaption>
        <strong>{r.label}</strong> → Element {r.element}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${r.label}: gerechnete Trefferquote gegen Anregungsenergie. Zahlen in der Tabelle.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line class="grid" x1={box.left} x2={box.right} y1={y(t)} y2={y(t)} />
            <text class="tick" x={box.left - 6} y={y(t)} text-anchor="end" dominant-baseline="middle">{t >= 1 ? num(t, 0) : num(t, t >= 0.01 ? 2 : 4)}</text>
          </g>
        ))}
        {[30, 40, 50].map((e) => (
          <text key={e} class="tick" x={x(e)} y={box.bottom + 16} text-anchor="middle">{e}</text>
        ))}
        <line class="axis" x1={box.left} x2={box.right} y1={box.bottom} y2={box.bottom} />
        {cmp.limit_fb !== undefined && (
          <g>
            <line class="limit-line" x1={box.left} x2={box.right} y1={y(cmp.limit_fb)} y2={y(cmp.limit_fb)} />
            <text class="direct-label" x={box.right - 2} y={y(cmp.limit_fb) - 5} text-anchor="end">Obergrenze {cmp.limitLab}</text>
          </g>
        )}
        <path class="band-fill" d={`M${top.join('L')}L${bottom.join('L')}Z`} />
        <path class="curve curve-s1" d={median} />
        {cmp.published.map((p) => (
          <circle key={p.label} class="published" cx={x(p.eStar ?? 41)} cy={y(p.fb)} r="4.5">
            <title>{p.label}: {fbText(p.fb)} fb</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}

interface LocalState {
  saved: number;
  total: number;
  running: boolean;
  rate: number;
  cores: number;
  match: 'offen' | 'ja' | 'nein';
  error: string | null;
}

/** Exakte Energien und Seeds aus dem Kern (die Datei rundet die Energien auf drei Stellen). */
let exactJobs: stage2.PredictionJob[] | null = null;
function exactJob(reactionId: string, energyIndex: number): stage2.PredictionJob {
  exactJobs ??= stage2.predictionJobs();
  const job = exactJobs.find((j) => j.reactionId === reactionId && j.energyIndex === energyIndex);
  if (!job) throw new Error(`Kein Ensemble für ${reactionId}, Energie ${energyIndex}`);
  return job;
}

function prefixFor(r: ReactionResult, energyIndex: number): string {
  return `${file.modelVersion}|${file.seed}|${file.members}|${file.cascades}|${r.id}|${String(energyIndex).padStart(2, '0')}`;
}

function LocalRun({ r }: { r: ReactionResult }) {
  const total = r.points.length * file.members;
  const [state, setState] = useState<LocalState>({ saved: 0, total, running: false, rate: 0, cores: 0, match: 'offen', error: null });
  const stop = useRef<{ cancel(): void } | null>(null);
  const cancelled = useRef(false);

  // Beim Öffnen der Seite: Was liegt schon im Browser?
  useEffect(() => {
    let alive = true;
    (async () => {
      let saved = 0;
      for (let i = 0; i < r.points.length; i++) saved += (await loadPackets(prefixFor(r, i))).size * PACKET_SIZE;
      if (alive) setState((s) => ({ ...s, saved: Math.min(saved, total) }));
    })().catch(() => undefined);
    return () => {
      alive = false;
      cancelled.current = true;
      stop.current?.cancel();
    };
  }, [r.id]);

  const run = async () => {
    cancelled.current = false;
    setState((s) => ({ ...s, running: true, error: null, match: 'offen' }));
    try {
      const reaction = stage2.getPredictionReaction(r.id);
      let allMatch = true;
      let savedBefore = 0;
      for (let i = 0; i < r.points.length && !cancelled.current; i++) {
        const point = r.points[i]!;
        const exact = exactJob(r.id, i);
        const prefix = prefixFor(r, i);
        const done = await loadPackets(prefix);
        const job = runEnsemble(
          {
            reaction: { id: reaction.id, projectile: reaction.projectile, target: reaction.target },
            energies: [exact.eCm_MeV],
            seed: exact.seed,
            members: file.members,
            cascades: file.cascades,
            done,
            onPacket: (first, values) => void savePacket(prefix, first, values.slice()),
          },
          (p) => setState((s) => ({ ...s, saved: savedBefore + p.done, rate: p.rate, cores: p.workers })),
        );
        stop.current = job;
        const values = await job.promise;
        savedBefore += file.members;
        const b = stage2.totalBand(values, file.members);
        const same = (a: number, ref: number) => Math.abs(a * 1000 - ref) <= 1e-9 * Math.max(ref, 1e-30);
        if (!(same(b.low, point.total.low_fb) && same(b.median, point.total.median_fb) && same(b.high, point.total.high_fb))) allMatch = false;
        setState((s) => ({ ...s, saved: savedBefore }));
      }
      if (!cancelled.current) setState((s) => ({ ...s, running: false, match: allMatch ? 'ja' : 'nein' }));
    } catch (e) {
      if (!cancelled.current) setState((s) => ({ ...s, running: false, error: e instanceof Error ? e.message : String(e) }));
    }
  };
  const pause = () => {
    cancelled.current = true;
    stop.current?.cancel();
    setState((s) => ({ ...s, running: false }));
  };

  return (
    <div class="local-run">
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={state.total} aria-valuenow={state.saved} aria-label={`Fortschritt ${r.label}`}>
        <span style={{ width: `${(100 * state.saved) / state.total}%` }}></span>
      </div>
      <span class="local-text">
        {num(state.saved, 0)} von {num(state.total, 0)} Ziehungen
        {state.running && state.rate > 0 && `, ${num(state.rate, 0)} pro Sekunde auf ${state.cores} ${state.cores === 1 ? 'Kern' : 'Kernen'}`}
        {state.match === 'ja' && ' · stimmt mit der Referenz überein'}
        {state.match === 'nein' && ' · weicht von der Referenz ab, bitte melden'}
        {state.error && ` · Fehler: ${state.error}`}
      </span>
      {state.running ? (
        <button type="button" class="link" onClick={pause}>Anhalten</button>
      ) : (
        <button type="button" class="link" onClick={run}>{state.saved > 0 && state.saved < state.total ? 'Weiterrechnen' : 'Nachrechnen'}</button>
      )}
    </div>
  );
}

export function ResultsPage() {
  const [cleared, setCleared] = useState(0);
  const created = new Date(file.createdAt);
  return (
    <main class="model-page">
      <section class="panel verdict">
        <h2>Ergebnisse: Vorhersagen für die Elemente 119 und 120</h2>
        <p class="lead">
          <strong>Mit großem Vorbehalt.</strong> Das Modell hat die Prüfung an gemessenen Reaktionen nicht bestanden: Dort streut es um einen
          Faktor {num(testSummary.scatterFactor, 0)} und rechnet fast immer zu tief, bei schwereren Projektilen als ⁴⁸Ca um Faktoren von 3 bis 76.
          Die Zahlen unten liegen deshalb wahrscheinlich zu tief. Sie sind das ehrliche Ergebnis dieser Modellfassung, keine Empfehlung für ein
          Experiment.
        </p>
        <p class="hint">
          Das ist eine Simulation. Eine Entdeckung ist erst das im Beschleuniger gemessene Atom. Details zur Prüfung auf der Seite „Wie gut ist
          das Modell?“.
        </p>
      </section>

      <section class="panel">
        <h2>Größte gerechnete Trefferquote je Reaktion</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Reaktion</th>
                <th scope="col" class="n">Element</th>
                <th scope="col" class="n">Maximum (fb)</th>
                <th scope="col" class="n">68-%-Band (fb)</th>
                <th scope="col" class="n">E* (MeV)</th>
                <th scope="col" class="n">Strahl (MeV)</th>
                <th scope="col">stärkster Kanal</th>
                <th scope="col" class="n">Obergrenze (fb)</th>
                <th scope="col">veröffentlichte Vorhersagen (fb)</th>
              </tr>
            </thead>
            <tbody>
              {file.reactions.map((r) => {
                const p = best(r);
                const c = bestChannel(p);
                const cmp = COMPARE[r.id]!;
                return (
                  <tr key={r.id}>
                    <td>{r.label}</td>
                    <td class="n">{r.element}</td>
                    <td class="n"><strong>{fbText(p.total.sigma_fb)}</strong></td>
                    <td class="n">{fbText(p.total.low_fb)} … {fbText(p.total.high_fb)}</td>
                    <td class="n">{num(p.eStar_MeV, 0)}</td>
                    <td class="n">{num(p.eLab_MeV, 1)}</td>
                    <td>{c.neutrons}n ({fbText(c.sigma_fb)} ± {fbText(c.statError_fb)} fb)</td>
                    <td class="n">{cmp.limit_fb !== undefined ? `< ${num(cmp.limit_fb, 0)}` : '–'}</td>
                    <td>{cmp.published.length ? cmp.published.map((x) => `${fbText(x.fb)} (${x.label})`).join('; ') : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p class="hint">
          Maximum: Summe der Kanäle 2n bis 5n ohne Verschiebung der Eingangsgrößen. Band: 16-%- und 84-%-Quantil aus {num(file.members, 0)}{' '}
          Ziehungen der unsicheren Eingangsgrößen (Modellunsicherheit). „±“ beim Kanal ist der statistische Fehler der Monte-Carlo-Rechnung. E* ist
          mit dem Q-Wert der Massentabelle gerechnet; für das Experiment zählt die Strahlenergie.
        </p>
        <dl class="readout readout-model">
          <div><dt>Modellversion</dt><dd>{file.modelVersion}</dd></div>
          <div><dt>Zeitstempel der Rechnung</dt><dd><time dateTime={file.createdAt}>{created.toLocaleString('de-DE', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'medium' })} UTC</time></dd></div>
          <div><dt>Ziehungen je Energie</dt><dd>{num(file.members, 0)} mit je {num(file.cascades, 0)} Kaskaden</dd></div>
          <div><dt>Ziehungen insgesamt</dt><dd>{num(file.members * file.reactions.reduce((s, r) => s + r.points.length, 0), 0)}</dd></div>
          <div><dt>Seed</dt><dd class="mono">{file.seed}</dd></div>
        </dl>
        <p class="export">
          <button type="button" class="secondary" onClick={() => download('elementjaeger-vorhersagen.csv', 'text/csv;charset=utf-8', toCsv())}>Als CSV speichern</button>{' '}
          <button type="button" class="secondary" onClick={() => download('elementjaeger-vorhersagen.json', 'application/json', JSON.stringify(file, null, 1))}>Als JSON speichern</button>
        </p>
      </section>

      <section class="panel chart-panel">
        <h2>Trefferquote gegen Anregungsenergie</h2>
        <ul class="legend" aria-label="Legende">
          <li><span class="key key-line key-s1"></span>gerechnet, Median der Ziehungen (Summe 2n bis 5n)</li>
          <li><span class="key key-area"></span>68-%-Band</li>
          <li><span class="key key-ring"></span>veröffentlichte Vorhersage</li>
          <li><span class="key key-line key-diag"></span>Obergrenze aus erfolgloser Suche</li>
        </ul>
        <div class="minis">
          {file.reactions.map((r) => (
            <Mini key={r.id} r={r} />
          ))}
        </div>
        <p class="hint">Senkrecht: Trefferquote in fb (logarithmisch). Waagrecht: Anregungsenergie E* in MeV. Alle Felder haben dieselben Achsen. Veröffentlichte Vorhersagen ohne Energieangabe sind bei 41 MeV eingezeichnet.</p>
      </section>

      <section class="panel">
        <h2>Selbst nachrechnen</h2>
        <p class="lead">
          Jede Reaktion lässt sich im Browser nachrechnen, mit einem Worker je CPU-Kern. Der Zwischenstand liegt im Browser; nach dem Schließen
          des Tabs geht es beim nächsten Öffnen weiter. Am Ende wird das Ergebnis mit der Referenzrechnung verglichen.
        </p>
        <ul class="local-list" key={cleared}>
          {file.reactions.map((r) => (
            <li key={r.id}>
              <strong>{r.label}</strong>
              <LocalRun r={r} />
            </li>
          ))}
        </ul>
        <button type="button" class="link" onClick={() => void clearPackets().then(() => setCleared((n) => n + 1))}>Gespeicherte Zwischenstände löschen</button>
      </section>
    </main>
  );
}

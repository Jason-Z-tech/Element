import { DEFAULTS, eLabForExcitation, excitationForELab, getReaction } from '@elementjaeger/core';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ClientMessage, JobView, LabView, ServerMessage } from '../../../server/src/protocol';
import { Chart } from '../components/Chart';
import { num } from '../format';
import { measuredPoints, type StoredRun } from '../state';
import type { PacketRequest, PacketResponse } from '../stage2/worker2';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
const DEFAULT_SERVER =
  env?.VITE_TEAM_SERVER ?? (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'ws://localhost:8787' : '');

function hashParams(): URLSearchParams {
  const i = location.hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? location.hash.slice(i + 1) : '');
}
function fbText(x: number | null): string {
  if (x === null) return '–';
  if (x >= 10) return num(x, 1);
  if (x >= 0.1) return num(x, 2);
  if (x >= 0.001) return num(x, 4);
  return x.toExponential(1).replace('.', ',');
}

/** Zusammenfassung je Reaktion: Fortschritt und Ensemble mit dem größten Median. */
function byReaction(jobs: readonly JobView[]): { label: string; element: number; total: number; verified: number; single: number; best: JobView | null }[] {
  const map = new Map<string, { label: string; element: number; total: number; verified: number; single: number; best: JobView | null }>();
  for (const j of jobs) {
    const e = map.get(j.reactionId) ?? { label: j.label, element: j.element, total: 0, verified: 0, single: 0, best: null };
    e.total += j.members;
    e.verified += j.verified;
    e.single += j.single;
    if (j.median_fb !== null && (!e.best || j.median_fb > (e.best.median_fb ?? 0))) e.best = j;
    map.set(j.reactionId, e);
  }
  return [...map.values()];
}

export function TeamPage() {
  const params = useMemo(hashParams, []);
  const [server, setServer] = useState(params.get('server') ?? DEFAULT_SERVER);
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('elementjaeger.name') ?? '';
    } catch {
      return '';
    }
  });
  const [labCode, setLabCode] = useState(params.get('labor') ?? '');
  const [lab, setLab] = useState<LabView | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [status, setStatus] = useState<'getrennt' | 'verbindet' | 'verbunden'>('getrennt');
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [members, setMembers] = useState(200);
  const [eStar, setEStar] = useState(41);
  const [days, setDays] = useState(100);
  const socket = useRef<WebSocket | null>(null);
  const workers = useRef<Worker[]>([]);
  const waiting = useRef<((m: ServerMessage) => void)[]>([]);
  const active = useRef(false);

  const send = (m: ClientMessage) => socket.current?.readyState === WebSocket.OPEN && socket.current.send(JSON.stringify(m));

  const stopWorkers = () => {
    active.current = false;
    workers.current.forEach((w) => w.terminate());
    workers.current = [];
    waiting.current = [];
    setComputing(false);
  };

  const disconnect = () => {
    stopWorkers();
    socket.current?.close();
    socket.current = null;
    setLab(null);
    setStatus('getrennt');
  };
  useEffect(() => disconnect, []);

  const connect = (create: boolean) => {
    setError(null);
    if (!server) return setError('Bitte die Adresse eines Team-Servers eintragen.');
    try {
      localStorage.setItem('elementjaeger.name', name);
    } catch {
      // ohne Speicher geht es auch
    }
    setStatus('verbindet');
    let ws: WebSocket;
    try {
      ws = new WebSocket(server);
    } catch {
      setStatus('getrennt');
      return setError('Die Adresse des Servers ist ungültig.');
    }
    socket.current = ws;
    ws.onopen = () => {
      setStatus('verbunden');
      send(create ? { t: 'create', name } : { t: 'join', lab: labCode.trim(), name });
    };
    ws.onmessage = (event) => {
      const m = JSON.parse(String(event.data)) as ServerMessage;
      if (m.t === 'welcome') {
        setMe(m.you);
        setLab(m.state);
        setLabCode(m.state.id);
      } else if (m.t === 'state') {
        setLab(m.state);
      } else if (m.t === 'error') {
        setError(m.message);
      } else {
        waiting.current.shift()?.(m);
      }
    };
    ws.onclose = () => {
      stopWorkers();
      setStatus('getrennt');
    };
    ws.onerror = () => setError('Keine Verbindung zum Team-Server. Läuft er, und stimmt die Adresse?');
  };

  /** Ein Worker je CPU-Kern holt sich Pakete, rechnet und schickt das Ergebnis zurück. */
  const startWorkers = () => {
    active.current = true;
    setComputing(true);
    const count = Math.max(1, navigator.hardwareConcurrency || 2);
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL('../stage2/worker2.ts', import.meta.url), { type: 'module' });
      workers.current.push(worker);
      const loop = () => {
        if (!active.current) return;
        waiting.current.push((m) => {
          if (!active.current) return;
          if (m.t !== 'work') return void setTimeout(loop, 2000);
          const request: PacketRequest = { id: m.job * 100000 + m.packet, reaction: m.reaction, packet: m.spec };
          worker.onmessage = (event: MessageEvent<PacketResponse>) => {
            const r = event.data;
            if (r.ok) send({ t: 'result', job: m.job, packet: m.packet, values: Array.from(r.values), ms: r.ms });
            loop();
          };
          worker.postMessage(request);
        });
        send({ t: 'ready' });
      };
      loop();
    }
  };

  if (!lab) {
    return (
      <main class="model-page">
        <section class="panel">
          <h2>Zusammen rechnen</h2>
          <p class="lead">
            Ein Labor eröffnen, den Link teilen, gemeinsam rechnen. Jedes Rechenpaket geht an zwei verschiedene Spieler; nur wenn beide dasselbe
            Ergebnis liefern, zählt es. Die Team-Funktion ist freiwillig und braucht einen Team-Server; alles andere läuft ohne.
          </p>
          <div class="team-form">
            <label>
              Dein Name
              <input type="text" value={name} maxLength={24} onInput={(e) => setName(e.currentTarget.value)} placeholder="Gast" />
            </label>
            <label>
              Team-Server
              <input type="text" value={server} onInput={(e) => setServer(e.currentTarget.value)} placeholder="wss://…" />
            </label>
            <label>
              Labor-Kürzel (zum Beitreten)
              <input type="text" value={labCode} maxLength={12} onInput={(e) => setLabCode(e.currentTarget.value)} placeholder="z. B. k7m2pq" />
            </label>
          </div>
          <p class="team-actions">
            <button type="button" class="primary-inline" disabled={status === 'verbindet'} onClick={() => connect(true)}>Labor eröffnen</button>{' '}
            <button type="button" class="secondary" disabled={status === 'verbindet' || !labCode.trim()} onClick={() => connect(false)}>Labor beitreten</button>
          </p>
          {error && <p class="error" role="alert">{error}</p>}
          <p class="hint">
            Server starten: <span class="mono">npm run server</span> im Projekt (Port 8787). Auf GitHub Pages gibt es keinen Server; dort trägst du die
            Adresse eines eigenen Servers ein.
          </p>
        </section>
      </main>
    );
  }

  const link = `${location.origin}${location.pathname}#/team?labor=${lab.id}&server=${encodeURIComponent(server)}`;
  const campaign = lab.campaign;
  const reaction = getReaction(lab.series.reactionId);
  const q = reaction.qValue.value;
  const runs: StoredRun[] = lab.series.runs.map((r) => ({ id: r.id, seriesKey: 'team', width_MeV: 4, result: r.result }));
  const closed = lab.series.hidden && lab.series.revealed;
  const online = lab.players.filter((p) => p.online).length;

  return (
    <main class="model-page">
      <section class="panel">
        <div class="panel-head">
          <h2>Labor {lab.id}</h2>
          <button type="button" class="link" onClick={disconnect}>Labor verlassen</button>
        </div>
        <p>
          Beitrittslink: <a class="mono join-link" href={link}>{link}</a>{' '}
          <button type="button" class="link" onClick={() => void navigator.clipboard?.writeText(link)}>kopieren</button>
        </p>
        {error && <p class="error" role="alert">{error}</p>}
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">Spieler</th><th scope="col">verbunden</th><th scope="col" class="n">Ziehungen pro Sekunde</th><th scope="col" class="n">bestätigte Ziehungen</th><th scope="col" class="n">abgelehnte Pakete</th></tr>
            </thead>
            <tbody>
              {lab.players.map((p) => (
                <tr key={p.id} class={p.id === me ? 'is-selected' : ''}>
                  <td>{p.name}{p.id === me ? ' (du)' : ''}</td>
                  <td>{p.online ? 'ja' : 'nein'}</td>
                  <td class="n">{num(p.rate, 1)}</td>
                  <td class="n">{num(p.draws, 0)}</td>
                  <td class="n">{p.rejected}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row" colSpan={2}>Team</th><td class="n">{num(lab.teamRate, 1)}</td><td colSpan={2}></td></tr></tfoot>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>Kampagne: Stufe 2 gemeinsam rechnen</h2>
        <div class="team-form">
          <label>
            Ziehungen je Energie
            <input type="number" min={20} max={10000} step={10} value={members} onChange={(e) => setMembers(Number(e.currentTarget.value) || 200)} />
          </label>
        </div>
        <p class="team-actions">
          <button type="button" class="secondary" onClick={() => send({ t: 'campaign', kind: 'element120', members })}>Alle Reaktionen für Element 120</button>{' '}
          <button type="button" class="secondary" onClick={() => send({ t: 'campaign', kind: 'element119', members })}>Alle Reaktionen für Element 119</button>{' '}
          <button type="button" class="secondary" onClick={() => send({ t: 'campaign', kind: 'alle', members })}>Beide Elemente</button>
        </p>
        {!campaign ? (
          <p class="empty">Noch keine Kampagne. Jede Kampagne deckt 30 MeV Anregungsenergie in Schritten von 2 MeV ab.</p>
        ) : (
          <>
            <p class="team-actions">
              {computing ? (
                <button type="button" class="primary-inline" onClick={stopWorkers}>Rechnen anhalten</button>
              ) : (
                <button type="button" class="primary-inline" onClick={startWorkers}>Mitrechnen</button>
              )}
            </p>
            <div class="progress progress-big" role="progressbar" aria-valuemin={0} aria-valuemax={campaign.totalDraws} aria-valuenow={campaign.verifiedDraws} aria-label="Fortschritt der Kampagne">
              <span class="progress-single" style={{ width: `${(100 * (campaign.verifiedDraws + campaign.singleDraws)) / campaign.totalDraws}%` }}></span>
              <span style={{ width: `${(100 * campaign.verifiedDraws) / campaign.totalDraws}%` }}></span>
            </div>
            <p class="hint" role="status">
              {num(campaign.verifiedDraws, 0)} von {num(campaign.totalDraws, 0)} Ziehungen von zwei Spielern bestätigt, {num(campaign.singleDraws, 0)} erst
              einmal gerechnet. {online < 2 && 'Zum Bestätigen braucht es einen zweiten Spieler.'}
            </p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th scope="col">Reaktion</th><th scope="col" class="n">Element</th><th scope="col" class="n">bestätigt</th><th scope="col" class="n">größter Median (fb)</th><th scope="col" class="n">bei E* (MeV)</th><th scope="col" class="n">68-%-Band (fb)</th><th scope="col" class="n">Fehler des Medians</th></tr>
                </thead>
                <tbody>
                  {byReaction(campaign.jobs).map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td class="n">{r.element}</td>
                      <td class="n">{num((100 * r.verified) / r.total, 0)} %</td>
                      <td class="n"><strong>{fbText(r.best?.median_fb ?? null)}</strong></td>
                      <td class="n">{r.best ? num(r.best.eStar_MeV, 0) : '–'}</td>
                      <td class="n">{r.best ? `${fbText(r.best.low_fb)} … ${fbText(r.best.high_fb)}` : '–'}</td>
                      <td class="n">{r.best?.medianError_percent != null ? `± ${num(r.best.medianError_percent, 0)} %` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="hint">
              Der Fehler des Medians ist statistisch und schrumpft mit jedem bestätigten Paket. Das Band ist die Modellunsicherheit; sie schrumpft
              nicht. Das Modell ({lab.modelVersion}) hat die Prüfung an gemessenen Reaktionen nicht bestanden und rechnet dort meist zu tief.
            </p>
          </>
        )}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Gemeinsame Messreihe: Stufe 1, ⁵⁰Ti + ²⁴⁹Cf</h2>
          <span>
            <button type="button" class="link" onClick={() => send({ t: 'series', hidden: false })}>Neue Reihe</button>{' '}
            <button type="button" class="link" onClick={() => send({ t: 'series', hidden: true })}>Neue Reihe, verdeckte Natur</button>
            {lab.series.hidden && !lab.series.revealed && <> <button type="button" class="link" onClick={() => send({ t: 'reveal' })}>Auflösen</button></>}
          </span>
        </div>
        <p>
          Jeder misst bei einer anderen Energie; alle Punkte landen in einer Kurve. Der Server rechnet jede Messung selbst
          {lab.series.hidden ? ' und hält die verdeckte Natur geheim, bis das Team auflöst.' : '.'}
        </p>
        <div class="team-form">
          <label>
            Anregungsenergie E* (MeV)
            <input type="number" min={24} max={62} step={0.5} value={eStar} onChange={(e) => setEStar(Number(e.currentTarget.value) || 41)} />
          </label>
          <label>
            Strahlzeit (Tage)
            <input type="number" min={1} max={365} step={1} value={days} onChange={(e) => setDays(Number(e.currentTarget.value) || 100)} />
          </label>
        </div>
        <p class="team-actions">
          <button
            type="button"
            class="primary-inline"
            disabled={closed}
            onClick={() => {
              const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
              send({
                t: 'run',
                settings: {
                  reactionId: lab.series.reactionId,
                  eLab_MeV: eLabForExcitation(lab.series.reactionId, eStar),
                  beamPerSecond: DEFAULTS.beamPerSecond.value,
                  thickness_mg_cm2: DEFAULTS.targetThickness.value,
                  beamTime_s: Math.min(365, Math.max(1, days)) * 86400,
                  seed,
                },
              });
            }}
          >
            {closed ? 'Messreihe abgeschlossen' : 'Messen'}
          </button>
        </p>
        <Chart
          reactionId={lab.series.reactionId}
          mode={lab.series.hidden ? 'verdeckt' : 'offen'}
          revealed={lab.series.revealed}
          hiddenSeed={lab.series.hiddenSeed ?? 0}
          width_MeV={4}
          qValue_MeV={q}
          points={measuredPoints(runs)}
          currentEStar={eStar}
          onPickEnergy={(e) => setEStar(e)}
        />
        {lab.series.runs.length > 0 && (
          <div class="table-wrap">
            <table>
              <thead><tr><th scope="col">Nr.</th><th scope="col">Spieler</th><th scope="col" class="n">E* (MeV)</th><th scope="col" class="n">Tage</th><th scope="col" class="n">Ketten</th><th scope="col" class="n">Trefferquote (fb), 68 %</th><th scope="col" class="n">Seed</th></tr></thead>
              <tbody>
                {lab.series.runs.map((r, i) => {
                  const a = r.result.analysis;
                  return (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>{r.player}</td>
                      <td class="n">{num(excitationForELab(lab.series.reactionId, r.result.settings.eLab_MeV), 1)}</td>
                      <td class="n">{num(r.result.settings.beamTime_s / 86400, 0)}</td>
                      <td class="n">{a.chains}</td>
                      <td class="n">{a.upperLimit_fb !== null ? `< ${fbText(a.upperLimit_fb)}` : `${fbText(a.sigma_fb)} +${fbText(a.errHigh_fb)} −${fbText(a.errLow_fb)}`}</td>
                      <td class="n mono">{r.result.settings.seed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

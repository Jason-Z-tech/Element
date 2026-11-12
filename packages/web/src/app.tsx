import { CORE_VERSION, DEFAULT_PARAMETERS, eLabForExcitation, excitationForELab, stage2, STAGE1_MODEL_VERSION } from '@elementjaeger/core';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Assumptions } from './components/Assumptions';
import { Chart } from './components/Chart';
import { ControlPanel } from './components/ControlPanel';
import { HiddenGame } from './components/HiddenGame';
import { Protocol } from './components/Protocol';
import { MethodsPage } from './pages/MethodsPage';
import { ModelPage } from './pages/ModelPage';
import { ResultsPage } from './pages/ResultsPage';
import { TeamPage } from './pages/TeamPage';
import { RunsTable } from './components/RunsTable';
import { createRunner, type Runner } from './runner';
import {
  currentControls,
  currentQ,
  currentRuns,
  effectiveMode,
  hiddenAllowed,
  initialState,
  measuredPoints,
  parseState,
  seedForRun,
  seriesKey,
  STORAGE_KEY,
  totalDays,
  type AppState,
} from './state';

function randomSeed(): number {
  const buffer = new Uint32Array(1);
  try {
    crypto.getRandomValues(buffer);
    return buffer[0]!;
  } catch {
    return Math.floor(Math.random() * 4294967296);
  }
}

function loadState(): AppState {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  return parseState(stored) ?? initialState(randomSeed(), randomSeed());
}

function ExperimentPage() {
  const [state, setState] = useState<AppState>(loadState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runner = useRef<Runner | null>(null);
  if (!runner.current) runner.current = createRunner();

  // Zwischenstand im Browser speichern.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Speicher voll oder gesperrt: Das Spiel läuft weiter, nur ohne Zwischenstand.
    }
  }, [state]);

  const mode = effectiveMode(state);
  const controls = currentControls(state);
  const qValue = currentQ(state);
  const runs = useMemo(() => currentRuns(state), [state.runs, state.reactionId, state.mode, state.hiddenSeed]);
  const points = useMemo(() => measuredPoints(runs), [runs]);
  const selected = runs.find((r) => r.id === state.selectedRunId) ?? runs[runs.length - 1] ?? null;
  const selectedNumber = selected ? runs.indexOf(selected) + 1 : null;
  const eStar = excitationForELab(state.reactionId, controls.eLab_MeV, qValue);
  const seriesClosed = mode === 'verdeckt' && state.revealed;

  const patchControls = (patch: Partial<typeof controls>) =>
    setState((s) => ({ ...s, controls: { ...s.controls, [s.reactionId]: { ...currentControls(s), ...patch } } }));

  const startRun = async () => {
    if (busy || seriesClosed) return;
    setBusy(true);
    setError(null);
    const snapshot = state;
    const id = snapshot.nextRunId;
    try {
      const result = await runner.current!.run({
        settings: {
          reactionId: snapshot.reactionId,
          eLab_MeV: controls.eLab_MeV,
          beamPerSecond: controls.beamPerSecond,
          thickness_mg_cm2: controls.thickness_mg_cm2,
          beamTime_s: controls.days * 86400,
          qValue_MeV: qValue,
          fl282Decay: snapshot.params.fl282Decay,
          seed: seedForRun(snapshot),
        },
        nature: {
          reactionId: snapshot.reactionId,
          hiddenSeed: mode === 'verdeckt' ? snapshot.hiddenSeed : null,
          width_MeV: snapshot.params.excitationWidth_MeV,
        },
      });
      setState((s) => ({
        ...s,
        runs: [...s.runs, { id, seriesKey: seriesKey(snapshot), width_MeV: snapshot.params.excitationWidth_MeV, result }],
        nextRunId: Math.max(s.nextRunId, id + 1),
        selectedRunId: id,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <main class="layout">
        <div class="col col-controls">
          <ControlPanel
            reactionId={state.reactionId}
            mode={mode}
            hiddenAllowed={hiddenAllowed(state.reactionId)}
            controls={controls}
            qValue_MeV={qValue}
            width_MeV={state.params.excitationWidth_MeV}
            busy={busy}
            closed={seriesClosed}
            onReaction={(reactionId) => setState((s) => ({ ...s, reactionId, selectedRunId: null }))}
            onMode={(m) => setState((s) => ({ ...s, mode: m, selectedRunId: null }))}
            onControls={patchControls}
            onRun={startRun}
          />
          {error && (
            <p class="error" role="alert">
              Die Messung ist fehlgeschlagen: {error}
            </p>
          )}
          {mode === 'verdeckt' && (
            <HiddenGame
              reactionId={state.reactionId}
              hiddenSeed={state.hiddenSeed}
              width_MeV={state.params.excitationWidth_MeV}
              revealed={state.revealed}
              guess_eStar={state.guess_eStar}
              points={points}
              days={totalDays(runs)}
              onGuess={(guess_eStar) => setState((s) => ({ ...s, guess_eStar }))}
              onReveal={() => setState((s) => ({ ...s, revealed: true }))}
              onNewNature={() =>
                setState((s) => ({ ...s, hiddenSeed: randomSeed(), revealed: false, guess_eStar: null, selectedRunId: null }))
              }
            />
          )}
          <Assumptions
            params={state.params}
            onChange={(patch) => setState((s) => ({ ...s, params: { ...s.params, ...patch } }))}
            onReset={() => setState((s) => ({ ...s, params: DEFAULT_PARAMETERS }))}
          />
        </div>

        <div class="col col-results">
          <Chart
            reactionId={state.reactionId}
            mode={mode}
            revealed={state.revealed}
            hiddenSeed={state.hiddenSeed}
            width_MeV={state.params.excitationWidth_MeV}
            qValue_MeV={qValue}
            points={points}
            currentEStar={eStar}
            onPickEnergy={(e) =>
              patchControls({ eLab_MeV: Math.round(eLabForExcitation(state.reactionId, e, qValue) * 10) / 10 })
            }
          />
          <Protocol run={selected?.result ?? null} runNumber={selectedNumber} />
          <RunsTable
            runs={runs}
            selectedId={selected?.id ?? null}
            onSelect={(id) => setState((s) => ({ ...s, selectedRunId: id }))}
            onDelete={(id) => setState((s) => ({ ...s, runs: s.runs.filter((r) => r.id !== id) }))}
            onClear={() => {
              const key = seriesKey(state);
              setState((s) => ({ ...s, runs: s.runs.filter((r) => r.seriesKey !== key), selectedRunId: null }));
            }}
          />
        </div>
      </main>

    </>
  );
}

type Route = 'experiment' | 'modell' | 'ergebnisse' | 'methoden' | 'team';

function routeFromHash(): Route {
  const name = typeof location === 'undefined' ? '' : location.hash.replace(/^#\//, '').split('?')[0];
  return name === 'modell' || name === 'ergebnisse' || name === 'methoden' || name === 'team' ? name : 'experiment';
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  return (
    <div class="page">
      <header class="masthead">
        <div>
          <h1>Elementjäger</h1>
          <p class="tagline">Gemeinsam nach neuen Elementen rechnen</p>
        </div>
        <p class="notice" role="note">
          <strong>Das ist eine Simulation.</strong> Sie kann vorhersagen, wo man suchen sollte. Eine Entdeckung ist erst das im
          Beschleuniger gemessene Atom.
        </p>
      </header>
      <nav class="tabs" aria-label="Bereiche">
        {(
          [
            ['experiment', '#/', 'Experiment nachspielen'],
            ['modell', '#/modell', 'Wie gut ist das Modell?'],
            ['ergebnisse', '#/ergebnisse', 'Ergebnisse'],
            ['team', '#/team', 'Zusammen rechnen'],
            ['methoden', '#/methoden', 'Methoden'],
          ] as const
        ).map(([id, href, label]) => (
          <a key={id} href={href} class={route === id ? 'is-active' : ''} aria-current={route === id ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </nav>
      {route === 'modell' && <ModelPage />}
      {route === 'ergebnisse' && <ResultsPage />}
      {route === 'methoden' && <MethodsPage />}
      {route === 'team' && <TeamPage />}
      {route === 'experiment' && <ExperimentPage />}
      <footer class="footer">
        <p>
          Elementjäger, Kern {CORE_VERSION}, Modelle {STAGE1_MODEL_VERSION} und {stage2.STAGE2_MODEL_VERSION}. Open Source unter MIT-Lizenz.
          Alle Zahlen mit Quelle stehen in der README und unter docs/ im Projekt. Gerechnet wird in Web Workern.
        </p>
      </footer>
    </div>
  );
}

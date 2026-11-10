import type { ChainStep, DetectorEvent, RunResult } from '@elementjaeger/core';
import { duration, fb, num } from '../format';
import { Nuclide } from './Nuclide';

function Step({ step }: { step: ChainStep }) {
  const approx = step.estimated ? '≈ ' : '';
  if (step.type === 'sf') {
    return (
      <li class="chain-step is-fission">
        <Nuclide id={step.nuclide} />
        <span class="step-what">Spaltung</span>
        <span class="step-when">
          nach {approx}
          {duration(step.dt_s)}
        </span>
      </li>
    );
  }
  return (
    <li class={`chain-step ${step.fullEnergy ? 'is-alpha' : 'is-escaped'}`}>
      <Nuclide id={step.nuclide} />
      <span class="step-what">
        {step.fullEnergy
          ? step.energy_MeV === null
            ? 'α, Energie offen'
            : `α ${approx}${num(step.energy_MeV, 2)} MeV`
          : 'α entwischt'}
      </span>
      <span class="step-when">
        nach {approx}
        {duration(step.dt_s)}
      </span>
    </li>
  );
}

function verdictText(e: DetectorEvent): string {
  const v = e.verdict;
  if (v.identified) return 'Kette erkannt';
  if (v.fullAlphas === 0) return 'nicht erkannt: kein Alpha voll gemessen';
  return 'nicht erkannt: nur 1 Alpha, keine Spaltung im Zeitfenster';
}

function Event({ event }: { event: DetectorEvent }) {
  return (
    <li class={`event ${event.verdict.identified ? '' : 'is-rejected'}`}>
      <div class="event-head">
        <span class="event-time">Tag {num(event.time_s / 86400, 2)}</span>
        <span class="event-channel">{event.neutrons}n-Kanal</span>
        <span class={`badge ${event.verdict.identified ? 'badge-ok' : 'badge-muted'}`}>{verdictText(event)}</span>
      </div>
      <ol class="chain">
        {event.steps.map((s, i) => (
          <Step key={i} step={s} />
        ))}
        {event.endsAt && (
          <li class="chain-step is-end">
            <Nuclide id={event.endsAt} />
            <span class="step-what">langlebig, Kette endet</span>
          </li>
        )}
      </ol>
    </li>
  );
}

export function Protocol({ run, runNumber }: { run: RunResult | null; runNumber: number | null }) {
  if (!run) {
    return (
      <section class="panel" aria-labelledby="protokoll-titel">
        <h2 id="protokoll-titel">Detektor-Protokoll</h2>
        <p class="empty">Noch keine Messung. Stell die Energie ein und schalte den Strahl an.</p>
      </section>
    );
  }
  const a = run.analysis;
  const implanted = run.channels.reduce((s, c) => s + c.implanted, 0);
  return (
    <section class="panel" aria-labelledby="protokoll-titel">
      <h2 id="protokoll-titel">
        Detektor-Protokoll <span class="h2-sub">Messung {runNumber}</span>
      </h2>
      <p class="summary">
        {num(run.settings.beamTime_s / 86400, 1)} Tage bei E* = {num(run.eStar_MeV, 1)} MeV:{' '}
        <strong>
          {a.chains} {a.chains === 1 ? 'Kette' : 'Ketten'} erkannt
        </strong>
        {implanted !== a.chains && ` (${implanted} Kerne im Detektor)`}.{' '}
        {a.upperLimit_fb !== null ? (
          <>Obergrenze {fb(a.upperLimit_fb)} fb (1,84 Ereignisse, 68 %).</>
        ) : (
          <>
            Trefferquote {fb(a.sigma_fb)} <span class="err">+{fb(a.errHigh_fb)} −{fb(a.errLow_fb)}</span> fb (68 %).
          </>
        )}
      </p>
      {run.events.length === 0 ? (
        <p class="empty">Kein Kern im Detektor angekommen. Auch das ist ein Ergebnis: eine Obergrenze.</p>
      ) : (
        <ol class="events">
          {run.events.map((e, i) => (
            <Event key={i} event={e} />
          ))}
        </ol>
      )}
      {run.eventsTruncated && <p class="hint">Nur die ersten {run.events.length} Einträge werden gezeigt; gezählt wurde alles.</p>}
      {run.events.some((e) => e.steps.some((s) => s.estimated)) && (
        <p class="hint">≈ geschätzt oder vorhergesagt: Diese Kerne wurden noch nie gemessen.</p>
      )}
    </section>
  );
}

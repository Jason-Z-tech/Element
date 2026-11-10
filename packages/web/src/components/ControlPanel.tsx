import {
  bassBarrier,
  DEFAULTS,
  eCmFromLab,
  eLabForExcitation,
  excitationForELab,
  getReaction,
  sensitivityPerSecondPerFb,
  targetNucleiPerCm2,
  totalCrossSection_fb,
  publishedNature,
} from '@elementjaeger/core';
import { fb, num, sci } from '../format';
import { LIMITS, REACTION_IDS, type Controls, type Mode } from '../state';

interface Props {
  reactionId: string;
  mode: Mode;
  hiddenAllowed: boolean;
  controls: Controls;
  qValue_MeV: number;
  width_MeV: number;
  busy: boolean;
  /** Messreihe abgeschlossen (verdeckte Natur aufgelöst). */
  closed: boolean;
  onReaction(id: string): void;
  onMode(mode: Mode): void;
  onControls(patch: Partial<Controls>): void;
  onRun(): void;
}

const REACTION_NAMES: Record<string, { title: string; sub: string }> = {
  'Ti50+Cf249': { title: 'Element 120', sub: '⁵⁰Ti + ²⁴⁹Cf' },
  'Ti50+Pu244': { title: 'Element 116', sub: 'Testlauf: ⁵⁰Ti + ²⁴⁴Pu' },
};

function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

interface FieldProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
  onInput(value: number): void;
}

function Field({ id, label, unit, value, min, max, step, hint, onInput }: FieldProps) {
  const update = (raw: string) => {
    const v = Number(raw);
    if (Number.isFinite(v)) onInput(clamp(v, min, max));
  };
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <div class="field-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={(e) => update(e.currentTarget.value)}
        />
        <span class="field-number">
          <input
            type="number"
            aria-label={`${label} (${unit})`}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => update(e.currentTarget.value)}
          />
          <span class="unit">{unit}</span>
        </span>
      </div>
      {hint && <p class="hint">{hint}</p>}
    </div>
  );
}

export function ControlPanel(props: Props) {
  const { reactionId, controls, qValue_MeV } = props;
  const reaction = getReaction(reactionId);
  const { projectile, target } = reaction;
  const eCm = eCmFromLab(controls.eLab_MeV, projectile.a, target.a);
  const eStar = excitationForELab(reactionId, controls.eLab_MeV, qValue_MeV);
  const barrier = bassBarrier(projectile.z, projectile.a, target.z, target.a).height_MeV;
  const eLabMin = eLabForExcitation(reactionId, LIMITS.eStar.min, qValue_MeV);
  const eLabMax = eLabForExcitation(reactionId, LIMITS.eStar.max, qValue_MeV);
  const beamTime_s = controls.days * 86400;
  const sensitivity =
    sensitivityPerSecondPerFb({
      beamPerSecond: controls.beamPerSecond,
      thickness_mg_cm2: controls.thickness_mg_cm2,
      aTarget: target.a,
      separatorEfficiency: DEFAULTS.separatorEfficiency.value,
    }) * beamTime_s;
  const expected =
    props.mode === 'offen' ? totalCrossSection_fb(publishedNature(reaction, props.width_MeV), eStar) * sensitivity : null;

  return (
    <section class="panel" aria-labelledby="pult-titel">
      <h2 id="pult-titel">Steuerpult</h2>

      <div class="segmented" role="radiogroup" aria-label="Reaktion">
        {REACTION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === reactionId}
            class={id === reactionId ? 'is-active' : ''}
            onClick={() => props.onReaction(id)}
          >
            <strong>{REACTION_NAMES[id]!.title}</strong>
            <span>{REACTION_NAMES[id]!.sub}</span>
          </button>
        ))}
      </div>

      {props.hiddenAllowed && (
        <div class="segmented segmented-small" role="radiogroup" aria-label="Modus">
          <button
            type="button"
            role="radio"
            aria-checked={props.mode === 'offen'}
            class={props.mode === 'offen' ? 'is-active' : ''}
            onClick={() => props.onMode('offen')}
          >
            Vorhersage gilt
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={props.mode === 'verdeckt'}
            class={props.mode === 'verdeckt' ? 'is-active' : ''}
            onClick={() => props.onMode('verdeckt')}
          >
            Verdeckte Natur
          </button>
        </div>
      )}

      <Field
        id="eLab"
        label="Strahlenergie"
        unit="MeV"
        value={Number(controls.eLab_MeV.toFixed(1))}
        min={Number(eLabMin.toFixed(1))}
        max={Number(eLabMax.toFixed(1))}
        step={0.1}
        onInput={(v) => props.onControls({ eLab_MeV: v })}
      />
      <dl class="readout">
        <div>
          <dt>Schwerpunkt</dt>
          <dd>{num(eCm, 1)} MeV</dd>
        </div>
        <div>
          <dt>Anregung E*</dt>
          <dd>{num(eStar, 1)} MeV</dd>
        </div>
        <div>
          <dt>über Barriere</dt>
          <dd>
            {eCm - barrier >= 0 ? '+' : '−'}
            {num(Math.abs(eCm - barrier), 1)} MeV
          </dd>
        </div>
      </dl>

      <Field
        id="beam"
        label="Strahlstärke"
        unit="10¹² /s"
        value={controls.beamPerSecond / 1e12}
        min={LIMITS.beamPerSecond.min / 1e12}
        max={LIMITS.beamPerSecond.max / 1e12}
        step={LIMITS.beamPerSecond.step / 1e12}
        hint="Berkeley 2024: 6·10¹² Kerne pro Sekunde."
        onInput={(v) => props.onControls({ beamPerSecond: v * 1e12 })}
      />
      <Field
        id="target"
        label="Targetdicke"
        unit="mg/cm²"
        value={controls.thickness_mg_cm2}
        min={LIMITS.thickness_mg_cm2.min}
        max={LIMITS.thickness_mg_cm2.max}
        step={LIMITS.thickness_mg_cm2.step}
        hint={`${sci(targetNucleiPerCm2(controls.thickness_mg_cm2, target.a), 2)} Kerne/cm². Energieverlust im Target wird nicht gerechnet.`}
        onInput={(v) => props.onControls({ thickness_mg_cm2: v })}
      />
      <Field
        id="days"
        label="Strahlzeit"
        unit="Tage"
        value={controls.days}
        min={LIMITS.days.min}
        max={LIMITS.days.max}
        step={0.1}
        onInput={(v) => props.onControls({ days: Math.round(v * 10) / 10 })}
      />

      <dl class="readout readout-wide">
        <div>
          <dt>Empfindlichkeit</dt>
          <dd>1 Kern je {fb(1 / sensitivity)} fb</dd>
        </div>
        <div>
          <dt>{expected === null ? 'Erwartung' : reaction.basis === 'gemessen' ? 'Erwartung laut Messwert' : 'Erwartung laut Vorhersage'}</dt>
          <dd>{expected === null ? 'verdeckt' : `${num(expected, expected < 10 ? 2 : 1)} Kerne`}</dd>
        </div>
      </dl>

      <button type="button" class="primary" disabled={props.busy || props.closed} onClick={props.onRun}>
        {props.closed ? 'Messreihe abgeschlossen' : props.busy ? 'Messung läuft …' : 'Strahl an: Messung starten'}
      </button>
    </section>
  );
}

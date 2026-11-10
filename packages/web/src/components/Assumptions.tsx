import { ASSUMPTIONS, getReaction, type Stage1Parameters } from '@elementjaeger/core';
import { num } from '../format';
import { LIMITS } from '../state';

interface Props {
  params: Stage1Parameters;
  onChange(patch: Partial<Stage1Parameters>): void;
  onReset(): void;
}

export function Assumptions({ params, onChange, onReset }: Props) {
  const reaction = getReaction('Ti50+Cf249');
  const q0 = reaction.qValue.value;
  const dq = reaction.qUncertainty_MeV;
  const q = params.qValue_MeV ?? q0;
  const text = (id: keyof Stage1Parameters) => ASSUMPTIONS.find((a) => a.id === id)!;
  const isDefault = params.qValue_MeV === null && params.excitationWidth_MeV === 4 && params.fl282Decay === 'sf';

  return (
    <details class="panel assumptions">
      <summary>
        <h2>Annahmen</h2>
        <span class="summary-note">{isDefault ? 'Standardwerte' : 'geändert'}</span>
      </summary>
      <p class="hint">
        Drei Stellen sind nicht durch Messungen belegt. Die Standardwerte sind Festlegungen; hier lassen sie sich ändern, um zu sehen,
        wie stark das Ergebnis davon abhängt.
      </p>

      <div class="assumption">
        <h3>{text('qValue_MeV').title}</h3>
        <div class="field-row">
          <input
            type="range"
            aria-label="Q-Wert in MeV"
            min={q0 - dq}
            max={q0 + dq}
            step={0.1}
            value={q}
            onInput={(e) => onChange({ qValue_MeV: Number(e.currentTarget.value) })}
          />
          <span class="field-number">
            <input
              type="number"
              aria-label="Q-Wert (MeV)"
              min={q0 - dq}
              max={q0 + dq}
              step={0.1}
              value={q}
              onChange={(e) => {
                const v = Number(e.currentTarget.value);
                if (Number.isFinite(v)) onChange({ qValue_MeV: Math.min(q0 + dq, Math.max(q0 - dq, v)) });
              }}
            />
            <span class="unit">MeV</span>
          </span>
        </div>
        <p class="hint">{text('qValue_MeV').text}</p>
      </div>

      <div class="assumption">
        <h3>{text('excitationWidth_MeV').title}</h3>
        <div class="field-row">
          <input
            type="range"
            aria-label="Breite der Gauß-Kurve in MeV"
            min={LIMITS.width_MeV.min}
            max={LIMITS.width_MeV.max}
            step={LIMITS.width_MeV.step}
            value={params.excitationWidth_MeV}
            onInput={(e) => onChange({ excitationWidth_MeV: Number(e.currentTarget.value) })}
          />
          <span class="field-number">
            <output>{num(params.excitationWidth_MeV, 1)}</output>
            <span class="unit">MeV</span>
          </span>
        </div>
        <p class="hint">{text('excitationWidth_MeV').text}</p>
      </div>

      <div class="assumption">
        <h3>{text('fl282Decay').title}</h3>
        <div class="segmented segmented-small" role="radiogroup" aria-label="Zerfall von 282Fl">
          <button
            type="button"
            role="radio"
            aria-checked={params.fl282Decay === 'sf'}
            class={params.fl282Decay === 'sf' ? 'is-active' : ''}
            onClick={() => onChange({ fl282Decay: 'sf' })}
          >
            Spontanspaltung
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={params.fl282Decay === 'alpha'}
            class={params.fl282Decay === 'alpha' ? 'is-active' : ''}
            onClick={() => onChange({ fl282Decay: 'alpha' })}
          >
            Alpha-Zerfall
          </button>
        </div>
        <p class="hint">{text('fl282Decay').text}</p>
      </div>

      {!isDefault && (
        <button type="button" class="link" onClick={onReset}>
          Standardwerte wiederherstellen
        </button>
      )}
    </details>
  );
}

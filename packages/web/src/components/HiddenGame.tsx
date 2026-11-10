import { findMaximum, getReaction, hiddenNature } from '@elementjaeger/core';
import { fb, num } from '../format';
import { LIMITS, type MeasuredPoint } from '../state';

interface Props {
  reactionId: string;
  hiddenSeed: number;
  width_MeV: number;
  revealed: boolean;
  guess_eStar: number | null;
  points: readonly MeasuredPoint[];
  days: number;
  onGuess(eStar: number | null): void;
  onReveal(): void;
  onNewNature(): void;
}

export function HiddenGame(props: Props) {
  const { revealed, guess_eStar, points, days } = props;
  const best = points
    .filter((p) => p.analysis.upperLimit_fb === null)
    .reduce<MeasuredPoint | null>((b, p) => (!b || p.analysis.sigma_fb > b.analysis.sigma_fb ? p : b), null);

  if (!revealed) {
    return (
      <section class="panel hidden-game" aria-labelledby="natur-titel">
        <h2 id="natur-titel">Verdeckte Natur</h2>
        <p>
          Niemand weiß, wie gut die Vorhersage ist. Hier ist das wahre Maximum zufällig zwischen 6 und 80 fb gewählt und die beste
          Energie um bis zu 5 MeV verschoben. Finde sie mit Messreihen, mit möglichst wenig Strahlzeit.
        </p>
        <div class="field">
          <label for="tipp">Dein Tipp: beste Anregungsenergie E*</label>
          <div class="field-row">
            <span class="field-number">
              <input
                id="tipp"
                type="number"
                min={LIMITS.eStar.min}
                max={LIMITS.eStar.max}
                step={0.5}
                value={guess_eStar ?? ''}
                placeholder={best ? num(best.eStar_MeV, 1) : '41'}
                onChange={(e) => {
                  const v = Number(e.currentTarget.value);
                  props.onGuess(e.currentTarget.value === '' || !Number.isFinite(v) ? null : v);
                }}
              />
              <span class="unit">MeV</span>
            </span>
            <button type="button" class="secondary" disabled={points.length === 0} onClick={props.onReveal}>
              Auflösen
            </button>
          </div>
        </div>
        <p class="hint">Bisher {num(days, 1)} Tage Strahlzeit. Nach dem Auflösen ist diese Messreihe abgeschlossen.</p>
      </section>
    );
  }

  const truth = findMaximum(hiddenNature(getReaction(props.reactionId), props.hiddenSeed, props.width_MeV));
  const tip = guess_eStar ?? best?.eStar_MeV ?? null;
  return (
    <section class="panel hidden-game" aria-labelledby="natur-titel">
      <h2 id="natur-titel">Verdeckte Natur: aufgelöst</h2>
      <dl class="readout readout-wide">
        <div>
          <dt>wahres Maximum</dt>
          <dd>
            {fb(truth.sigma_fb)} fb bei E* {num(truth.eStar_MeV, 1)} MeV
          </dd>
        </div>
        <div>
          <dt>{guess_eStar !== null ? 'dein Tipp' : 'dein höchster Messpunkt'}</dt>
          <dd>
            {tip === null ? 'keiner' : `E* ${num(tip, 1)} MeV, ${num(Math.abs(tip - truth.eStar_MeV), 1)} MeV daneben`}
          </dd>
        </div>
        <div>
          <dt>verbrauchte Strahlzeit</dt>
          <dd>{num(days, 1)} Tage</dd>
        </div>
      </dl>
      <button type="button" class="secondary" onClick={props.onNewNature}>
        Neue verdeckte Natur
      </button>
    </section>
  );
}

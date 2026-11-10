import {
  bassBarrier,
  channelCrossSection_fb,
  eLabForExcitation,
  findMaximum,
  getReaction,
  hiddenNature,
  publishedNature,
  totalCrossSection_fb,
} from '@elementjaeger/core';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { curvePath, decadeTicks, makeScales, yDomain } from '../chartMath';
import { fb, num } from '../format';
import { LIMITS, type MeasuredPoint, type Mode } from '../state';

interface Props {
  reactionId: string;
  mode: Mode;
  revealed: boolean;
  hiddenSeed: number;
  width_MeV: number;
  qValue_MeV: number;
  points: readonly MeasuredPoint[];
  currentEStar: number;
  onPickEnergy(eStar: number): void;
}

/** Zeichenfläche in Pixeln: Die Schrift bleibt bei jeder Breite gleich groß. */
function layout(width: number) {
  const W = Math.round(Math.min(Math.max(width, 280), 1100));
  const H = W < 520 ? 300 : 400;
  return { W, H, BOX: { left: 50, right: W - 14, top: 30, bottom: H - 50 } };
}

/** Berkeley-Messpunkt als Bezug im Testlauf (Gates et al. 2024). */
const BERKELEY_POINT = { eStar: 41, sigma: 440, errHigh: 580, errLow: 280 };

interface Hover {
  eStar: number;
  point: MeasuredPoint | null;
}

export function Chart(props: Props) {
  const { reactionId, mode, revealed, points, width_MeV, qValue_MeV } = props;
  const reaction = getReaction(reactionId);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { W, H, BOX } = useMemo(() => layout(width), [width]);

  const published = useMemo(() => publishedNature(reaction, width_MeV), [reaction, width_MeV]);
  const truth = useMemo(
    () => (mode === 'verdeckt' && revealed ? hiddenNature(reaction, props.hiddenSeed, width_MeV) : null),
    [mode, revealed, reaction, props.hiddenSeed, width_MeV],
  );
  const isTest = reaction.basis === 'gemessen';

  const scales = useMemo(() => {
    const values: number[] = [findMaximum(published).sigma_fb];
    if (truth) values.push(findMaximum(truth).sigma_fb);
    if (isTest) values.push(BERKELEY_POINT.sigma + BERKELEY_POINT.errHigh, BERKELEY_POINT.sigma - BERKELEY_POINT.errLow);
    for (const p of points) {
      const a = p.analysis;
      if (a.upperLimit_fb !== null) values.push(a.upperLimit_fb);
      else values.push(a.sigma_fb + a.errHigh_fb, a.sigma_fb - a.errLow_fb);
    }
    const { yMin, yMax } = yDomain(values, isTest ? 10 : 1);
    return makeScales(BOX, LIMITS.eStar.min, LIMITS.eStar.max, yMin, yMax);
  }, [published, truth, points, isTest, BOX]);

  const barrier = bassBarrier(reaction.projectile.z, reaction.projectile.a, reaction.target.z, reaction.target.a).height_MeV;
  const barrierEStar = barrier + qValue_MeV;
  const xTicks: number[] = [];
  for (let e = W < 520 ? 30 : 25; e <= LIMITS.eStar.max; e += W < 520 ? 10 : 5) xTicks.push(e);
  const yTicks = decadeTicks(scales.yMin, scales.yMax);

  const nearestPoint = (eStar: number): MeasuredPoint | null => {
    let best: MeasuredPoint | null = null;
    for (const p of points) {
      if (Math.abs(p.eStar_MeV - eStar) <= 0.75 && (!best || Math.abs(p.eStar_MeV - eStar) < Math.abs(best.eStar_MeV - eStar))) {
        best = p;
      }
    }
    return best;
  };

  const eStarFromEvent = (event: PointerEvent | MouseEvent): number | null => {
    const svg = wrapRef.current?.querySelector('svg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    if (px < BOX.left || px > BOX.right) return null;
    return scales.xInverse(px);
  };

  const onMove = (event: PointerEvent) => {
    const raw = eStarFromEvent(event);
    if (raw === null) return setHover(null);
    const point = nearestPoint(raw);
    setHover({ eStar: point ? point.eStar_MeV : Math.round(raw * 2) / 2, point });
  };

  const onClick = (event: MouseEvent) => {
    const raw = eStarFromEvent(event);
    if (raw === null) return;
    const point = nearestPoint(raw);
    props.onPickEnergy(point ? point.eStar_MeV : Math.round(raw * 2) / 2);
  };

  const curveLabel = isTest
    ? 'Berkeley-Messwert, Gauß-Form angenommen'
    : mode === 'verdeckt'
      ? 'veröffentlichte Vorhersage (Summe)'
      : 'Vorhersage (Summe 3n + 4n + 5n)';

  const truthMax = truth ? findMaximum(truth) : null;
  const tooltipLeft = hover ? (scales.x(hover.eStar) / W) * 100 : 0;
  const tooltipFlip = hover ? scales.x(hover.eStar) > (BOX.left + BOX.right) / 2 : false;

  return (
    <section class="panel chart-panel" aria-labelledby="kurve-titel">
      <h2 id="kurve-titel">Trefferquote gegen Energie</h2>
      <ul class="legend" aria-label="Legende">
        <li>
          <span class="key key-line key-s1"></span>
          {curveLabel}
        </li>
        <li>
          <span class="key key-dot key-s2"></span>
          eigene Messung, Fehlerbalken 68 %
        </li>
        <li>
          <span class="key key-limit key-s2"></span>
          Obergrenze bei 0 Ketten
        </li>
        {truth && (
          <li>
            <span class="key key-line key-s3"></span>
            wahre Natur
          </li>
        )}
        {isTest && (
          <li>
            <span class="key key-ring"></span>
            Berkeley 2024
          </li>
        )}
      </ul>
      <div class="chart-wrap" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Trefferquote in Femtobarn gegen die Anregungsenergie. Die Messwerte stehen auch in der Tabelle der Messreihen."
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onClick={onClick}
        >
          {/* Gitter und Achsen */}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line class="grid" x1={BOX.left} x2={BOX.right} y1={scales.y(t)} y2={scales.y(t)} />
              <text class="tick" x={BOX.left - 8} y={scales.y(t)} text-anchor="end" dominant-baseline="middle">
                {num(t, 0)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line class="axis" x1={scales.x(t)} x2={scales.x(t)} y1={BOX.bottom} y2={BOX.bottom + 5} />
              <text class="tick" x={scales.x(t)} y={BOX.bottom + 19} text-anchor="middle">
                {t}
              </text>
            </g>
          ))}
          <line class="axis" x1={BOX.left} x2={BOX.right} y1={BOX.bottom} y2={BOX.bottom} />
          <text class="axis-title" x={(BOX.left + BOX.right) / 2} y={H - 8} text-anchor="middle">
            Anregungsenergie E* (MeV)
          </text>
          <text class="axis-title" x={4} y={14} text-anchor="start">
            Trefferquote (fb)
          </text>

          {/* Bass-Barriere */}
          {barrierEStar > scales.xMin && barrierEStar < scales.xMax && (
            <g>
              <line class="annot" x1={scales.x(barrierEStar)} x2={scales.x(barrierEStar)} y1={BOX.top} y2={BOX.bottom} />
              <text
                class="annot-label"
                text-anchor="end"
                transform={`translate(${scales.x(barrierEStar) - 5} ${BOX.top + 4}) rotate(-90)`}
              >
                Bass-Barriere
              </text>
            </g>
          )}

          {/* Kanäle (zurückgenommen) und Summe */}
          {published.channels.length > 1 &&
            published.channels.map((ch) => (
              <g key={ch.neutrons}>
                <path class="curve-channel" d={curvePath(scales, (e) => channelCrossSection_fb(ch, e))} />
                {ch.sigmaMax_fb >= scales.yMin && (
                  <text class="direct-label" x={scales.x(ch.eStarPeak_MeV) + 14} y={scales.y(ch.sigmaMax_fb) + 26} text-anchor="middle">
                    {ch.neutrons}n
                  </text>
                )}
              </g>
            ))}
          <path class="curve curve-s1" d={curvePath(scales, (e) => totalCrossSection_fb(published, e))} />

          {/* aufgelöste wahre Natur */}
          {truth && truthMax && (
            <g>
              <path class="curve curve-s3" d={curvePath(scales, (e) => totalCrossSection_fb(truth, e))} />
              <text class="direct-label direct-label-strong" x={scales.x(truthMax.eStar_MeV)} y={scales.y(truthMax.sigma_fb) - 8} text-anchor="middle">
                wahre Natur
              </text>
            </g>
          )}

          {/* Berkeley-Bezugspunkt */}
          {isTest && (
            <g class="reference">
              <line
                x1={scales.x(BERKELEY_POINT.eStar)}
                x2={scales.x(BERKELEY_POINT.eStar)}
                y1={scales.y(BERKELEY_POINT.sigma + BERKELEY_POINT.errHigh)}
                y2={scales.y(BERKELEY_POINT.sigma - BERKELEY_POINT.errLow)}
              />
              <circle cx={scales.x(BERKELEY_POINT.eStar)} cy={scales.y(BERKELEY_POINT.sigma)} r="5" />
            </g>
          )}

          {/* eingestellte Energie */}
          {props.currentEStar >= scales.xMin && props.currentEStar <= scales.xMax && (
            <g class="setting">
              <line x1={scales.x(props.currentEStar)} x2={scales.x(props.currentEStar)} y1={BOX.top} y2={BOX.bottom} />
              <path d={`M${scales.x(props.currentEStar) - 6} ${BOX.bottom + 1}h12l-6 -9z`} />
            </g>
          )}

          {/* Fadenkreuz */}
          {hover && <line class="crosshair" x1={scales.x(hover.eStar)} x2={scales.x(hover.eStar)} y1={BOX.top} y2={BOX.bottom} />}

          {/* eigene Messpunkte */}
          {points.map((p) => {
            const a = p.analysis;
            const x = scales.x(p.eStar_MeV);
            const active = hover?.point?.key === p.key;
            const label =
              a.upperLimit_fb !== null
                ? `E* ${num(p.eStar_MeV, 1)} MeV: keine Kette, Obergrenze ${fb(a.upperLimit_fb)} fb`
                : `E* ${num(p.eStar_MeV, 1)} MeV: ${a.chains} Ketten, ${fb(a.sigma_fb)} plus ${fb(a.errHigh_fb)} minus ${fb(a.errLow_fb)} fb`;
            if (a.upperLimit_fb !== null) {
              const y = scales.y(a.upperLimit_fb);
              return (
                <g
                  key={p.key}
                  class={`point point-limit ${active ? 'is-active' : ''}`}
                  tabIndex={0}
                  role="img"
                  aria-label={label}
                  onFocus={() => setHover({ eStar: p.eStar_MeV, point: p })}
                  onBlur={() => setHover(null)}
                >
                  <rect class="hit" x={x - 12} y={y - 12} width="24" height="44" />
                  <line class="mark" x1={x - 7} x2={x + 7} y1={y} y2={y} />
                  <line class="mark" x1={x} x2={x} y1={y} y2={y + 20} />
                  <path class="mark-fill" d={`M${x - 5} ${y + 17}h10l-5 9z`} />
                </g>
              );
            }
            const y = scales.y(a.sigma_fb);
            const yHi = scales.y(a.sigma_fb + a.errHigh_fb);
            const yLo = scales.y(Math.max(a.sigma_fb - a.errLow_fb, scales.yMin));
            return (
              <g
                key={p.key}
                class={`point ${active ? 'is-active' : ''}`}
                tabIndex={0}
                role="img"
                aria-label={label}
                onFocus={() => setHover({ eStar: p.eStar_MeV, point: p })}
                onBlur={() => setHover(null)}
              >
                <rect class="hit" x={x - 12} y={Math.min(yHi, y - 12)} width="24" height={Math.max(yLo, y + 12) - Math.min(yHi, y - 12)} />
                <line class="mark" x1={x} x2={x} y1={yHi} y2={yLo} />
                <line class="mark" x1={x - 4} x2={x + 4} y1={yHi} y2={yHi} />
                <line class="mark" x1={x - 4} x2={x + 4} y1={yLo} y2={yLo} />
                <circle class="dot" cx={x} cy={y} r="5" />
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            class={`tooltip ${tooltipFlip ? 'is-flipped' : ''}`}
            style={{ left: `${tooltipLeft}%` }}
            role="status"
          >
            <div class="tooltip-head">
              E* {num(hover.eStar, 1)} MeV
              <span> · Strahl {num(eLabForExcitation(reactionId, hover.eStar, qValue_MeV), 1)} MeV</span>
            </div>
            {hover.point && (
              <div class="tooltip-row">
                <span class="key key-dot key-s2"></span>
                <strong>
                  {hover.point.analysis.upperLimit_fb !== null
                    ? `< ${fb(hover.point.analysis.upperLimit_fb)} fb`
                    : `${fb(hover.point.analysis.sigma_fb)} +${fb(hover.point.analysis.errHigh_fb)} −${fb(hover.point.analysis.errLow_fb)} fb`}
                </strong>
                <span>
                  {hover.point.analysis.chains} {hover.point.analysis.chains === 1 ? 'Kette' : 'Ketten'} in {num(hover.point.days, 1)} Tagen
                </span>
              </div>
            )}
            <div class="tooltip-row">
              <span class="key key-line key-s1"></span>
              <strong>{fb(totalCrossSection_fb(published, hover.eStar))} fb</strong>
              <span>{isTest ? 'Annahme' : 'Vorhersage'}</span>
            </div>
            {published.channels.length > 1 &&
              published.channels.map((ch) => (
                <div class="tooltip-row tooltip-sub" key={ch.neutrons}>
                  <span class="key key-line key-channel"></span>
                  <strong>{fb(channelCrossSection_fb(ch, hover.eStar))} fb</strong>
                  <span>{ch.neutrons}n</span>
                </div>
              ))}
            {truth && (
              <div class="tooltip-row">
                <span class="key key-line key-s3"></span>
                <strong>{fb(totalCrossSection_fb(truth, hover.eStar))} fb</strong>
                <span>wahre Natur</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p class="hint">
        {mode === 'verdeckt' && !revealed
          ? 'Die wahre Kurve ist verdeckt: Sie kann höher, tiefer und bei anderer Energie liegen als die Vorhersage. '
          : ''}
        Klick in die Kurve stellt die Energie ein. Die y-Achse ist logarithmisch.
      </p>
    </section>
  );
}

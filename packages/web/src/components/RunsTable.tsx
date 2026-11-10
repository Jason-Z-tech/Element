import { fb, num } from '../format';
import type { StoredRun } from '../state';

interface Props {
  runs: readonly StoredRun[];
  selectedId: number | null;
  onSelect(id: number): void;
  onDelete(id: number): void;
  onClear(): void;
}

export function RunsTable({ runs, selectedId, onSelect, onDelete, onClear }: Props) {
  const days = runs.reduce((s, r) => s + r.result.settings.beamTime_s / 86400, 0);
  const chains = runs.reduce((s, r) => s + r.result.analysis.chains, 0);
  return (
    <section class="panel" aria-labelledby="reihen-titel">
      <div class="panel-head">
        <h2 id="reihen-titel">Messreihen</h2>
        {runs.length > 0 && (
          <button type="button" class="link" onClick={onClear}>
            Messreihe leeren
          </button>
        )}
      </div>
      {runs.length === 0 ? (
        <p class="empty">Hier sammelt sich jede Messung mit Seed und Fehlerbalken.</p>
      ) : (
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Nr.</th>
                <th scope="col" class="n">E_lab (MeV)</th>
                <th scope="col" class="n">E* (MeV)</th>
                <th scope="col" class="n">Tage</th>
                <th scope="col" class="n">Strahl (10¹²/s)</th>
                <th scope="col" class="n">Target (mg/cm²)</th>
                <th scope="col" class="n">Ketten</th>
                <th scope="col" class="n">Trefferquote (fb), 68 %</th>
                <th scope="col" class="n">Seed</th>
                <th scope="col">
                  <span class="sr-only">Aktion</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => {
                const r = run.result;
                const a = r.analysis;
                return (
                  <tr key={run.id} class={run.id === selectedId ? 'is-selected' : ''}>
                    <td>
                      <button type="button" class="link" onClick={() => onSelect(run.id)} aria-label={`Messung ${i + 1} im Protokoll zeigen`}>
                        {i + 1}
                      </button>
                    </td>
                    <td class="n">{num(r.settings.eLab_MeV, 1)}</td>
                    <td class="n">{num(r.eStar_MeV, 1)}</td>
                    <td class="n">{num(r.settings.beamTime_s / 86400, 1)}</td>
                    <td class="n">{num(r.settings.beamPerSecond / 1e12, 0)}</td>
                    <td class="n">{num(r.settings.thickness_mg_cm2, 2)}</td>
                    <td class="n">{a.chains}</td>
                    <td class="n">
                      {a.upperLimit_fb !== null ? (
                        <>&lt; {fb(a.upperLimit_fb)}</>
                      ) : (
                        <>
                          {fb(a.sigma_fb)} <span class="err">+{fb(a.errHigh_fb)} −{fb(a.errLow_fb)}</span>
                        </>
                      )}
                    </td>
                    <td class="n mono">{r.settings.seed}</td>
                    <td>
                      <button type="button" class="icon" onClick={() => onDelete(run.id)} aria-label={`Messung ${i + 1} löschen`}>
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>
                  Summe
                </th>
                <td class="n">{num(days, 1)}</td>
                <td colSpan={2}></td>
                <td class="n">{chains}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {runs.length > 0 && (
        <p class="hint">
          Modell {runs[0]!.result.modelVersion}, Kern {runs[0]!.result.coreVersion}. Gleicher Seed und gleiche Einstellungen ergeben
          dieselbe Messung.
        </p>
      )}
    </section>
  );
}

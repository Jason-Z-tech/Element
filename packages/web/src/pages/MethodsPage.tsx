import { ASSUMPTIONS, BERKELEY_CALIBRATION, DEFAULTS, qValuesFromMassTables, SOURCES, stage2, STAGE1_MODEL_VERSION } from '@elementjaeger/core';
import { num } from '../format';

const DEVIATIONS: [string, string, string][] = [
  ['Langevin-Bahnen als teurer Hauptteil, rund 10⁸ Bahnen je Energie', 'Bahnen nur als Kontrolle der Formel; Rechenleistung in Unsicherheits-Ensembles', 'Im veröffentlichten Modell ist die Verschmelzungs-Wahrscheinlichkeit eine geschlossene Formel. Für mehr Freiheitsgrade fehlen belegte Parameter. Keine künstliche Rechenlast.'],
  ['Barrierenverteilung um die Bass-Barriere', 'Barrierenverteilung aus der Form des Targetkerns (Integral über den Winkel)', 'So bei Hagino (2018); braucht keine angepasste Breite.'],
  ['Jeden Schritt per Monte Carlo', 'Winkel und Drehimpuls werden exakt summiert; gewürfelt werden nur die Neutronenenergien', 'Genauer und schneller als Würfeln.'],
  ['Q-Wert ⁵⁰Ti + ²⁴⁹Cf: −197,7 MeV', 'Stufe 2 rechnet mit −198,58 MeV', 'Q-Wert, Neutronen-Bindungsenergien und Spaltbarrieren müssen aus derselben Massentabelle stammen. Stufe 1 bleibt bei −197,7 MeV.'],
  ['Eichung an einem Teil von drei genannten Reaktionen', 'Eichung an 48 Messpunkten mit ⁴⁸Ca auf fünf Targets; die drei genannten Reaktionen sind Prüf-Reaktionen', 'Schwereres Projektil und schwerstes Target bleiben für die Prüfung.'],
  ['Team-Rechenleistung macht die Vorhersage schneller', 'Eine volle Vorhersage braucht rund 20 Minuten auf einem Kern; das Team prüft vor allem gegenseitig', 'Ehrliche Rechenzeit; siehe Rechenzeit unten.'],
];

const ADAPTATIONS: string[] = [
  'Einfang mit dem Bass-Potential von 1977 und winkelabhängigem Targetradius R_T(θ) = R_T·(1 + Σ β_λ Y_λ0(θ)). Nicht in dieser Form veröffentlicht. Für ⁴⁸Ca + ²⁴⁸Cm liegen die Barrieren 2 bis 4 MeV unter Haginos Potential.',
  'Das Projektil wird als Kugel behandelt.',
  'Winkelabhängiger Einschuss-Abstand mit R_T = 1,2·A^(1/3) fm; so passt Haginos Abb. 3(b).',
  'Sattelenergie aus der Massentabelle (Grundzustandsenergie plus Spaltbarriere), wie bei Siwek-Wilczyńska et al. (2012); Hagino nimmt die algebraische Formel.',
  'Die makroskopische Energie am Einschuss-Punkt wird auf den Grundzustand bezogen, bevor die Temperatur gerechnet wird.',
  'Der Einschuss-Abstand wird nie negativ (Cap et al. 2022).',
  'Die Kaskade endet, wenn weder Neutron noch Spaltung möglich ist, jeweils mit Paar- und Rotationsenergie gerechnet.',
  'Neutronenenergien werden aus der Niveaudichte gewürfelt; Cap et al. nehmen die Maxwell-Näherung dieses Spektrums.',
  'Schalenkorrektur am Sattel aus der Tabelle, am Einschuss-Punkt null.',
  'Über den angegebenen Energiebereich einer Messung (Energieverlust im Target) wird mit fünf Energien gemittelt.',
  'Deformationen der Targetkerne aus FRDM(2012); gemessene Werte liegen etwas höher.',
  'Im Ensemble wird die Eichung nicht für jede Ziehung wiederholt; die Ziehungen der Spaltbarrieren sind zwischen Kernen unabhängig.',
  'Druckfehler korrigiert: Hagino druckt in Gl. A10 den Koeffizienten 1,137825; richtig ist 1,37825. Belegt durch seine Abb. 3(c), eine Abbildung der Warschauer Gruppe und den Koeffizientensatz von 2003.',
];

const STAGE1_ASSUMPTIONS: string[] = [
  'Die geschätzten Zeiten werden wie die gemessenen als Halbwertszeiten gelesen.',
  'Für ⁵⁰Ti + ²⁴⁴Pu ist nur ein Punkt gemessen; dass er das Maximum ist, ist eine Annahme.',
  'Geschätzte und vorhergesagte Kerne zerfallen nur per Alpha.',
  'Eine Spaltung wird immer nachgewiesen. Das 1-s-Fenster zählt ab dem Einschlag.',
  'Kein Untergrund, keine Totzeit, kein Energieverlust und keine Energiebreite im Target.',
  'Die Zuordnung Kette zu Kanal ist bekannt.',
  'Verdeckte Natur: Maximum logarithmisch gleichverteilt zwischen 6 und 80 fb, Verschiebung gleichverteilt bis ±5 MeV.',
  '90 % voll gemessene Alphas sind ein Eichwert: Damit ergibt die Zählregel den veröffentlichten Ketten-Nachweis von 95 %.',
];

export function MethodsPage() {
  const u = stage2.UNCERTAINTIES;
  const p = stage2.STAGE2_PARAMETERS;
  const c = stage2.CALIBRATION_SUMMARY;
  return (
    <main class="model-page methods">
      <section class="panel">
        <h2>Methoden</h2>
        <p class="lead">
          Hier steht, was gerechnet wird, mit welchen Zahlen und woher sie stammen. Jede Zahl ist ein Messwert mit Quelle, eine veröffentlichte
          Vorhersage mit Quelle oder als Annahme markiert. Die ausführliche Fassung mit allen Fundstellen liegt im Projekt unter{' '}
          <span class="mono">docs/modell-stufe2.md</span> und in der README.
        </p>
      </section>

      <section class="panel">
        <h2>Stufe 1: Das Experiment nachspielen (Modell {STAGE1_MODEL_VERSION})</h2>
        <ul class="formulas">
          <li><strong>Energie:</strong> <span class="mono">E_cm = E_lab · A_Target / (A_Projektil + A_Target)</span>, <span class="mono">E* = E_cm + Q</span>.</li>
          <li><strong>Bass-Barriere:</strong> Maximum von <span class="mono">V(r) = Z₁Z₂e²/r − R₁R₂/(R₁+R₂) · g(r − R₁ − R₂)</span> mit <span class="mono">g(s) = 1/(0,0300·e^(s/3,30 fm) + 0,0061·e^(s/0,65 fm))</span> MeV/fm und <span class="mono">R = 1,16·A^(1/3) − 1,39·A^(−1/3)</span> fm (Bass 1977). Ergebnis: 226,2 MeV für ⁵⁰Ti + ²⁴⁹Cf, 217,2 MeV für ⁵⁰Ti + ²⁴⁴Pu.</li>
          <li><strong>Trefferquote:</strong> je Kanal eine Gauß-Kurve über E*. Maxima für Element 120 aus Zhang, Zhang, Chen (arXiv:2604.09287): 12,87 / 48,20 / 9,90 fb bei 34 / 41 / 52 MeV. Für Element 116 der Messwert 440 fb bei 41 MeV (Gates et al., arXiv:2407.16079).</li>
          <li><strong>Rate:</strong> <span class="mono">σ · Targetkerne/cm² · Strahlkerne/s · {num(BERKELEY_CALIBRATION.value, 3)} · Separator</span>. Standard: {num(DEFAULTS.beamPerSecond.value / 1e12, 0)}·10¹² Kerne/s, {num(DEFAULTS.targetThickness.value, 2)} mg/cm², Separator {num(100 * DEFAULTS.separatorEfficiency.value, 0)} %. Der Faktor {num(BERKELEY_CALIBRATION.value, 3)} eicht auf Berkeley: im Mittel 2 Ketten in 22,1 Tagen.</li>
          <li><strong>Messung:</strong> Fusionen als Poisson-Prozess, dann je Kern die Zerfallskette mit exponentiell verteilten Zeiten. {num(100 * DEFAULTS.alphaFullEnergyFraction.value, 0)} % der Alphas werden voll gemessen. Eine Kette zählt bei mindestens 2 vollen Alphas oder 1 vollem Alpha plus Spaltung innerhalb von 1 s.</li>
          <li><strong>Auswertung:</strong> <span class="mono">σ = Σ N / (Empfindlichkeit · Ketten-Effizienz)</span>, Poisson-Grenzen zu 68 % nach Gehrels (1986); bei 0 Ereignissen Obergrenze aus 1,84 Ereignissen.</li>
        </ul>
        <h3>Annahmen</h3>
        <p>Drei Festlegungen, im Spiel unter „Annahmen“ einstellbar:</p>
        <dl class="assume">
          {ASSUMPTIONS.map((a) => (
            <div key={a.id}>
              <dt>{a.title}: {a.standard}</dt>
              <dd>{a.text}</dd>
            </div>
          ))}
        </dl>
        <p>Q-Wert ⁵⁰Ti + ²⁴⁹Cf aus Massentabellen (Projektil und Target aus AME2020):</p>
        <ul class="plain">
          {qValuesFromMassTables('Ti50+Cf249').map((q) => (
            <li key={q.modelId}><span class="mono">{num(q.qValue_MeV, 2)} MeV</span> {q.label}</li>
          ))}
        </ul>
        <p>Weitere Annahmen:</p>
        <ul class="bullets">{STAGE1_ASSUMPTIONS.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

      <section class="panel">
        <h2>Stufe 2: Die Physik selbst rechnen (Modell {stage2.STAGE2_MODEL_VERSION})</h2>
        <p class="lead">
          Fusion-by-Diffusion nach Hagino (Phys. Rev. C 98, 014607, 2018) mit den Tabellen der Warschauer Gruppe. Die Trefferquote ist ein Produkt
          aus drei Wahrscheinlichkeiten, summiert über den Drehimpuls ℓ und gemittelt über den Winkel θ zwischen Strahl und Targetachse:
        </p>
        <p class="mono formula">σ_xn(E) = ∫ d(cos θ) · (πħ²/2μE) · Σ_ℓ (2ℓ+1) · T_ℓ(E,θ) · P_CN(E,ℓ,θ) · W_xn(E*,ℓ)</p>
        <ul class="formulas">
          <li><strong>Einfang T_ℓ:</strong> Durchdringung der Barriere nach Hill-Wheeler, <span class="mono">T = 1/(1 + exp[(2π/ħΩ)·(V_b − E)])</span>. Barriere V_b und Krümmung ħΩ numerisch aus Bass-Potential, Coulomb-Potential des deformierten Targetkerns und Zentrifugalterm. Die Barrierenverteilung entsteht aus der Kernform: Spitze niedrig, Flanke hoch.</li>
          <li><strong>Verschmelzen P_CN:</strong> Diffusion über die innere Barriere, <span class="mono">P = ½·[1 − erf √(ΔV/T)]</span>. ΔV ist die Höhe des Sattels über dem Einschuss-Punkt, T die Temperatur. Einschuss-Abstand <span class="mono">s₀ = a − b·(E − B₀)</span> mit den einzigen geeichten Größen a = {num(p.sInjA_fm, 2)} fm und b = {num(p.sInjB_fmPerMeV, 3)} fm/MeV.</li>
          <li><strong>Überleben W_xn:</strong> Bei jedem Schritt der Abdampf-Kaskade wird das Gewicht mit <span class="mono">Γ_n/(Γ_n + Γ_f)</span> multipliziert (Weisskopf gegen Übergangszustand, Fermi-Gas-Niveaudichte mit Schalendämpfung), die Neutronenenergie gewürfelt und die Anregungsenergie gesenkt.</li>
          <li><strong>Eingangsdaten:</strong> Massen von Projektil und Target aus AME2020. Massen, Neutronen-Bindungsenergien, Spaltbarrieren und Schalenkorrekturen der schweren Kerne aus Jachimowicz, Kowal, Skalski (At. Data Nucl. Data Tables 138, 101393, 2021). Deformationen der Targets aus FRDM(2012).</li>
          <li><strong>Eichung:</strong> an {c.points} Messpunkten mit ⁴⁸Ca auf ²³⁸U, ²⁴²Pu, ²⁴³Am, ²⁴⁸Cm, ²⁴⁹Bk. Streuung dort: Faktor {num(c.scatterFactor, 1)}.</li>
          <li><strong>Bahnen-Kontrolle:</strong> Langevin-Bahnen mit Splitting für seltene Bahnen treffen die Formel für P_CN innerhalb des statistischen Fehlers. Für die Vorhersage werden sie nicht gebraucht.</li>
        </ul>

        <h3>Unsicherheits-Ensemble</h3>
        <p>Die unsicheren Eingangsgrößen werden zufällig gezogen (Normalverteilung), und für jede Ziehung wird die ganze Kette gerechnet. Das Band ist das 16-%- und 84-%-Quantil.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Größe</th><th scope="col" class="n">Breite</th><th scope="col">Status</th><th scope="col">Begründung</th></tr></thead>
            <tbody>
              <tr><td>Spaltbarriere je Kern</td><td class="n">{num(u.fissionBarrier_MeV.sigma, 1)} MeV</td><td>{u.fissionBarrier_MeV.kind}</td><td class="wrap">{u.fissionBarrier_MeV.reason}</td></tr>
              <tr><td>Q-Wert</td><td class="n">{num(u.qValue_MeV.sigma, 1)} MeV</td><td>{u.qValue_MeV.kind}</td><td class="wrap">{u.qValue_MeV.reason}</td></tr>
              <tr><td>Einfang-Barriere</td><td class="n">{num(u.captureBarrier_MeV.sigma, 1)} MeV</td><td>{u.captureBarrier_MeV.kind}</td><td class="wrap">{u.captureBarrier_MeV.reason}</td></tr>
              <tr><td>Einschuss-Abstand</td><td class="n">{num(u.injectionDistance_fm.sigma, 1)} fm</td><td>{u.injectionDistance_fm.kind}</td><td class="wrap">{u.injectionDistance_fm.reason}</td></tr>
            </tbody>
          </table>
        </div>
        <p class="hint">Zwei Fehlerangaben, getrennt: Der statistische Fehler der Monte-Carlo-Rechnung schrumpft mit jedem Paket. Die Modellunsicherheit (das Band) schrumpft durch mehr Rechnen nicht.</p>

        <h3>Rechenzeit</h3>
        <p>Eine Ziehung (ganze Kette, eine Energie, 500 Kaskaden) dauert rund 12 ms auf einem Kern. Ein Ensemble mit 1000 Ziehungen: 12 s. Eine volle Vorhersage (6 Reaktionen mal 16 Energien): rund 20 Minuten auf einem Kern.</p>
      </section>

      <section class="panel">
        <h2>Abweichungen vom ursprünglichen Auftrag</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Auftrag</th><th scope="col">Umsetzung</th><th scope="col">Grund</th></tr></thead>
            <tbody>{DEVIATIONS.map(([a, b, g]) => <tr key={a}><td class="wrap">{a}</td><td class="wrap">{b}</td><td class="wrap">{g}</td></tr>)}</tbody>
          </table>
        </div>
        <h3>Eigene Anpassungen und Lesarten in Stufe 2</h3>
        <ol class="bullets">{ADAPTATIONS.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>

      <section class="panel">
        <h2>Quellen</h2>
        <ul class="sources">
          {Object.entries(SOURCES).map(([id, s]) => (
            <li key={id}>
              {s.ref} <span class="badge">{s.checked ? 'am Original geprüft' : 'nicht am Original geprüft'}</span>
            </li>
          ))}
          <li>K. Hagino, Phys. Rev. C 98, 014607 (2018); arXiv:1803.02036 <span class="badge">am Original geprüft</span></li>
          <li>T. Cap, M. Kowal, K. Siwek-Wilczyńska, Eur. Phys. J. A 58, 231 (2022); arXiv:2210.17214 <span class="badge">am Original geprüft</span></li>
          <li>K. Siwek-Wilczyńska, T. Cap, M. Kowal, A. Sobiczewski, J. Wilczyński, Phys. Rev. C 86, 014611 (2012); arXiv:1203.2252 <span class="badge">am Original geprüft</span></li>
          <li>W. J. Świątecki, K. Siwek-Wilczyńska, J. Wilczyński, Acta Phys. Pol. B 34, 2049 (2003) <span class="badge">am Original geprüft</span></li>
          <li>EXFOR, Experimental Nuclear Reaction Data, IAEA Nuclear Data Section (gemessene Wirkungsquerschnitte) <span class="badge">Einträge gelesen</span></li>
          <li>T. Cap, K. Siwek-Wilczyńska, J. Wilczyński, Phys. Rev. C 83, 054602 (2011) <span class="badge">nicht abrufbar</span></li>
        </ul>
      </section>
    </main>
  );
}

# Elementjäger

Gemeinsam nach neuen superschweren Elementen (119, 120) rechnen – ein
Open-Source-Browserspiel mit echten Monte-Carlo-Simulationen.

> **Das ist eine Simulation.** Sie kann vorhersagen, wo man suchen sollte.
> Eine Entdeckung ist erst das im Beschleuniger gemessene Atom.

## Grundsätze

1. Die Physik ist ehrlich. Nichts wird schöngerechnet, damit das Spiel leichter wird.
2. Jede Zahl im Code ist ein Messwert mit Quelle, eine veröffentlichte Vorhersage
   mit Quelle oder als Annahme markiert (`packages/core/src/data/`).
3. Jedes Ergebnis hat einen Fehlerbalken und ist reproduzierbar (Seed, Version).

## Stand

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | `packages/core`: Stufe 1 (Experiment nachspielen) mit Tests | fertig |
| 2 | `packages/web`: Oberfläche für Einzelspieler, GitHub Pages | fertig |
| 3 | Stufe 2: Physik selbst rechnen (Einfang, Verschmelzen, Überleben) | Modell-Vorschlag liegt vor: [docs/modell-stufe2.md](docs/modell-stufe2.md); Umsetzung nach Freigabe |
| 4 | `packages/server`: Team-Funktion | offen |
| 5 | Ergebnis- und Methoden-Seite | offen |

## Starten

Voraussetzung: Node.js ab Version 20.

```bash
npm install
```

Das Spiel im Browser (Entwicklungsserver, Adresse steht in der Ausgabe):

```bash
npm run dev
```

Tests und Typprüfung:

```bash
npm test
```

```bash
npm run typecheck
```

Fertige Seite bauen (liegt danach in `packages/web/dist`) und lokal ansehen:

```bash
npm run build
```

```bash
npm run preview
```

Stufe 1 auf der Konsole (Berkeley-Experiment, Element 120, verdeckte Natur):

```bash
npm run demo
```

### Auf GitHub Pages veröffentlichen

Die Seite braucht keinen Server. Der Workflow `.github/workflows/seite.yml` prüft,
baut und veröffentlicht sie bei jedem Push auf `main`. Einmalig in den
Repository-Einstellungen unter „Pages“ als Quelle „GitHub Actions“ wählen.
Die Seite verwendet nur relative Pfade und läuft unter jeder Adresse.

Zwischenstände (Messreihen, Einstellungen, verdeckte Natur) liegen im
`localStorage` des Browsers und überstehen das Schließen des Tabs.

## Aufbau

```
packages/core     Physik. Keine DOM-Zugriffe; läuft in Browser, Web Worker und Node.
  src/data/         Zahlen mit Herkunft: sources, constants, reactions, decays
  src/rng.ts        mulberry32, Seed-Ableitung, Poisson, Exponential
  src/kinematics.ts E_cm, E*, Bass-Barriere
  src/crossSection.ts  Anregungsfunktionen, Modus „verdeckte Natur“
  src/rate.ts       Rate mit Berkeley-Eichung
  src/decayChain.ts Zerfallsketten, Zählregel, exakte Ketten-Effizienz
  src/statistics.ts Poisson-Vertrauensgrenzen
  src/experiment.ts eine Messung nachspielen und auswerten
  test/             Vitest, darunter der Pflicht-Test berkeley.test.ts
packages/web      Oberfläche (Vite, Preact). Statisch, läuft auf GitHub Pages.
  src/app.tsx       Seite: Steuerpult, Kurve, Detektor-Protokoll, Messreihen
  src/components/   die einzelnen Teile
  src/state.ts      Zustand, Speichern im Browser, Messpunkte zusammenfassen
  src/worker.ts     Web Worker: rechnet die Messungen
  src/chartMath.ts  Maßstäbe der Kurve
  test/             Vitest
packages/server   (Schritt 4)
```

## Stufe 1: Das Experiment nachspielen

Hauptreaktion ⁵⁰Ti + ²⁴⁹Cf → Element 120, Testlauf ⁵⁰Ti + ²⁴⁴Pu → Element 116
(Berkeley 2024).

**Energie.** `E_cm = E_lab · A_Target / (A_Projektil + A_Target)`, `E* = E_cm + Q`.

**Bass-Barriere.** Maximum des Potentials von Bass (1977):
`V(r) = Z₁Z₂e²/r − R₁R₂/(R₁+R₂) · g(s)`, `s = r − R₁ − R₂`,
`g(s) = 1 / (0,0300·e^(s/3,30 fm) + 0,0061·e^(s/0,65 fm))` MeV/fm,
`R = 1,16·A^(1/3) − 1,39·A^(−1/3)` fm.
Ergebnis: Ti+Cf 226,20 MeV, Ti+Pu 217,25 MeV.

**Trefferquote.** Je Kanal eine Gauß-Kurve über E* mit Breite 4 MeV.

**Rate.** `Rate = σ · Targetkerne/cm² · Strahlkerne/s · 0,556 · Separator`.
Der Faktor 0,556 eicht auf Berkeley.

**Ablauf einer Messung.** Fusionen als Poisson-Prozess über die Strahlzeit, dann
je Kern die Zerfallskette mit exponentiell verteilten Zeiten. 90 % der Alphas
werden voll gemessen, der Rest „entwischt“. Eine Kette zählt bei mindestens
2 vollen Alphas oder 1 vollem Alpha plus Spaltung innerhalb von 1 s.

**Auswertung.** `σ = Σ_Kanäle N / (Empfindlichkeit · Ketten-Effizienz)`. Fehler:
Poisson-Grenzen zu 68 % nach Gehrels (1986); bei 0 Ereignissen Obergrenze aus
1,84 Ereignissen. Die Ketten-Effizienz wird exakt aus den Zerfallsdaten gerechnet
(²⁹⁰Lv: 95,0 %, veröffentlicht ≈ 95 %).

**Verdeckte Natur.** Wahres Maximum zufällig zwischen 6 und 80 fb, beste Energie
um bis zu ±5 MeV verschoben. Nur Messreihen verraten sie.

### Berkeley-Eichung (Pflicht-Test)

440 fb, 6·10¹² Kerne/s, 0,44 mg/cm², Separator 70 %, 22,1 Tage:

| Größe | Wert |
|---|---|
| Kerne hinter dem Separator (Formel) | 2,13 |
| Ketten-Effizienz ²⁹⁰Lv (Zählregel) | 95,0 % (veröffentlicht ≈ 95 %) |
| erkannte Ketten im Mittel | 2,02 |
| Auswertung von 2 Ketten | 435 (+574 −281) fb; veröffentlicht 440 (+580 −280) fb |

## Zahlen und ihre Herkunft

| Größe | Wert | Art | Quelle | geprüft |
|---|---|---|---|---|
| σ(⁵⁰Ti+²⁴⁴Pu, 4n) | 440 (+580 −280) fb bei E* 41(2) MeV, 2 Ketten, 22,1 Tage | gemessen | Gates et al., arXiv:2407.16079 | am Original |
| Strahl, Target, Separator | ≈ 6·10¹² /s; 0,435(40) mg/cm²; 70(7) % | gemessen / Simulation | Gates et al. | am Original |
| ²⁹⁰Lv, ²⁸⁶Fl, ²⁸²Cn | T½ 8,2 ms / 106 ms / 0,88 ms; ²⁸⁶Fl: α 10,18 MeV 31/56, α 9,57 MeV 1/56, Spaltung 24/56 | gemessen | Gates et al., Tabelle II | am Original |
| Q(Ti+Pu) | −179,0 MeV | Abschätzung | aus E_cm 220(3) und E* 41(2) MeV bei Gates et al. | am Original |
| σ(⁵⁰Ti+²⁴⁹Cf) 3n / 4n / 5n | 12,87 / 48,20 / 9,90 fb bei E* 34 / 41 / 52 MeV | Vorhersage | Zhang, Zhang, Chen, arXiv:2604.09287, Tabelle II | am Original |
| ²⁸⁸Lv | T½ 2,0 ms, α 11,08 MeV | gemessen | Oganessian et al., PRC 112, 014603 (2025) | über Ackermann, arXiv:2501.04053, Tab. 5.1 |
| ²⁸⁴Fl, ²⁸⁰Cn | T½ 2,5 ms, α 10,57 MeV 24 %, Spaltung 76 %; ²⁸⁰Cn Spaltung 10 µs | gemessen | Oganessian et al. (2025) | über Ackermann |
| ²⁷⁵Ds, ²⁷¹Hs | T½ 0,43 ms, α 11,20 MeV; ²⁷¹Hs 7,1 s und 46 s | gemessen | Oganessian et al., PRC 109, 054307 (2024) | über Ackermann |
| ²⁹⁴120, ²⁹⁰Og, ²⁸⁶Lv (5n-Kette) | T½ 3,5 µs / 19 µs / 3,5 ms; α 13,06 / 12,43 / 11,15 MeV | Vorhersage | Saxena, Jain, Sharma, arXiv:2107.12976, Tabelle 6 | am Original |
| ²⁹⁵120, ²⁹¹Og, ²⁸⁷Lv, ²⁸³Fl, ²⁷⁹Cn, ²⁹⁶120, ²⁹²Og | siehe `decays.ts` | Schätzung | Viola-Seaborg-Systematik, Projektvorgabe | nein |
| Eichfaktor | 0,556 | Eichung | an Gates et al. (2 Ketten in 22,1 Tagen) | nachgerechnet |
| Anteil voll gemessener Alphas | 90 % | Eichung | an den Ketten-Nachweis ≈ 95 % bei Gates et al. | nachgerechnet |
| Q(Ti+Cf) | −197,7 MeV (±3 MeV) | Abschätzung | Projektvorgabe | mit vier Massenmodellen verglichen |
| Massen von ⁵⁰Ti, ²⁴⁹Cf, ²⁴⁴Pu | siehe unten | gemessen | AME2020, Chin. Phys. C 45, 030003 (2021) | an der Originaldatei |
| Breite der Kurven | 4 MeV | Annahme | Projektvorgabe | – |
| Bass-Barriere | Formel | berechnet | R. Bass, Phys. Rev. Lett. 39, 265 (1977) | nein (trifft die Vorgabe) |
| Poisson-Grenzen | 68 %, 1,84 bei 0 Ereignissen | Formel | N. Gehrels, ApJ 303, 336 (1986); Gates et al. zitieren Schmidt et al., Z. Phys. A 316, 19 (1984) | nein (trifft die veröffentlichten Fehler) |
| N_A, e² | 6,02214076·10²³ /mol; 1,43996448 MeV fm | Konstante | CODATA 2018 / SI 2019 | nein |

Im Code trägt jede Quelle `checked: true/false` (`packages/core/src/data/sources.ts`).

Was die Prüfung an den Quellen ergeben hat (seit Modellversion `stufe1-v2`):

- Die Zeiten sind Halbwertszeiten (T½), bei Gates et al. ausdrücklich so genannt.
- **²⁸⁶Fl:** Gemessen sind Alpha 32/56 = 57 % und Spaltung 43 %. Die Projektvorgabe
  nannte 55 / 45; der Code nimmt jetzt die Messung.
- **²⁸⁴Fl:** Zerfällt zu 24 % per Alpha nach ²⁸⁰Cn (Spaltung, 10 µs). Die
  Projektvorgabe nannte nur Spaltung; der Code nimmt jetzt die Messung.
- **²⁸⁸Lv:** Die fehlende Alpha-Energie ist ergänzt (11,08 MeV aus Q_alpha).
- **5n-Kanal von Element 120:** Die Kette ²⁹⁴120 → ²⁹⁰Og → ²⁸⁶Lv → ²⁸²Fl stammt
  aus einer veröffentlichten Vorhersage und ist nachweisbar.
- **Voll gemessene Alphas:** Gates et al. nennen 75–80 % für das einzelne Alpha,
  aber ≈ 95 % Ketten-Nachweis. Unsere einfache Zählregel ergibt die 95 % nur mit
  90 %; mit 75–80 % wären es 86–89 %. Maßgeblich für die Trefferquote ist der
  Ketten-Nachweis, deshalb bleibt 90 % als Eichwert.
- Ohne den Eichfaktor 0,556 ergäben die veröffentlichten Werte 3,6 statt 2 Ketten.
  Die Strahlstärke gilt am Ausgang des Zyklotrons, nicht am Target.
- Zhang et al. nennen weder Unsicherheiten noch eine Kurvenbreite noch einen Q-Wert.
- Die Viola-Seaborg-Schätzungen der Projektvorgabe liegen um Faktoren von 1 bis 5
  neben den Vorhersagen von Saxena et al. für dieselben Kerne (z. B. ²⁹⁵120:
  12 µs gegen 5 µs). Das ist die übliche Streuung solcher Vorhersagen.

## Annahmen und offene Punkte

### Drei Festlegungen (einstellbar, kommen auf die Methoden-Seite)

Diese drei Stellen sind nicht durch Messungen belegt. Die Standardwerte sind
Festlegungen; im Spiel lassen sie sich unter „Annahmen“ ändern, im Kern über
`fl282Decay`, `qValue_MeV` und die Breite der Natur (`assumptions.ts`).

1. **Zerfall von ²⁸²Fl:** Die 5n-Kette von Element 120 endet dort mit
   Spontanspaltung, weil die gemessenen Nachbarn ²⁸⁴Fl und ²⁸²Cn überwiegend
   spalten. Umstellbar auf Alpha-Zerfall nach der Vorhersage von Saxena et al.
   (weiter über ²⁷⁸Cn und ²⁷⁴Ds bis ²⁷⁰Hs). Die Halbwertszeit (0,7 ms) ist ein
   Platzhalter aus dieser Vorhersage. Nachweis der Kette: 99,9 % (Spaltung) oder
   99,99 % (Alpha).
2. **Q-Wert von ⁵⁰Ti + ²⁴⁹Cf:** Standard −197,7 MeV ± 3 MeV. Er legt fest, welche
   Strahlenergie zu welcher Anregungsenergie gehört; 3 MeV verschieben die beste
   Strahlenergie um 3,6 MeV. Vergleich mit Massentabellen siehe unten.
3. **Form der Anregungsfunktion:** Gauß-Kurve mit 4 MeV Breite
   (Standardabweichung). Belegt sind nur die Maxima. Stufe 2 ersetzt die Kurve
   durch die eigene Rechnung.

### Q-Werte aus Massentabellen

`Q = M(Projektil) + M(Target) − M(Compoundkern)`. Projektil und Target aus
AME2020 (⁵⁰Ti −51,432 MeV, ²⁴⁹Cf +69,723 MeV, ²⁴⁴Pu +59,806 MeV Massenexzess),
Compoundkern aus Massenmodellen (`packages/core/src/data/qValues.ts`).

| Massenmodell für den Compoundkern | M(²⁹⁹120) | Q(Ti+Cf) | M(²⁹⁴Lv) | Q(Ti+Pu) |
|---|---|---|---|---|
| FRDM(2012), Möller et al., arXiv:1508.06294 | 213,11 MeV | −194,82 MeV | 186,00 MeV | −177,63 MeV |
| Jachimowicz, Kowal, Skalski (2021), arXiv:2010.10018 | 216,87 MeV | −198,58 MeV | 190,41 MeV | −182,04 MeV |
| WS4-Alpha-Kette an AME2020 angehängt | 217,25 MeV | −198,96 MeV | – | – |
| FRLDM(2012), Möller et al. | 217,56 MeV | −199,27 MeV | 189,56 MeV | −181,19 MeV |
| **Standardwert im Spiel** | | **−197,7 ± 3 MeV** | | **−179,0 MeV** |

Der Standardwert für Ti+Cf liegt innerhalb der Massenmodelle, und ±3 MeV decken
alle vier ab. Die WS4-Zeile ist keine reine WS4-Masse: Die WS4-Tabelle selbst war
nicht abrufbar, deshalb ist ²⁹⁹120 über die bei Saxena et al. abgedruckten
WS4-Alpha-Energien (13,26 und 11,90 MeV) an die AME2020-Masse von ²⁹¹Lv
(extrapoliert, ±0,62 MeV) angehängt. Der Wert für Ti+Pu stammt aus Gates et al.
(Thomas-Fermi-Massen).

### Weitere Annahmen (im Code markiert)

- Die geschätzten Zeiten der Projektvorgabe werden wie die gemessenen als
  **Halbwertszeiten** gelesen; mittlere Lebensdauer = T½ / ln 2.
- Für ⁵⁰Ti + ²⁴⁴Pu ist nur ein Punkt gemessen. Dass er das Maximum ist, ist eine Annahme.
- Geschätzte und vorhergesagte Kerne zerfallen nur per Alpha (keine Spaltungskonkurrenz).
- Eine Spaltung wird immer nachgewiesen. Das 1-s-Fenster zählt ab dem Einschlag.
- Kein Untergrund, keine Totzeit, kein Energieverlust und keine Energiebreite im Target.
- Die Zuordnung Kette → Kanal ist bekannt (im Experiment liest man sie aus den
  Zerfallseigenschaften ab).
- Verdeckte Natur: Maximum logarithmisch gleichverteilt, Verschiebung
  gleichverteilt; alle Kanäle werden gemeinsam skaliert und verschoben.
- Molare Masse = Massenzahl in g/mol; die Targetdicke meint das reine Isotop.
- Regler im Spiel: Strahlstärke 1 bis 30·10¹² /s, Targetdicke 0,1 bis 1 mg/cm²,
  Strahlzeit 1 bis 365 Tage je Messung. Die Grenzen sind Spielgrenzen, keine
  Aussage über einen bestimmten Beschleuniger.

## Mitmachen

Fehler, Quellenhinweise und Verbesserungen sind willkommen, am liebsten als
Issue oder Pull Request. Regeln:

- Keine Zahl ohne Herkunft: Messwert mit Quelle, Vorhersage mit Quelle oder als
  Annahme markiert.
- Jede Änderung an Daten oder Formeln erhöht die Modellversion
  (`packages/core/src/version.ts`).
- `npm test` und `npm run typecheck` müssen bestehen; der Berkeley-Test darf
  nicht aufgeweicht werden.

## Lizenz

MIT, siehe [LICENSE](LICENSE).

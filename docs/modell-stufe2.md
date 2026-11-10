# Modell-Vorschlag für Stufe 2: Die Physik selbst rechnen

Stand: freigegeben und umgesetzt als Modellversion `stufe2-v1`. Was bei der Umsetzung
vom Vorschlag abweicht, steht in Abschnitt 15; die Ergebnisse in Abschnitt 16.
Geprüft an den Quellen am 10.11.2026.

> **Das ist eine Simulation.** Sie kann vorhersagen, wo man suchen sollte.
> Eine Entdeckung ist erst das im Beschleuniger gemessene Atom.

## 1. Kurzfassung

- **Modell:** Fusion-by-Diffusion (FBD) in der Fassung für deformierte
  Aktiniden-Targets nach Hagino (2018), mit den Eingangstabellen und der
  Monte-Carlo-Kaskade der Warschauer Gruppe (Cap, Kowal, Siwek-Wilczyńska 2022).
  Alle Formeln stehen in frei zugänglichen Arbeiten und sind unten zitiert.
- **Drei Stufen**, wie vorgegeben: Einfang (Hill-Wheeler, Barrierenverteilung),
  Verschmelzen (Diffusion über die innere Barriere), Überleben (Neutron gegen
  Spaltung, Schritt für Schritt).
- **Zu eichen sind genau zwei Zahlen:** Achsenabschnitt und Steigung des
  „Einschuss-Abstands“ `s_inj`. Alles andere kommt aus Tabellen und Formeln.
- **Erwartbare Genauigkeit laut Literatur:** etwa eine Größenordnung nach oben
  und unten. Dominant ist die Unsicherheit der Spaltbarrieren (±0,5 MeV
  entsprechen etwa einem Faktor 10). Der statistische Fehler der Rechnung ist
  dagegen klein. Beides wird getrennt ausgewiesen.
- **Ehrliche Einordnung der Rechenleistung:** Im veröffentlichten Modell ist die
  Verschmelzungs-Wahrscheinlichkeit eine geschlossene Formel; Langevin-Bahnen
  können sie nur bestätigen. Wirklich gebraucht wird Rechenleistung für die
  Unsicherheits-Ensembles (Abschnitt 9). Das ist eine Abweichung von der
  Vorgabe „1e8 Bahnen pro Energie“ und braucht deine Entscheidung (Abschnitt 12).

## 2. Was gerechnet wird

Wirkungsquerschnitt für den Verdampfungsrest nach Abdampfen von x Neutronen
(Hagino 2018, Gl. 24–25; Cap et al. 2022, Gl. 1):

```
σ_xn(E) = ∫₀¹ d(cos θ) · (π ħ² / 2μE) · Σ_ℓ (2ℓ+1) · T_ℓ(E,θ) · P_CN(E,ℓ,θ) · W_xn(E*,ℓ)
```

- `E` Schwerpunktsenergie, `μ` reduzierte Masse, `ℓ` Bahndrehimpuls
- `θ` Winkel zwischen Strahl und Symmetrieachse des deformierten Targetkerns
- `T_ℓ` Einfang, `P_CN` Verschmelzen, `W_xn` Überleben
- `E* = E + Q` Anregungsenergie des Compoundkerns

Monte Carlo: `cos θ` gleichverteilt, `ℓ` mit Gewicht `2ℓ+1`, Neutronenenergien
aus dem Verdampfungsspektrum. Jeder Wurf trägt ein Gewicht; summiert werden
Gewichte und Gewichtsquadrate (daraus der statistische Fehler).

## 3. Stufe A: Einfang

Potential zwischen Projektil und Target für festen Winkel θ (Hagino 2018,
Gl. 26–28):

```
V(r,θ) = V_N(r,θ) + V_C(r,θ) + ℓ(ℓ+1) ħ² / (2μ r²)

V_C(r,θ) = Z_P Z_T e²/r
         + (3 Z_P Z_T e²/5)  · R_T²/r³ · (β₂ + (2/7)·√(5/π)·β₂²) · Y₂₀(θ)
         + (3 Z_P Z_T e²/9)  · R_T⁴/r⁵ · (β₄ + 9/(7√π)·β₂²)     · Y₄₀(θ)
         + (3 Z_P Z_T e²/13) · R_T⁶/r⁷ · β₆ · Y₆₀(θ)
```

Kernpotential nach Bass (1977), wie in Stufe 1, mit winkelabhängigem
Targetradius:

```
V_N(r,θ) = − R_P R_T(θ) / (R_P + R_T(θ)) · g(s),      s = r − R_P − R_T(θ)
g(s) = 1 / (0,0300·e^(s/3,30 fm) + 0,0061·e^(s/0,65 fm))  MeV/fm
R_i = 1,16·A_i^(1/3) − 1,39·A_i^(−1/3) fm
R_T(θ) = R_T · (1 + β₂ Y₂₀(θ) + β₄ Y₄₀(θ) + β₆ Y₆₀(θ))
```

Aus `V(r,θ)` werden numerisch Barrierenhöhe `V_b`, Barrierenradius `R_b` und
Krümmung `ħΩ` bestimmt. Durchdringung nach Hill-Wheeler (Hagino 2018, Gl. 30):

```
T_ℓ(E,θ) = 1 / (1 + exp[ (2π/ħΩ(ℓ,θ)) · (V_b(ℓ,θ) − E) ])
```

Die **Barrierenverteilung** entsteht hier nicht aus einer angepassten Breite,
sondern aus der Kernform: Stößt das Projektil auf die Spitze des gestreckten
Targetkerns, ist die Barriere niedrig, an der Flanke hoch. Für ⁵⁰Ti + ²⁴⁹Cf
liegt die Bass-Barriere des kugelförmigen Systems bei 226,2 MeV.

- Deformationen β₂, β₄, β₆ der Targetkerne: FRDM(2012), Möller et al.
  (Tabelle am arXiv-Volltext geprüft).
- **Annahme A1:** Bass-Potential mit winkelabhängigem Radius. Hagino verwendet
  ein Woods-Saxon-Potential, dessen Parameter er nur für ⁴⁸Ca + ²⁴⁸Cm angibt.
  Bass hat keine reaktionsabhängigen Parameter und ist deine Vorgabe.
- **Annahme A2:** Das Projektil wird als Kugel behandelt (wie bei Hagino).
- **Nicht verwendet:** die empirische Einfang-Formel der Warschauer Gruppe
  („diffused barrier“). Die Koeffizienten ihrer Barrierenbreite und ihr
  Normierungsradius stehen nur in Phys. Rev. C 83, 054602 (2011), das nicht
  frei zugänglich ist. Die Formel für die mittlere Barriere `B₀` ist belegt
  und wird als Bezugsenergie gebraucht (Abschnitt 4).

## 4. Stufe B: Verschmelzen

Nach dem Einfang berühren sich die Kerne, sind aber noch kein Compoundkern.
Das System sitzt an einem „Einschuss-Punkt“ außerhalb des Sattels und muss
durch thermische Schwankungen über die innere Barriere diffundieren; sonst
reißt es wieder ab (Quasispaltung).

Lösung der Smoluchowski-Gleichung für eine parabelförmige Barriere
(Świątecki et al.; Siwek-Wilczyńska et al. 2012, Gl. 2; Cap et al. 2022, Gl. 4):

```
P_CN(E,ℓ,θ) = ½ · [1 − erf( √(ΔV_ℓ / T) )]

ΔV_ℓ = V_ℓ(s_sd) − V_ℓ(s_inj(θ))            Höhe der Barriere über dem Einschuss-Punkt
V_ℓ(s) = V_fiss(s) + ℓ(ℓ+1) ħ² / (2 J(s))    mit Rotationsenergie
```

- `s` ist der Abstand der Kernoberflächen (Gesamtlänge `L = 2(R_P+R_T) + s`).
- `V_fiss(s)`: algebraische Näherung des Tröpfchenmodells (zwei Kugeln mit
  Hals), Koeffizienten in Hagino 2018, Anhang A, Gl. A1–A18.
- Am Sattel: `V(s_sd)` = Spaltbarriere `B_f` aus der Massentabelle; Lage des
  Sattels aus dessen tabellierter Deformation (Hagino 2018, Gl. A22–A24).
- Trägheitsmomente `J(s)` starrer Körper (Hagino 2018, Gl. A19–A22).
- Temperatur: `T = √(T_sd · T_inj)` mit
  `T(ℓ,s) = √((E* − V_ℓ(s) − E_pair) / a(s))`,
  `E_pair = 21/√A` MeV (gerade-gerade), `10,5/√A` MeV (ungerades A), 0 sonst.
- Reibung und Masse fallen im überdämpften Grenzfall heraus.

**Einschuss-Abstand** (Hagino 2018, Gl. 34, 36, 37):

```
s_inj(θ) = s₀ + R_T · (β₂ Y₂₀(θ) + β₄ Y₄₀(θ) + β₆ Y₆₀(θ))
s₀ = a − b · (E − B₀)
B₀ = 0,853315·z + 0,0011695·z² − 0,000001544·z³ MeV,   z = Z_P Z_T / (A_P^(1/3) + A_T^(1/3))
```

`a` und `b` sind die **einzigen Eichgrößen** des Modells. Veröffentlichte Werte
(sie hängen von den Eingangstabellen und vom Einfang-Modell ab und sind nicht
übertragbar):

| Quelle | a (fm) | b (fm/MeV) | geeicht an |
|---|---|---|---|
| Siwek-Wilczyńska et al. 2012, Gl. 3 | 4,09 | 0,192 | ⁴⁸Ca + ²⁴²,²⁴⁴Pu, ²⁴³Am, ²⁴⁵,²⁴⁸Cm, ²⁴⁹Bk, ²⁴⁹Cf |
| Cap et al. 2022, Gl. 7 | 3,291 | 0,196 | 24 Wirkungsquerschnitte (2n–5n), ⁴⁸Ca + Aktiniden |
| Hagino 2018, Gl. 37 (mit Winkelabhängigkeit) | 4,698 | 0,16 | ⁴⁸Ca + ²⁴⁸Cm (3n, 4n) |

Cap et al. geben einen Fehlerkorridor von ±1 fm an und warnen vor
Extrapolation: Negative `s_inj` sind unphysikalisch; ab etwa 15 MeV über `B₀`
wird `s_inj = 0` gesetzt.

**Langevin-Bahnen.** Dieselbe Physik als Zufallsbahn:
`ds = −(1/γ)·V'(s)·dt + √(2T/γ)·dW`. Für die Parabel mit fester Temperatur
ergibt das exakt die Formel oben; das ist der Pflicht-Test der Bahnen-Rechnung.
Ein Prototyp mit Splitting für seltene Bahnen trifft die Formel bis hinunter zu
P = 2·10⁻⁸ innerhalb des statistischen Fehlers (rund 30 Mio. Schritte pro
Sekunde und Kern in JavaScript). Mehr dazu in Abschnitt 9.

## 5. Stufe C: Überleben

Der heiße Compoundkern kühlt ab, indem er Neutronen abdampft. Bei jedem
Schritt konkurriert die Spaltung.

Zerfallsbreiten (Cap et al. 2022, Gl. 10–11; ausgeschrieben bei Hagino 2018,
Gl. 13–16):

```
Γ_n = 2 m_n σ_n / (π² ħ² ρ_A(E*)) · ∫₀^ε_max ρ_(A−1)(ε_max − ε) · ε dε        (Weisskopf)
Γ_f = 1 / (2π ρ_A(E*)) · ∫₀^K_max ρ_A^Sattel(K_max − K) dK                    (Übergangszustand)

ε_max = E* − S_n(A) − E_rot(A−1) − E_pair(A−1)
K_max = E* − B_f(A) − E_rot^Sattel(A) − E_pair(A)
σ_n = π r₀² A^(2/3),  r₀ = 1,45 fm
```

Niveaudichte (Fermi-Gas) mit Schalendämpfung nach Ignatyuk und
formabhängigem Parameter nach Reisdorf (Hagino 2018, Gl. A25–A29):

```
ρ ∝ exp(2 √(a U))
a = ã · [1 + (E_Schale / U) · (1 − e^(−U/E_D))],   E_D = 18,5 MeV
ã = 0,0696·A + 0,1801·A^(2/3)·B_S + 0,1644·A^(1/3)·B_K   (MeV⁻¹)
B_S = 1 + (0,6416 α − 0,1421 α²)²,   B_K = 1 + (0,6542 α − 0,0483 α²)²
```

**Kaskade als Monte Carlo** (so auch Cap et al. 2022): Bei jedem Schritt wird

1. das Gewicht mit `Γ_n / (Γ_n + Γ_f)` multipliziert („jeden Schritt einzeln
   bestimmen und multiplizieren“),
2. die Bewegungsenergie des Neutrons aus dem Spektrum `ε · e^(−ε/T)` gewürfelt,
3. die Anregungsenergie um `S_n + ε` gesenkt.

Die Kaskade endet, sobald weder ein weiteres Neutron noch Spaltung möglich
ist. Die Zahl der bis dahin abgedampften Neutronen legt den Kanal (3n, 4n, 5n)
fest. Nur Neutronen gegen Spaltung; Gamma-, Protonen- und Alpha-Abdampfung
werden vernachlässigt (wie im FBD-Modell).

## 6. Eingangsdaten

| Größe | Quelle | geprüft |
|---|---|---|
| Massen von Projektil und Target | AME2020 (Wang et al., Chin. Phys. C 45, 030003) | Originaldatei |
| Compoundkern und Töchter: Massen, S_n, Spaltbarrieren B_f, Schalenkorrekturen, Deformationen an Grundzustand und Sattel | Jachimowicz, Kowal, Skalski, At. Data Nucl. Data Tables 138, 101393 (2021); arXiv:2010.10018, Tabellen 1 und 2 (Z = 98–126) | arXiv-Volltext |
| Deformationen der Targetkerne β₂, β₄, β₆ | FRDM(2012), Möller et al., arXiv:1508.06294 | arXiv-Volltext |
| Q-Wert ⁵⁰Ti + ²⁴⁹Cf | Standard −197,7 ± 3 MeV (Festlegung aus Stufe 1) | mit vier Massenmodellen verglichen |

Beispiel aus der Tabelle für die Kette von Element 120: ²⁹⁹120 hat
S_n = 6,38 MeV und B_f = 5,57 MeV; ²⁹⁵120 hat S_n = 7,40 MeV und B_f = 6,28 MeV.

Für die Vergleichsreaktionen mit Compoundkernen unter Z = 98 gibt es in dieser
Tabelle keine Werte; solche Reaktionen entfallen (betrifft keine der unten
genannten).

## 7. Parameter und ihr Status

| Parameter | Wert | Status |
|---|---|---|
| Bass-Potential (0,0300; 0,0061; 3,30; 0,65; 1,16; 1,39) | fest | belegt über Dutt und Puri, arXiv:1005.5213; Original (Bass 1977) nicht abrufbar |
| Hill-Wheeler-Formel | fest | belegt (Hagino 2018, Gl. 30) |
| Coulomb-Potential des deformierten Kerns | fest | belegt (Hagino 2018, Gl. 27) |
| `B₀`-Formel | fest | belegt über Hagino 2018; trifft drei von der Warschauer Gruppe gedruckte Werte |
| `P_CN`-Formel | fest | belegt (Primärquellen) |
| `V_fiss(s)`, Koeffizienten A1–A18 | fest | nur über Hagino 2018, Anhang; Original (PRC 83, 054602) nicht abrufbar |
| Niveaudichte: 0,0696; 0,1801; 0,1644; E_D = 18,5 MeV | fest | nur über Hagino 2018, Anhang |
| r₀ = 1,45 fm, Paarenergie 21/√A, b_f = 1 fm | fest | nur über Hagino 2018 |
| `a`, `b` in `s₀ = a − b·(E − B₀)` | **zu eichen** | veröffentlichte Werte als Startwerte und Vergleich |
| Reibung, Trägheit | nicht gebraucht | fällt im überdämpften Grenzfall heraus; kein belegter Zahlenwert gefunden |

Bekannte Unstimmigkeiten in den Quellen, die die Umsetzung berücksichtigt:

- Hagino (arXiv-Fassung, Gl. 10 und 35) druckt `erf(ΔV/T)` ohne Wurzel; alle
  Arbeiten der Warschauer Gruppe drucken `erf √(H/T)`. Verwendet wird die Wurzel.
- arXiv:2107.00579 druckt `(2ℓ_max+1)²` statt `(ℓ_max+1)²` (Druckfehler; hier
  ohne Belang, weil nicht mit scharfem Abschneiden gerechnet wird).
- Hagino multipliziert Zwischenschritte der Kaskade mit `(1 − P_<)`, die
  Warschauer Formel druckt `P_<` nur für den letzten Schritt. Die
  Monte-Carlo-Kaskade braucht den Faktor nicht: Sie verfolgt die
  Anregungsenergie Schritt für Schritt.
- Die Sattelenergie nehmen Siwek-Wilczyńska et al. (2012) und Hagino aus der
  Tabelle (mit Schalenkorrektur), Cap et al. (2022) aus dem Tröpfchenmodell.
  Vorgeschlagen ist die Tabelle.

## 8. Eichung und Prüfung

### Woher die Messwerte stammen

Die meisten Originalarbeiten (Phys. Rev. C, Dubna) sind nicht frei zugänglich.
Hauptquelle ist deshalb **EXFOR**, die Datenbank experimenteller Kerndaten der
IAEA: Jeder Eintrag überträgt die Zahlen einer genannten Arbeit und sagt, wo sie
dort stehen. Die vollständige Liste (132 Zeilen mit Fundstelle) liegt in
[`daten/er_wirkungsquerschnitte.csv`](daten/er_wirkungsquerschnitte.csv).

Status in der Tabelle:

- **P** Originalarbeit im Volltext gelesen (arXiv)
- **X** EXFOR-Eintrag gelesen; **X+** vom Autor der Arbeit bestätigt
- **S** Zahl steht in einer anderen Arbeit, die das Original zitiert

Deine drei Vorgaben sind bestätigt:

- ⁵⁰Ti + ²⁴⁴Pu (4n): 0,44 (+0,58 −0,28) pb bei E* = 41(2) MeV (P).
- ⁴⁸Ca + ²⁴⁹Cf (3n): 0,5 (+1,6 −0,3) pb bei E* = 32,1–36,6 MeV, dazu ein zweiter
  Punkt 0,3 (+1,0 −0,27) pb bei 26,6–31,7 MeV (X).
- ⁴⁸Ca + ²⁴⁴Pu (4n): 5,3 (+3,6 −2,1) pb (Dubna) und 9,8 (+3,9 −3,1) pb (TASCA,
  GSI) sind zwei verschiedene Experimente; zwei neuere Messungen liegen mit 5,1
  und 6,7 pb dazwischen (X, X+).

### Vorgeschlagene Aufteilung

Die Vorhersage für Element 120 verlangt zwei Schritte ins Unbekannte: ein
schwereres Projektil als ⁴⁸Ca und das schwerste Target. Genau diese Fälle
sollten deshalb **nicht** in die Eichung, sondern die Prüfung sein.

**Eichung** (nur ⁴⁸Ca, fünf Targets, je die best gemessenen Kanäle):

| Reaktion | Kanal | σ (pb) | E* (MeV) | Experiment | Status |
|---|---|---|---|---|---|
| ⁴⁸Ca + ²³⁸U | 3n, ²⁸³Cn | 1,5 +0,7 −0,5 | 30,7–34,4 | Dubna 2022 | X+ |
| ⁴⁸Ca + ²⁴²Pu | 3n, ²⁸⁷Fl | 10,4 +3,5 −2,1 | 37,1–40,7 | Dubna 2022 | X+ |
| ⁴⁸Ca + ²⁴²Pu | 4n, ²⁸⁶Fl | 4,8 +2,1 −1,6 | 41,3–44,8 | Dubna 2022 | X+ |
| ⁴⁸Ca + ²⁴³Am | 3n, ²⁸⁸Mc | 17,1 +6,3 −4,7 | 33,1–35,2 | Dubna 2022 | X+ |
| ⁴⁸Ca + ²⁴³Am | 3n, ²⁸⁸Mc | 10,3 ±1,3 +4,0 −3,1 | 32,4–37,9 | TASCA, 11 Ketten | P |
| ⁴⁸Ca + ²⁴³Am | 4n, ²⁸⁷Mc | 4,1 +3,2 −1,2 | 41,3–43,5 | Dubna 2022 | X+ |
| ⁴⁸Ca + ²⁴⁸Cm | 4n, ²⁹²Lv | 3,3 +2,5 −1,4 | 36,8–41,1 | Dubna | X |
| ⁴⁸Ca + ²⁴⁸Cm | 3n, ²⁹³Lv | 1,2 +1,8 −0,8 | – | Dubna | X |
| ⁴⁸Ca + ²⁴⁹Bk | 4n, ²⁹³Ts | 2,37 +2,31 −1,29 | 42,6 | Dubna/ORNL | X |
| ⁴⁸Ca + ²⁴⁹Bk | 3n, ²⁹⁴Ts | 1,10 +1,07 −0,60 | 35,1 | Dubna/ORNL | X |

**Prüfung** (nach der Eichung eingefroren gerechnet, nichts nachgestellt):

| Reaktion | Kanal | σ (pb) | E* (MeV) | Experiment | Status | prüft |
|---|---|---|---|---|---|---|
| ⁴⁸Ca + ²⁴⁴Pu | 4n, ²⁸⁸Fl | 5,3 bis 9,8 (vier Messungen) | 38,9–43,0 | Dubna, TASCA, LBNL | X, X+ | anderes Isotop |
| ⁴⁸Ca + ²⁴⁴Pu | 3n, ²⁸⁹Fl | 8,0 +7,4 −4,5 | 37,5 | TASCA | X | Kanalverhältnis |
| ⁴⁸Ca + ²⁴⁴Pu | 5n, ²⁸⁷Fl | 1,1 +2,6 −0,9 | 50,4–54,7 | Dubna | X | hohe Energie |
| ⁴⁸Ca + ²⁴⁵Cm | 3n, ²⁹⁰Lv | 3,7 +3,6 −1,8 | 35,9–39,9 | Dubna | X | anderes Isotop |
| ⁴⁸Ca + ²⁴⁹Cf | 3n, ²⁹⁴Og | 0,5 +1,6 −0,3 | 32,1–36,6 | Dubna | X | schwerstes Target |
| ⁴⁸Ca + ²³²Th | 4n, ²⁷⁶Ds | 0,7 +1,1 −0,5 | 37,9–42,1 | Dubna 2023 | X+ | leichtes Target |
| ⁴⁸Ca + ²³²Th | 5n, ²⁷⁵Ds | 0,34 +0,59 −0,16 | 54,2–57,5 | Dubna 2024 | X+ | leichtes Target |
| ⁵⁰Ti + ²⁴⁴Pu | 4n, ²⁹⁰Lv | 0,44 +0,58 −0,28 | 41(2) | LBNL 2024, 2 Ketten | P | **schwereres Projektil** |
| ⁵⁰Ti + ²⁴²Pu | 3n, ²⁸⁹Lv | 0,32 +0,34 −0,18 | 41 | Dubna 2025 | S | **schwereres Projektil** |
| ⁵⁰Ti + ²⁴²Pu | 4n, ²⁸⁸Lv | 0,22 +0,27 −0,15 | 41 | Dubna 2025 | S | **schwereres Projektil** |
| ⁵⁴Cr + ²³⁸U | 4n, ²⁸⁸Lv | 0,032 oder 0,036 (+0,046 −0,024) | 42 | Dubna, 1 Ereignis | S, Quellen uneins | **schwereres Projektil** |

**Obergrenzen** aus erfolglosen Suchen (die Rechnung darf nicht darüber liegen):

| Reaktion | Ziel | Obergrenze | Experiment | Status |
|---|---|---|---|---|
| ⁵⁰Ti + ²⁴⁹Cf | 120 | < 200 fb | TASCA, GSI (PRC 102, 064602) | X + S |
| ⁵⁰Ti + ²⁴⁹Bk | 119 | < 65 fb | TASCA, GSI | X + S |
| ⁵⁴Cr + ²⁴⁸Cm | 120 | < 0,58 pb | SHIP, GSI | S |
| ⁵⁸Fe + ²⁴⁴Pu | 120 | < 0,4 pb | Dubna 2009 | S |
| ⁶⁴Ni + ²³⁸U | 120 | < 90 fb bei E* = 36,4 MeV | SHIP, GSI | S |
| ⁵⁰Ti + ²⁴⁸Cm | Og | < 0,50 pb | RIKEN 2025 | X |

Die Grenzen sind „Ein-Ereignis-Grenzen“; ein Vertrauensniveau nennt nur RIKEN
(1 σ). Für ⁵¹V + ²⁴⁸Cm (RIKEN) ist keine veröffentlichte Grenze zu finden.

### Vorgehen

1. Verglichen wird bei der **gemessenen Strahlenergie** (Mitte des Targets),
   umgerechnet in die Schwerpunktsenergie. Das ist unabhängig von der
   Massentabelle. Wo EXFOR nur die Energie am Beschleuniger nennt, wird das
   Maximum des Kanals verglichen.
2. Angepasst werden `a` und `b` so, dass die Abweichung im Logarithmus des
   Wirkungsquerschnitts minimal wird, gewichtet mit den (unsymmetrischen)
   Poisson-Fehlern der Messung.
3. Danach wird der Parametersatz eingefroren und bekommt eine Versionsnummer.
4. Die Seite „Wie gut ist das Modell?“ zeigt für **alle** Reaktionen Messwert
   gegen Rechnung, Eichung und Prüfung getrennt, und nennt die mittlere
   Abweichung als Faktor.
5. Erst danach werden Elemente 119 und 120 gerechnet.

Vorab festgelegt: Fällt die Prüfung bei den schwereren Projektilen deutlich
schlechter aus als bei ⁴⁸Ca (mehr als ein Faktor 10), wird nicht stillschweigend
nachgeeicht. Ich lege dir das Ergebnis vor, und die Vorhersagen für 119 und 120
tragen den entsprechenden Vorbehalt.

### Bekannte Unstimmigkeiten in den Daten

- ⁵⁴Cr + ²³⁸U: Eine Quelle nennt 32 fb, eine andere 36 fb; ein einziges Ereignis.
- ⁴⁸Ca + ²³²Th bei 250,6 MeV: Derselbe Wert steht in EXFOR einmal als 4n und
  einmal als 5n.
- Die TASCA-Grenzen für 119 und 120 stehen in EXFOR mit der Einheit pb; alle
  Textquellen sagen fb. Verwendet wird fb.
- Messungen derselben Reaktion in verschiedenen Laboren unterscheiden sich um
  Faktoren von 2 bis 5 (z. B. ⁴⁸Ca + ²⁴³Am, 3n: 3,7 bis 17,1 pb). Das begrenzt,
  wie genau ein Modell überhaupt geeicht werden kann.

## 9. Wo die Rechenleistung hingeht

Ehrlich eingeordnet:

1. **Verschmelzen im veröffentlichten Modell braucht keine Bahnen.** Für eine
   Parabel mit fester Temperatur ist `P_CN` die Formel aus Abschnitt 4. Auch
   Verallgemeinerungen in einer Dimension (andere Barrierenform, ortsabhängige
   Temperatur) lassen sich als gewöhnliches Integral lösen. Bahnen werden erst
   zwingend, wenn man mehrere Formfreiheitsgrade oder Trägheit mitnimmt. Dafür
   habe ich keine vollständig belegten Parameter gefunden (Potentialfläche:
   unveröffentlichter Bericht von Błocki und Świątecki; Reibung: kein
   Zahlenwert). Nichts davon wird erfunden.
2. **Die Kaskade ist echtes Monte Carlo** (Neutronenenergien), aber billig:
   Sekunden bis Minuten je Energie.
3. **Wirklich teuer und wirklich nützlich: Unsicherheits-Ensembles.** Die
   Vorhersage hängt stark von Eingangsgrößen ab, deren Unsicherheit bekannt ist:
   Spaltbarrieren ±0,5 MeV, `s_inj` ±1 fm, Q-Wert ±3 MeV, `B₀` ±2 MeV. Für eine
   belastbare Vorhersage zieht man diese Größen viele tausend Mal zufällig und
   rechnet jedes Mal die ganze Kette. Das Ergebnis ist ein Band mit
   Wahrscheinlichkeiten statt einer einzelnen Zahl. Das lässt sich in Pakete
   teilen und im Team rechnen, und jedes Paket verkleinert den Fehler des Bandes.

Vorschlag: Bahnen-Rechnung umsetzen (mit Splitting, exakten Gewichten und
frühem Abbruch, geprüft gegen die Formel), aber die Vorhersage nicht davon
abhängig machen. Die Team-Rechenleistung fließt in die Ensembles.

## 10. Fehlerangaben

Jedes Ergebnis trägt zwei getrennte Angaben:

- **Statistischer Fehler** der Monte-Carlo-Rechnung (68 %): schrumpft mit
  jedem Paket wie 1/√N.
- **Modellunsicherheit:** aus dem Ensemble (16-%- und 84-%-Quantil) und aus der
  Streuung Rechnung gegen Messung bei den Prüf-Reaktionen. Sie schrumpft nicht
  durch mehr Rechnen. Literaturwert: etwa eine Größenordnung.

## 11. Rechenpakete und Reproduzierbarkeit

- Paket: Reaktion, Energie, Stufe, Modellversion, Parametersatz, Seed, Zahl der
  Würfe. Ergebnis: Summe der Gewichte, Summe der Gewichtsquadrate, Zahl der Würfe.
- Gleicher Seed und gleiche Version ergeben bitgleich dasselbe Ergebnis; so
  lassen sich in Stufe 3 zwei Spieler vergleichen.
- Innere Schleifen arbeiten auf Zahlenfeldern (`Float64Array`) ohne Objekte und
  ohne Speicheranforderung, damit sie nach WebAssembly wandern können.
- Zwischenstände in IndexedDB; eine lange Rechnung läuft nach dem Schließen des
  Tabs beim nächsten Öffnen weiter.

## 12. Pflicht-Tests

- Hill-Wheeler: `T = ½` bei `E = V_b`; weit über der Barriere nähert sich die
  Summe über ℓ dem klassischen Wert `π R_b² (1 − V_b/E)`.
- Barriere ohne Deformation = Bass-Barriere aus Stufe 1 (226,2 und 217,2 MeV).
- Bahnen gegen Formel: `P_CN` für die Parabel, mit und ohne Splitting.
- Splitting und Gewichte: erwartungstreu (Vergleich mit direkter Rechnung bei
  großen Wahrscheinlichkeiten).
- Kaskade: Grenzfall ohne Spaltung ergibt Überleben 1; Summe über alle Kanäle
  plus Spaltung ergibt 1.
- `B₀`-Formel: 173,0 / 191,2 / 208,3 MeV für ⁴⁸Ca, ⁵⁰Ti, ⁵⁴Cr + ²⁰⁸Pb
  (gedruckte Werte der Warschauer Gruppe).
- Eingangstabellen: Stichproben gegen die Quelle.
- Reproduzierbarkeit: gleiches Paket, gleiches Ergebnis.

## 13. Entscheidungen, die ich von dir brauche

1. **Rechenleistung:** Bahnen-Rechnung als geprüfte Kontrolle der Formel und
   die Team-Rechenleistung für Unsicherheits-Ensembles (Empfehlung)? Oder
   sollen die Bahnen der Hauptteil bleiben? Dann bräuchte ich ein
   mehrdimensionales Modell mit Parametern, die ich nicht belegen kann.
2. **Aufteilung:** Eichung nur an ⁴⁸Ca mit fünf Targets, Prüfung an ²⁴⁴Pu,
   ²⁴⁵Cm, ²⁴⁹Cf, ²³²Th und allen Reaktionen mit ⁵⁰Ti und ⁵⁴Cr (Empfehlung)?
   Damit sind alle drei von dir genannten Reaktionen Prüf-Reaktionen.
3. **Einfang:** Bass-Potential mit winkelabhängigem Targetradius (Annahme A1)
   statt Haginos Woods-Saxon-Potential?
4. **Zahlen aus zweiter Hand:** Die Koeffizienten von `V_fiss` und der
   Niveaudichte stehen nur in Haginos Anhang, der sie der nicht zugänglichen
   Arbeit PRC 83, 054602 zuschreibt. Als „über Hagino belegt“ verwenden?
5. **Reaktionen für die Vorhersage:** Element 120 über ⁵⁰Ti + ²⁴⁹Cf,
   ⁵⁴Cr + ²⁴⁸Cm und ⁵¹V + ²⁴⁹Bk; Element 119 über ⁵⁰Ti + ²⁴⁹Bk, ⁵¹V + ²⁴⁸Cm
   und ⁵⁴Cr + ²⁴³Am?

## 15. Umsetzung: Abweichungen und eigene Anpassungen

Alles in diesem Abschnitt gehört auf die Methoden-Seite.

### Abweichungen vom ursprünglichen Auftrag

| Auftrag | Umsetzung | Grund |
|---|---|---|
| Langevin-Bahnen als teurer Hauptteil, rund 1e8 Bahnen je Energie | Bahnen nur als Kontrolle der Formel (`langevin.ts`), Rechenleistung in Unsicherheits-Ensembles | Im veröffentlichten Modell ist die Verschmelzungs-Wahrscheinlichkeit eine geschlossene Formel; für mehr Freiheitsgrade fehlen belegte Parameter. Keine künstliche Rechenlast. |
| Barrierenverteilung um die Bass-Barriere | Barrierenverteilung aus der Form des Targetkerns (Winkel-Integral), Bass-Potential mit winkelabhängigem Radius | So bei Hagino (2018); braucht keine angepasste Breite. |
| Jeden Stoß per Monte Carlo | Winkel und Drehimpuls werden exakt summiert (24 Gauß-Legendre-Stützstellen, alle ℓ); gewürfelt werden nur die Neutronenenergien | Genauer und schneller als Würfeln. |
| Q-Wert ⁵⁰Ti + ²⁴⁹Cf: Standard −197,7 MeV | Stufe 2 rechnet mit −198,58 MeV | Q-Wert, Neutronen-Bindungsenergien und Spaltbarrieren müssen aus derselben Massentabelle stammen. Der Wert liegt innerhalb von ±3 MeV; im Ensemble wird der Q-Wert mit 2,1 MeV Breite gezogen. Stufe 1 bleibt bei −197,7 MeV. |
| Eichung an einem Teil von drei genannten Reaktionen | Eichung an 48 Messpunkten mit ⁴⁸Ca auf fünf Targets; alle drei genannten Reaktionen sind Prüf-Reaktionen | So vereinbart: schwereres Projektil und schwerstes Target bleiben für die Prüfung. |

### Eigene Anpassungen und Lesarten

1. **Einfang mit Bass-Potential** (A1): `R_T(θ) = R_T·(1 + Σ β_λ Y_λ0(θ))` im
   Bass-Potential von 1977. Nicht in dieser Form veröffentlicht. Vergleich mit
   Hagino siehe unten.
2. **Projektil als Kugel** (A2).
3. **Winkelabhängiger Einschuss-Abstand mit R_T = 1,2·A^(1/3) fm.** Hagino nennt
   den Radius an dieser Stelle nicht; seine Abb. 3(b) passt nur zu diesem Wert
   (Unterschied Spitze gegen Flanke 1,92 fm für ⁴⁸Ca + ²⁴⁸Cm).
4. **Sattelenergie aus der Massentabelle:** `V_sd = E_tot(Grundzustand) + B_f`,
   beides aus Jachimowicz et al. relativ zur makroskopischen Kugel; so beschreiben
   es Siwek-Wilczyńska et al. (2012). Hagino nimmt die Sattelenergie aus der
   algebraischen Formel. Für ²⁹⁶Lv: −0,61 MeV (Tabelle) gegen −1,06 MeV (Hagino,
   aus seiner Abb. 3c abgelesen).
5. **Energien relativ zum Grundzustand:** Die makroskopische Energie am
   Einschuss-Punkt wird um die Grundzustandsenergie `E_tot` (rund −6 MeV)
   verschoben, bevor die Temperatur gerechnet wird. Die Quellen sagen dazu nichts
   Eindeutiges.
6. **Einschuss-Abstand nie negativ:** `s₀ = max(0, a − b·(E − B₀))`, nach Cap et
   al. (2022).
7. **Ende der Kaskade:** Sie endet, wenn weder Neutron noch Spaltung möglich ist,
   jeweils mit Paar- und Rotationsenergie gerechnet. Haginos Schwellen (Gl. 21–22)
   enthalten die Paarenergie nicht; der Unterschied ist höchstens 1,2 MeV.
8. **Neutronenspektrum:** gewürfelt aus der Niveaudichte `ρ(ε_max − ε)·ε`. Cap et
   al. (2022) nehmen die Maxwell-Näherung `ε·e^(−ε/T)` dieses Spektrums.
9. **Schalenkorrektur am Sattel** aus der Tabelle (−0,3 bis −1,2 MeV), am
   Einschuss-Punkt null (wie Hagino).
10. **Energie-Mittelung:** Über den angegebenen E*-Bereich einer Messung
    (Energieverlust im Target) wird mit fünf Energien gemittelt.
11. **Energie der Messung:** aus der Strahlenergie in der Mitte des Targets. Für
    TASCA (⁴⁸Ca + ²⁴⁴Pu) aus E* mit dem Q-Wert, der aus der Dubna-Messung folgt
    (−162,1 MeV); für ⁵⁰Ti + ²⁴²Pu und ⁵⁴Cr + ²³⁸U aus E* mit dem Q-Wert unserer
    Tabelle, weil die Strahlenergie nicht vorliegt.
12. **Deformationen der Targets** aus FRDM(2012) (β₂ = 0,24 bis 0,25). Gemessene
    Werte liegen höher (Hagino nimmt für ²⁴⁸Cm β₂ = 0,297); die Quelle dafür war
    nicht abrufbar.
13. **Unsicherheits-Ensemble:** Die Eichung wird nicht für jede Ziehung
    wiederholt; die Ziehungen der Spaltbarrieren sind zwischen Kernen unabhängig;
    Neutronen-Bindungsenergien werden nicht gezogen.

### Druckfehler in Haginos Anhang (Ergänzung 4)

Hagino druckt in Gl. A10 `β₁ = −0,06080 + 1,137825·D − 10,7077·D²`. Richtig ist
**1,37825**. Belege:

| Beleg | b für ⁴⁸Ca + ²⁴⁸Cm |
|---|---|
| Haginos Abb. 3(c) gegen 3(b), aus den Kurvendaten der Abbildung (exakte Parabel) | −0,01372 |
| Formel mit 1,37825 | −0,01369 |
| Formel mit 1,137825 (wie gedruckt) | −0,03084 |
| Satz von 2003 (Świątecki et al., im Druck geprüft) | −0,0114 |

Eine Abbildung der Warschauer Gruppe (⁵⁰Ti + ²⁰⁸Pb, arXiv:2210.17214) passt
ebenfalls nur zu 1,378 ± 0,001. In keiner zugänglichen Arbeit steht der
Koeffizient ein zweites Mal gedruckt. Hagino druckt außerdem `erf(ΔV/T)` ohne
Wurzel; seine Abbildungen folgen der Form mit Wurzel.

Einen Preprint von PRC 83, 054602 (Cap, Siwek-Wilczyńska, Wilczyński 2011) gibt es
nicht. arXiv:1203.2252 derselben Gruppe druckt keinen dieser Koeffizienten; es
verweist auf PRC 83, 054602. Frei zugänglich ist die Ursprungsarbeit, W. J.
Świątecki, K. Siwek-Wilczyńska, J. Wilczyński, Acta Phys. Pol. B 34, 2049 (2003).
Sie druckt einen früheren Satz:

| Größe | 2003 (im Druck geprüft) | 2011 nach Hagino (verwendet) |
|---|---|---|
| E_surf, Spaltbarkeit x, R | 17,9439·(1 − 1,7826 I²)·A^(2/3) MeV; 50,883; 1,155 fm | identisch |
| a | −0,00557 − 0,01929·e^(−D/0,02283) + (0,048 + 0,12151·e^(−D/0,04053))·t + (−0,073 + 0,94 D)·t² | −0,00564 − 0,01936·e^(−D/0,02240) + (0,05122 + 0,11931·e^(−D/0,03800))·t + (−0,07424 + 0,95959 D)·t² |
| b | −0,00858 − 0,05303·e^(−D/0,03205) + (0,019 + 0,25663·e^(−D/0,07331))·t | −0,06080 + 1,37825 D − 10,7077 D² + (0,27691 − 2,93119 D + 12,60944 D²)·t + (−0,02398 − 1,14854 D)·t² |
| c | −0,0256 + 0,1944 D + (0,0214 + 0,6158 D)·t | −0,02722 + 0,2231 D + (0,02050 + 0,32122 D)·t + (0,03843 + 1,03731 D)·t² |
| Formfunktionen der Niveaudichte | 1 + (0,6416 α − 0,1421 α²)²; 1 + (0,6542 α − 0,0483 α²)² | identisch |
| Niveaudichte-Parameter | 0,076·A + 0,180·A^(2/3)·F + 0,157·A^(1/3)·G | 0,0696·A + 0,1801·A^(2/3)·B_S + 0,1644·A^(1/3)·B_K |
| Paarenergie | 12/√A (ungerade), 24/√A (gerade-gerade) | 10,5/√A, 21/√A |
| Dämpfung der Schalenkorrektur | A^(1/3)/0,47 MeV (14 MeV bei A = 290) | 18,5 MeV |

(t = 1 − x, D = ((R_T − R_P)/(R_T + R_P))².) Für ⁴⁸Ca + ²⁴⁸Cm ergeben beide Sätze
a = −0,00468 und c = −0,0101; b ist −0,0114 (2003) gegen −0,0137 (2011). Der Satz
von 2003 ist für |Δ| < 0,25 geprüft; unsere Reaktionen liegen bei 0,26 bis 0,27.
Verwendet wird der Satz von 2011; der von 2003 ist als Variante eingebaut
(`barrierCoefficients: 'fbd2003'`). An den Eich-Reaktionen ändert er die Güte
kaum (Streuung Faktor 8,5 statt 8,9).

### Einfang: Vergleich mit Hagino für ⁴⁸Ca + ²⁴⁸Cm (Ergänzung 3)

| | Barriere an der Spitze | an der Flanke | σ_Einfang bei 195 / 205 / 215 MeV |
|---|---|---|---|
| Hagino, Abb. 3(a) (abgelesen) | 190,5 MeV | 208,9 MeV | – |
| Nachbau seines Woods-Saxon-Potentials | 190,2 MeV | 208,9 MeV | 17 / 91 / 260 mb |
| Bass mit winkelabhängigem Radius, seine Deformation | 187,9 MeV | 205,3 MeV | 33 / 128 / 346 mb |
| Bass mit winkelabhängigem Radius, FRDM-Deformation (verwendet) | 189,9 MeV | 204,3 MeV | 23 / 117 / 341 mb |

Der Nachbau trifft Haginos Abbildung. Die eigene Anpassung gibt sein Ergebnis
**nicht** genau wieder: Die Barrieren liegen 2 bis 4 MeV tiefer, der Einfang ist
unterhalb der Barriere bis zu doppelt so groß. Haginos Potential ist an eine
gemessene Barrierenverteilung dieses einen Systems angepasst. Mit seinem Potential
statt Bass eicht sich das Modell auf a = 3,70 fm, b = 0,006 fm/MeV bei praktisch
gleicher Güte (Streuung Faktor 8,3). Im Ensemble wird die Einfang-Barriere deshalb
mit 2 MeV Breite gezogen.

### Unsicherheits-Ensemble: gezogene Größen

| Größe | Breite (1 σ, Normalverteilung) | Begründung |
|---|---|---|
| Spaltbarriere je Kern | 0,5 MeV | Siwek-Wilczyńska et al. (2012): kaum besser als ±0,5 MeV; Kowal et al. (arXiv:1607.08462): mittlere Abweichung 0,5 MeV. Unabhängigkeit zwischen Kernen ist eine Annahme. |
| Q-Wert | 2,1 MeV | Standardabweichung von vier Massenmodellen für ⁵⁰Ti + ²⁴⁹Cf. Dass sie für alle Reaktionen gilt, ist eine Annahme. |
| Einfang-Barriere | 2,0 MeV | Annahme. Anhaltspunkte: Cap et al. (2022) bis 2 MeV; Bass gegen Hagino 2 bis 4 MeV. |
| Einschuss-Abstand | 0,6 fm | Rest-Streuung der eigenen Eichung (siehe unten). |

An den Eich-Punkten streut Rechnung gegen Messung um 0,95 Dekaden. Spaltbarrieren,
Q-Wert und Einfang-Barriere erklären zusammen etwa 0,72 Dekaden (Spaltbarrieren
allein 0,5 bis 0,7). Der Rest, 0,62 Dekaden, entspricht 0,6 fm im
Einschuss-Abstand. Die volle Streuung des Einschuss-Abstands (1,02 fm; Cap et al.
nennen ±1 fm) enthält die anderen Beiträge schon und würde sie doppelt zählen.

### Rechenzeit

Gemessen auf einem Kern (Node, TypeScript):

- eine Ziehung (ganze Kette, eine Energie, 500 Kaskaden): 12 ms
- ein Ensemble (eine Reaktion, eine Energie, 1000 Ziehungen): 12 s
- die Quantile sind mit 1000 Ziehungen auf etwa 10 % stabil

Eine volle Vorhersage: 6 Reaktionen × 16 Energien (30 MeV in Schritten von 2 MeV)
= 96 Ensembles, also rund 20 Minuten auf einem Kern, 3 bis 5 Minuten auf einem
Rechner mit vier bis acht Kernen. Mit 10 000 Ziehungen je Ensemble (Quantile auf
etwa 3 %) sind es gut 3 Stunden auf einem Kern.

## 17. Quellen

Am Volltext geprüft (arXiv):

- K. Hagino, „Hot fusion reactions with deformed nuclei for synthesis of
  superheavy nuclei: An extension of the fusion-by-diffusion model“,
  Phys. Rev. C 98, 014607 (2018); arXiv:1803.02036.
- T. Cap, M. Kowal, K. Siwek-Wilczyńska, „The Fusion-by-Diffusion model as a
  tool to calculate cross sections for the production of superheavy nuclei“,
  Eur. Phys. J. A 58, 231 (2022); arXiv:2210.17214.
- T. Cap, M. Kowal, K. Siwek-Wilczyńska, Phys. Rev. C 105, L051601 (2022);
  arXiv:2107.00579.
- K. Siwek-Wilczyńska, T. Cap, M. Kowal, Phys. Rev. C 99, 054603 (2019);
  arXiv:1812.09522.
- K. Siwek-Wilczyńska, T. Cap, M. Kowal, A. Sobiczewski, J. Wilczyński,
  Phys. Rev. C 86, 014611 (2012); arXiv:1203.2252.
- P. Jachimowicz, M. Kowal, J. Skalski, At. Data Nucl. Data Tables 138, 101393
  (2021); arXiv:2010.10018.
- P. Möller, A. J. Sierk, T. Ichikawa, H. Sagawa, At. Data Nucl. Data Tables
  109–110, 1 (2016); arXiv:1508.06294.
- I. Dutt, R. K. Puri, arXiv:1005.5213 (druckt die Bass-Parameter von 1977).
- W. Loveland, Eur. Phys. J. A 51, 120 (2015); arXiv:1411.4929 (Unsicherheiten).
- W. J. Świątecki, K. Siwek-Wilczyńska, J. Wilczyński, „Fusion by diffusion“,
  Acta Phys. Pol. B 34, 2049 (2003) (frei zugänglich; Anhänge B und C am Druckbild geprüft).
- T. Cap, K. Siwek-Wilczyńska, I. Skwira-Chalot, Acta Phys. Pol. B 43, 297 (2012)
  (frei zugänglich; bestätigt s_inj = 2,30 fm − 0,062·(E − B₀) fm/MeV für kalte Fusion).

Messwerte:

- EXFOR, Experimental Nuclear Reaction Data, IAEA Nuclear Data Section
  (www-nds.iaea.org); verwendete Einträge und Zeilen in
  `daten/er_wirkungsquerschnitte.csv`.
- J. M. Gates et al., arXiv:2407.16079 (⁵⁰Ti + ²⁴⁴Pu).
- U. Forsberg et al., arXiv:1502.03030 (⁴⁸Ca + ²⁴³Am, TASCA).
- J. Khuyagbaatar et al., Phys. Rev. C 102, 064602 (2020) (Suche nach 119 und
  120, über EXFOR und Sekundärquellen).

Nur als Zitat, Volltext nicht abrufbar:

- T. Cap, K. Siwek-Wilczyńska, J. Wilczyński, Phys. Rev. C 83, 054602 (2011).
- W. J. Świątecki, K. Siwek-Wilczyńska, J. Wilczyński, Phys. Rev. C 71, 014602 (2005).
- R. Bass, Phys. Rev. Lett. 39, 265 (1977).
- D. L. Hill, J. A. Wheeler, Phys. Rev. 89, 1102 (1953).
- W. Reisdorf, Z. Phys. A 300, 227 (1981).
- A. V. Ignatyuk, G. N. Smirenkin, A. S. Tishin, Sov. J. Nucl. Phys. 21, 255 (1975).
- J. Błocki, W. J. Świątecki, LBL-12811 (1982, unveröffentlicht).

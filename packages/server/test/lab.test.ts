import { eLabForExcitation, stage2 } from '@elementjaeger/core';
import { describe, expect, it } from 'vitest';
import { ASSIGNMENT_TIMEOUT_MS, Lab, PACKET_SIZE, type Assignment } from '../src/lab';

/** Rechnet ein Paket so, wie es der Browser täte. */
const preps = new Map<string, stage2.PreparedReaction>();
function compute(work: Assignment): number[] {
  let prep = preps.get(work.reaction.id);
  if (!prep) {
    prep = stage2.prepareReaction(work.reaction, stage2.STAGE2_PARAMETERS);
    preps.set(work.reaction.id, prep);
  }
  // wenige Kaskaden, damit der Test schnell bleibt; das Ergebnis bleibt deterministisch
  return Array.from(stage2.runEnsemblePacket(prep, { ...work.spec, cascades: 20 }));
}

function lab(): Lab {
  const l = new Lab('test', 42);
  l.join('a', 'Ada');
  l.join('b', 'Ben');
  l.startCampaign('element120', 20);
  return l;
}

describe('Labor: Pakete von Stufe 2', () => {
  it('Kampagne Element 120: drei Reaktionen mal 16 Energien, in Pakete geteilt', () => {
    const view = lab().view(0);
    expect(view.campaign?.jobs.length).toBe(48);
    expect(new Set(view.campaign?.jobs.map((j) => j.reactionId))).toEqual(new Set(['Ti50+Cf249', 'Cr54+Cm248', 'V51+Bk249']));
    expect(view.campaign?.membersPerJob).toBe(20);
    expect(view.campaign?.totalDraws).toBe(48 * 20);
    expect(view.campaign?.verifiedDraws).toBe(0);
  });

  it('jedes Paket geht an zwei verschiedene Spieler und nie zweimal an denselben', () => {
    const l = lab();
    const a1 = l.nextPacket('a', 0)!;
    const b1 = l.nextPacket('b', 0)!;
    expect([a1.job, a1.packet]).toEqual([0, 0]);
    expect([b1.job, b1.packet]).toEqual([0, 0]); // dasselbe Paket für den zweiten Spieler
    const a2 = l.nextPacket('a', 0)!;
    expect([a2.job, a2.packet]).not.toEqual([0, 0]);
    expect(a1.spec.members).toBe(PACKET_SIZE);
  });

  it('zwei gleiche Ergebnisse bestätigen das Paket', () => {
    const l = lab();
    const a = l.nextPacket('a', 0)!;
    const b = l.nextPacket('b', 0)!;
    const values = compute(a);
    expect(l.submit('a', a.job, a.packet, values, 1)).toEqual({ accepted: true, verified: false, conflict: false });
    expect(l.view(1).campaign?.singleDraws).toBe(PACKET_SIZE);
    expect(l.submit('b', b.job, b.packet, compute(b), 2)).toEqual({ accepted: true, verified: true, conflict: false });
    const view = l.view(2);
    expect(view.campaign?.verifiedDraws).toBe(PACKET_SIZE);
    expect(view.campaign?.singleDraws).toBe(0);
    expect(view.players.map((p) => p.draws)).toEqual([PACKET_SIZE, PACKET_SIZE]);
  });

  it('ein gefälschtes Ergebnis wird nicht bestätigt; ein dritter Spieler entscheidet', () => {
    const l = lab();
    l.join('c', 'Cy');
    const a = l.nextPacket('a', 0)!;
    const b = l.nextPacket('b', 0)!;
    expect(l.nextPacket('c', 0)!.packet).not.toBe(a.packet); // erst zwei Rechner je Paket
    const honest = compute(a);
    const forged = honest.map((v, i) => (i === 3 ? v * 10 + 1 : v));
    l.submit('a', a.job, a.packet, forged, 1);
    expect(l.submit('b', b.job, b.packet, honest, 2)).toEqual({ accepted: true, verified: false, conflict: true });
    expect(l.view(2).campaign?.verifiedDraws).toBe(0);
    // Jetzt bekommt der dritte Spieler genau dieses Paket (Vorrang für strittige Pakete).
    let c = l.nextPacket('c', 3)!;
    while (c.job !== a.job || c.packet !== a.packet) c = l.nextPacket('c', 3)!;
    expect(l.submit('c', c.job, c.packet, compute(c), 4)).toEqual({ accepted: true, verified: true, conflict: false });
    const players = Object.fromEntries(l.view(4).players.map((p) => [p.name, p]));
    expect(players['Ada']!.rejected).toBe(1);
    expect(players['Ada']!.draws).toBe(0);
    expect(players['Ben']!.draws).toBe(PACKET_SIZE);
    expect(players['Cy']!.draws).toBe(PACKET_SIZE);
  });

  it('lehnt Ergebnisse ab, die nicht vergeben waren, doppelt kommen oder unsinnig sind', () => {
    const l = lab();
    const a = l.nextPacket('a', 0)!;
    const values = compute(a);
    expect(l.submit('b', a.job, a.packet, values, 1).accepted).toBe(false); // nicht an b vergeben
    expect(l.submit('a', a.job, a.packet, values.slice(1), 1)).toEqual({ accepted: false, verified: false, conflict: true });
    expect(l.submit('a', a.job, a.packet, values, 1).accepted).toBe(false); // Vergabe ist verbraucht
    expect(l.submit('a', 999, 0, values, 1).accepted).toBe(false);
    const again = l.nextPacket('b', 2)!;
    expect(l.submit('b', again.job, again.packet, compute(again).map(() => Number.NaN), 3).accepted).toBe(false);
  });

  it('ein allein rechnender Spieler kann nichts bestätigen', () => {
    const l = new Lab('solo', 1);
    l.join('a', 'Ada');
    l.startCampaign('element119', 10);
    const w = l.nextPacket('a', 0)!;
    expect(l.submit('a', w.job, w.packet, compute(w), 1).verified).toBe(false);
    expect(l.view(1).campaign?.verifiedDraws).toBe(0);
    expect(l.view(1).campaign?.singleDraws).toBe(PACKET_SIZE);
  });

  it('verlorene Pakete werden nach der Wartezeit neu vergeben; wer geht, gibt seine Pakete frei', () => {
    const l = lab();
    l.join('c', 'Cy');
    const a = l.nextPacket('a', 0)!;
    l.nextPacket('b', 0);
    expect(l.nextPacket('c', 1000)!.packet).not.toBe(a.packet);
    const later = l.nextPacket('c', ASSIGNMENT_TIMEOUT_MS + 2000)!;
    expect([later.job, later.packet]).toEqual([a.job, a.packet]);
    const l2 = lab();
    l2.join('c', 'Cy');
    const first = l2.nextPacket('a', 0)!;
    l2.nextPacket('b', 0);
    l2.leave('a');
    const freed = l2.nextPacket('c', 1)!;
    expect([freed.job, freed.packet]).toEqual([first.job, first.packet]);
    expect(l2.onlineCount).toBe(2);
  });

  it('bestätigte Pakete ergeben ein Band, dessen Unsicherheit mit jedem Paket schrumpft', () => {
    const l = new Lab('band', 3);
    l.join('a', 'Ada');
    l.join('b', 'Ben');
    l.startCampaign('element119', 80);
    const errors: number[] = [];
    for (let i = 0; i < 8; i++) {
      // nur das erste Ensemble abarbeiten
      const a = l.nextPacket('a', i)!;
      const b = l.nextPacket('b', i)!;
      expect(a.job).toBe(0);
      l.submit('a', a.job, a.packet, compute(a), i);
      l.submit('b', b.job, b.packet, compute(b), i);
      const job = l.view(i).campaign!.jobs[0]!;
      if (job.medianError_percent !== null) errors.push(job.medianError_percent);
    }
    const job = l.view(10).campaign!.jobs[0]!;
    expect(job.verified).toBe(80);
    expect(job.low_fb!).toBeLessThan(job.median_fb!);
    expect(job.high_fb!).toBeGreaterThan(job.median_fb!);
    expect(errors.length).toBeGreaterThan(3);
    expect(errors[errors.length - 1]!).toBeLessThan(errors[0]!);
  });
});

describe('Labor: gemeinsame Messreihe von Stufe 1', () => {
  const settings = (eStar: number, seed: number) => ({
    reactionId: 'Ti50+Cf249',
    eLab_MeV: eLabForExcitation('Ti50+Cf249', eStar),
    beamPerSecond: 6e12,
    thickness_mg_cm2: 0.44,
    beamTime_s: 300 * 86400,
    seed,
  });

  it('der Server rechnet die Messung selbst; alle Punkte landen in einer Reihe', () => {
    const l = lab();
    const r1 = l.addRun('a', settings(41, 1));
    l.addRun('b', settings(45, 2));
    expect(r1.eStar_MeV).toBeCloseTo(41, 6);
    expect(r1.hiddenNature).toBe(false);
    const view = l.view(0);
    expect(view.series.runs.map((r) => r.player)).toEqual(['Ada', 'Ben']);
    expect(view.series.runs[1]!.result.eStar_MeV).toBeCloseTo(45, 6);
  });

  it('verdeckte Natur bleibt auf dem Server, bis aufgelöst wird', () => {
    const l = lab();
    l.startSeries(true, 3141592653);
    const r = l.addRun('a', settings(41, 1));
    expect(r.hiddenNature).toBe(true);
    expect(l.view(0).series.hiddenSeed).toBeNull();
    expect(JSON.stringify(l.view(0))).not.toContain('3141592653');
    l.revealSeries();
    expect(l.view(0).series.hiddenSeed).toBe(3141592653);
    expect(() => l.addRun('a', settings(41, 2))).toThrow();
  });

  it('lehnt unsinnige Einstellungen ab', () => {
    const l = lab();
    expect(() => l.addRun('a', { ...settings(41, 1), beamPerSecond: 1e20 })).toThrow();
    expect(() => l.addRun('a', { ...settings(41, 1), beamTime_s: 1e12 })).toThrow();
    expect(() => l.addRun('a', { ...settings(41, 1), reactionId: 'Ti50+Pu244' })).toThrow();
    expect(() => l.addRun('unbekannt', settings(41, 1))).toThrow();
  });
});

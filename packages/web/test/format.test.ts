import { describe, expect, it } from 'vitest';
import { duration, fb, nuclideParts, nuclideText, num, sci } from '../src/format';

describe('Schreibweisen', () => {
  it('Zahlen mit Komma', () => {
    expect(num(286.63, 1)).toBe('286,6');
    expect(num(1000, 0)).toBe('1.000');
  });

  it('Wirkungsquerschnitt je nach Größe', () => {
    expect(fb(434.8)).toBe('435');
    expect(fb(93.2)).toBe('93,2');
    expect(fb(4.31)).toBe('4,3');
    expect(fb(0.447)).toBe('0,45');
  });

  it('Zeitspannen', () => {
    expect(duration(12e-6)).toBe('12 µs');
    expect(duration(4.4e-6)).toBe('4,4 µs');
    expect(duration(3.18e-3)).toBe('3,18 ms');
    expect(duration(0.1184)).toBe('118,4 ms');
    expect(duration(46)).toBe('46,0 s');
  });

  it('Zehnerpotenzen', () => {
    expect(sci(6e12)).toBe('6·10¹²');
    expect(sci(1.086e18, 2)).toBe('1,09·10¹⁸');
    expect(sci(1e12)).toBe('10¹²');
    expect(sci(9.99e12, 1)).toBe('1·10¹³');
  });

  it('Kerne', () => {
    expect(nuclideParts('295-120')).toEqual({ mass: '295', symbol: '120' });
    expect(nuclideParts('291Og')).toEqual({ mass: '291', symbol: 'Og' });
    expect(nuclideText('290Lv')).toBe('²⁹⁰Lv');
    expect(nuclideText('294-120')).toBe('²⁹⁴120');
  });
});

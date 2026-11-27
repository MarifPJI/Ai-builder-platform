import { describe, expect, it } from 'vitest';

import { isTestSchool, ratioPercent, schoolProgress } from './progress-calc';

describe('schoolProgress', () => {
  it('is 0% for a school with no classes', () => {
    expect(schoolProgress([])).toEqual({
      covered: 0,
      target: 30,
      percent: 0,
      classesAtTarget: 0,
      achieved: false,
    });
  });

  it('counts lessons across up to 3 classes', () => {
    const p = schoolProgress([4, 2, 0]);
    expect(p.covered).toBe(6);
    expect(p.percent).toBe(20);
    expect(p.achieved).toBe(false);
  });

  it('caps each class at 10 lessons', () => {
    expect(schoolProgress([15]).covered).toBe(10);
  });

  it('uses only the 3 best classes', () => {
    const p = schoolProgress([10, 1, 10, 3, 10]);
    expect(p.covered).toBe(30);
    expect(p.percent).toBe(100);
    expect(p.classesAtTarget).toBe(3);
    expect(p.achieved).toBe(true);
  });

  it('does not reach the target with only 2 complete classes', () => {
    const p = schoolProgress([10, 10]);
    expect(p.covered).toBe(20);
    expect(p.percent).toBe(67);
    expect(p.achieved).toBe(false);
  });

  it('ignores invalid values', () => {
    expect(schoolProgress([-3, Number.NaN, 2.9]).covered).toBe(2);
  });
});

describe('isTestSchool', () => {
  it('matches the test school regardless of case and spacing', () => {
    expect(isTestSchool('SMAN 10 Samarinda')).toBe(true);
    expect(isTestSchool('  sman 10 samarinda ')).toBe(true);
    expect(isTestSchool('SMAN 1 Karawang')).toBe(false);
  });
});

describe('ratioPercent', () => {
  it('returns null when there is nothing to divide by', () => {
    expect(ratioPercent(0, 0)).toBeNull();
  });

  it('rounds the percentage', () => {
    expect(ratioPercent(2, 3)).toBe(67);
  });
});

import { describe, it, expect } from 'vitest';
import type { GhostRequest, Place } from './types';
import {
  deadlineStatus,
  evaluatePair,
  explainUnresolved,
  solve,
  validateChoice,
  DataError,
} from './matching';
import { buildReport } from './report';

// Небольшие фабрики, чтобы тесты читались как сценарии, а не как заполнение полей.
function place(overrides: Partial<Place> = {}): Place {
  return {
    id: 'p',
    name: 'Место',
    capacity: 1,
    light: 2,
    noise: 2,
    humidity: 6,
    temperature: 8,
    hasHumans: false,
    hasAttic: true,
    hasMirrors: false,
    ...overrides,
  };
}

function ghost(overrides: Partial<GhostRequest> = {}): GhostRequest {
  return {
    id: 'g',
    name: 'Привидение',
    kind: 'дух',
    anxiety: 5,
    preferredTemp: 8,
    deadline: '2026-10-20',
    conditions: [],
    ...overrides,
  };
}

const NOW = '2026-10-16';

describe('evaluatePair — жёсткие ограничения', () => {
  it('отсекает место по нарушенному условию и объясняет причину', () => {
    const e = evaluatePair(
      ghost({ conditions: ['fears_mirrors'] }),
      place({ id: 'm', hasMirrors: true }),
    );
    expect(e.compatible).toBe(false);
    expect(e.score).toBe(0);
    expect(e.conflicts.map((c) => c.text)).toContain('есть зеркала');
  });

  it('собирает несколько конфликтов сразу', () => {
    const e = evaluatePair(
      ghost({ conditions: ['needs_dark', 'needs_silence', 'no_humans'] }),
      place({ light: 9, noise: 9, hasHumans: true }),
    );
    expect(e.conflicts).toHaveLength(3);
  });

  it('совместимое место получает ненулевой балл', () => {
    const e = evaluatePair(
      ghost({ preferredTemp: 8, anxiety: 5 }),
      place({ temperature: 8, noise: 0, light: 0 }),
    );
    expect(e.compatible).toBe(true);
    expect(e.score).toBeGreaterThan(0.9);
  });
});

describe('evaluatePair — скоринг', () => {
  it('идеальное совпадение даёт балл около 1', () => {
    const e = evaluatePair(
      ghost({ preferredTemp: 10, anxiety: 10 }),
      place({ temperature: 10, noise: 0, light: 0 }),
    );
    expect(e.score).toBeCloseTo(1, 5);
  });

  it('тревожное привидение сильнее штрафуется за шум, чем спокойное', () => {
    const noisy = place({ noise: 8, light: 0, temperature: 8 });
    const anxious = evaluatePair(ghost({ anxiety: 10 }), noisy);
    const calm = evaluatePair(ghost({ anxiety: 0 }), noisy);
    expect(calm.score).toBeGreaterThan(anxious.score);
  });

  it('штраф за температуру растёт с разбросом', () => {
    const near = evaluatePair(ghost({ preferredTemp: 8 }), place({ temperature: 9 }));
    const far = evaluatePair(ghost({ preferredTemp: 8 }), place({ temperature: 20 }));
    expect(near.score).toBeGreaterThan(far.score);
  });
});

describe('deadlineStatus', () => {
  it('различает просрочено / скоро / в норме', () => {
    expect(deadlineStatus('2026-10-10', NOW)).toBe('overdue');
    expect(deadlineStatus('2026-10-17', NOW)).toBe('soon');
    expect(deadlineStatus('2026-11-01', NOW)).toBe('ok');
  });

  it('бросает ошибку на некорректной дате', () => {
    expect(() => deadlineStatus('не-дата', NOW)).toThrow();
  });
});

describe('solve — автоматическое распределение', () => {
  it('пустой список заявок возвращает пустой результат без мест', () => {
    const r = solve({ requests: [], places: [place()], now: NOW });
    expect(r.outcomes).toHaveLength(0);
    expect(r.occupancy.p).toBe(0);
  });

  it('назначает совместимое место и объясняет выбор', () => {
    const r = solve({
      requests: [ghost({ conditions: ['needs_dark'] })],
      places: [place({ id: 'dark', light: 1 })],
      now: NOW,
    });
    expect(r.outcomes[0].assignedPlaceId).toBe('dark');
    const e = r.outcomes[0].evaluations[0];
    expect(e.summary).toMatch(/Сигнал/);
  });

  it('заявка без подходящего места остаётся без назначения', () => {
    const r = solve({
      requests: [ghost({ conditions: ['needs_attic'] })],
      places: [place({ id: 'no-attic', hasAttic: false })],
      now: NOW,
    });
    expect(r.outcomes[0].assignedPlaceId).toBeNull();
    const why = explainUnresolved(r.outcomes[0], r);
    expect(why.kind).toBe('no_match');
  });

  it('при нехватке вместимости часть заявок остаётся без места', () => {
    const r = solve({
      requests: [
        ghost({ id: 'a', deadline: '2026-10-17' }),
        ghost({ id: 'b', deadline: '2026-10-25' }),
      ],
      places: [place({ id: 'single', capacity: 1 })],
      now: NOW,
    });
    const assigned = r.outcomes.filter((o) => o.assignedPlaceId);
    expect(assigned).toHaveLength(1);
    // Более срочная (ближний дедлайн) должна получить место.
    expect(r.outcomes.find((o) => o.request.id === 'a')!.assignedPlaceId).toBe('single');
    const why = explainUnresolved(
      r.outcomes.find((o) => o.request.id === 'b')!,
      r,
    );
    expect(why.kind).toBe('all_full');
  });

  it('просроченные заявки распределяются раньше несрочных', () => {
    const r = solve({
      requests: [
        ghost({ id: 'future', deadline: '2026-12-01', anxiety: 10 }),
        ghost({ id: 'overdue', deadline: '2026-10-01', anxiety: 1 }),
      ],
      places: [place({ id: 'single', capacity: 1 })],
      now: NOW,
    });
    expect(r.outcomes.find((o) => o.request.id === 'overdue')!.assignedPlaceId).toBe('single');
  });
});

describe('solve — ручные решения', () => {
  it('ручной выбор переопределяет автоматический', () => {
    const r = solve({
      requests: [ghost()],
      places: [place({ id: 'a', temperature: 8 }), place({ id: 'b', temperature: 8 })],
      now: NOW,
      manual: { g: 'b' },
    });
    expect(r.outcomes[0].assignedPlaceId).toBe('b');
    expect(r.outcomes[0].manual).toBe(true);
  });

  it('ручной выбор может переполнить место, но это отражается в занятости', () => {
    const r = solve({
      requests: [ghost({ id: 'a' }), ghost({ id: 'b' })],
      places: [place({ id: 'tiny', capacity: 1 })],
      now: NOW,
      manual: { a: 'tiny', b: 'tiny' },
    });
    expect(r.occupancy.tiny).toBe(2);
    const report = buildReport(r);
    expect(report.overloaded).toHaveLength(1);
  });
});

describe('validateChoice — проверка ручного выбора', () => {
  it('ругается на нарушение условия', () => {
    const r = solve({
      requests: [ghost({ conditions: ['fears_mirrors'] })],
      places: [place({ id: 'mirror', hasMirrors: true })],
      now: NOW,
      manual: { g: 'mirror' },
    });
    const warnings = validateChoice(r.outcomes[0], 'mirror', r);
    expect(warnings.some((w) => w.severity === 'error' && /зеркал/.test(w.text))).toBe(true);
  });

  it('предупреждает о переполнении', () => {
    const r = solve({
      requests: [ghost({ id: 'a' }), ghost({ id: 'b' })],
      places: [place({ id: 'tiny', capacity: 1 })],
      now: NOW,
      manual: { a: 'tiny', b: 'tiny' },
    });
    const warnings = validateChoice(r.outcomes[1], 'tiny', r);
    expect(warnings.some((w) => /переполнено/.test(w.text))).toBe(true);
  });

  it('подсказывает более сильный вариант при неоптимальном выборе', () => {
    const r = solve({
      requests: [ghost({ preferredTemp: 8 })],
      places: [
        place({ id: 'good', temperature: 8, capacity: 5 }),
        place({ id: 'meh', temperature: 20, capacity: 5 }),
      ],
      now: NOW,
      manual: { g: 'meh' },
    });
    const warnings = validateChoice(r.outcomes[0], 'meh', r);
    expect(warnings.some((w) => w.severity === 'warning' && /сильнее/.test(w.text))).toBe(true);
  });

  it('безопасный выбор не даёт предупреждений', () => {
    const r = solve({
      requests: [ghost({ preferredTemp: 8 })],
      places: [place({ id: 'good', temperature: 8, light: 0, noise: 0, capacity: 5 })],
      now: NOW,
      manual: { g: 'good' },
    });
    expect(validateChoice(r.outcomes[0], 'good', r)).toHaveLength(0);
  });
});

describe('buildReport — финальный отчёт', () => {
  it('считает расселённых, оставшихся и перегруженные места', () => {
    const r = solve({
      requests: [
        ghost({ id: 'a', conditions: [] }),
        ghost({ id: 'b', conditions: ['needs_attic'] }),
      ],
      places: [place({ id: 'ok', capacity: 1, hasAttic: false })],
      now: NOW,
    });
    const report = buildReport(r);
    expect(report.total).toBe(2);
    expect(report.assignedCount).toBe(1);
    expect(report.unresolvedCount).toBe(1);
    expect(report.problems.length).toBeGreaterThan(0);
    // Самая проблемная — заявка без места.
    expect(report.problems[0].outcome.request.id).toBe('b');
  });

  it('помечает просроченные заявки как проблемные', () => {
    const r = solve({
      requests: [ghost({ id: 'late', deadline: '2026-01-01' })],
      places: [place({ id: 'ok', capacity: 1 })],
      now: NOW,
    });
    const report = buildReport(r);
    expect(report.overdueCount).toBe(1);
    expect(report.problems[0].reasons).toContain('дедлайн просрочен');
  });
});

describe('validateData — защита от битых данных', () => {
  it('ловит дубликаты id мест', () => {
    expect(() =>
      solve({
        requests: [],
        places: [place({ id: 'dup' }), place({ id: 'dup' })],
        now: NOW,
      }),
    ).toThrow(DataError);
  });

  it('ловит неизвестное условие в заявке', () => {
    expect(() =>
      solve({
        requests: [ghost({ conditions: ['teleport' as never] })],
        places: [place()],
        now: NOW,
      }),
    ).toThrow(DataError);
  });
});

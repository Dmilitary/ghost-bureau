import type {
  DeadlineStatus,
  GhostRequest,
  Place,
} from './types';
import { CONDITIONS } from './conditions';

// ── Настройки скоринга ───────────────────────────────────────────────
// Формула простая и объяснимая: три фактора комфорта с фиксированными
// весами. Жёсткие ограничения (условия заявки) проверяются отдельно —
// они либо отсекают место полностью, либо не влияют на балл.

/** Разброс температуры (°C), на котором комфорт падает с 1 до 0. */
export const TEMP_TOLERANCE = 12;

export const WEIGHTS = {
  temp: 0.45, // температурный комфорт
  calm: 0.35, // акустический покой (важнее для тревожных)
  dark: 0.2, // привидения в среднем любят темноту
} as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ── Результаты оценки ────────────────────────────────────────────────

export interface ConflictReason {
  /** Какое условие нарушено (если конфликт из-за условия заявки). */
  conditionId?: string;
  text: string;
}

export interface ScoreFactor {
  key: 'temp' | 'calm' | 'dark';
  label: string;
  /** Чистое значение фактора, 0..1. */
  value: number;
  /** Вес фактора в итоговом балле. */
  weight: number;
  /** Человекочитаемое пояснение. */
  detail: string;
}

export interface Evaluation {
  placeId: string;
  compatible: boolean;
  /** Итоговый балл 0..1 («сила сигнала»). У несовместимых — 0. */
  score: number;
  conflicts: ConflictReason[];
  factors: ScoreFactor[];
  /** Краткое объяснение для оператора. */
  summary: string;
}

/**
 * Оценивает пару «заявка × место»: собирает жёсткие конфликты и,
 * если место совместимо, считает балл по трём факторам.
 */
export function evaluatePair(
  request: GhostRequest,
  place: Place,
): Evaluation {
  const conflicts: ConflictReason[] = [];
  for (const id of request.conditions) {
    const def = CONDITIONS[id];
    const reason = def.conflict(place);
    if (reason) conflicts.push({ conditionId: id, text: reason });
  }

  const tempDelta = Math.abs(place.temperature - request.preferredTemp);
  const tempFit = clamp01(1 - tempDelta / TEMP_TOLERANCE);

  // Чем тревожнее привидение, тем сильнее его беспокоит шум.
  const noiseSensitivity = 0.5 + 0.5 * (request.anxiety / 10);
  const calm = clamp01(1 - (place.noise / 10) * noiseSensitivity);

  const dark = clamp01(1 - place.light / 10);

  const factors: ScoreFactor[] = [
    {
      key: 'temp',
      label: 'Температура',
      value: tempFit,
      weight: WEIGHTS.temp,
      detail: `место ${place.temperature}°C против желаемых ${request.preferredTemp}°C (разброс ${tempDelta}°)`,
    },
    {
      key: 'calm',
      label: 'Покой',
      value: calm,
      weight: WEIGHTS.calm,
      detail: `шум ${place.noise}/10 при тревожности ${request.anxiety}/10`,
    },
    {
      key: 'dark',
      label: 'Темнота',
      value: dark,
      weight: WEIGHTS.dark,
      detail: `освещение ${place.light}/10`,
    },
  ];

  const compatible = conflicts.length === 0;
  const score = compatible
    ? factors.reduce((sum, f) => sum + f.value * f.weight, 0)
    : 0;

  const summary = compatible
    ? buildMatchSummary(factors, score)
    : `Не подходит: ${conflicts.map((c) => c.text).join(', ')}.`;

  return { placeId: place.id, compatible, score, conflicts, factors, summary };
}

function buildMatchSummary(factors: ScoreFactor[], score: number): string {
  // Берём самый сильный и самый слабый факторы для живого объяснения.
  const sorted = [...factors].sort((a, b) => b.value - a.value);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const pct = Math.round(score * 100);
  if (worst.value >= 0.75) {
    return `Сигнал ${pct}%: ${best.label.toLowerCase()} и остальное в норме.`;
  }
  return `Сигнал ${pct}%: сильная сторона — ${best.label.toLowerCase()}, слабое место — ${worst.label.toLowerCase()}.`;
}

// ── Дедлайны ─────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(deadline: string, now: string): number {
  const d = Date.parse(`${deadline}T00:00:00Z`);
  const n = Date.parse(`${now}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(n)) {
    throw new Error(`Некорректная дата: deadline="${deadline}", now="${now}"`);
  }
  return Math.round((d - n) / DAY_MS);
}

export function deadlineStatus(deadline: string, now: string): DeadlineStatus {
  const days = daysUntil(deadline, now);
  if (days < 0) return 'overdue';
  if (days <= 2) return 'soon';
  return 'ok';
}

// ── Решение (назначение мест) ────────────────────────────────────────

export interface RequestOutcome {
  request: GhostRequest;
  /** Оценки всех мест, отсортированы: совместимые по убыванию балла, затем несовместимые. */
  evaluations: Evaluation[];
  assignedPlaceId: string | null;
  /** Назначение выставлено вручную оператором. */
  manual: boolean;
  deadlineStatus: DeadlineStatus;
}

export interface SolveResult {
  outcomes: RequestOutcome[];
  /** placeId → сколько привидений фактически назначено. */
  occupancy: Record<string, number>;
  places: Place[];
  now: string;
}

export interface SolveInput {
  requests: GhostRequest[];
  places: Place[];
  now: string;
  /**
   * Ручные решения оператора: requestId → placeId, либо null — явно
   * оставить без места. Ключи, которых здесь нет, распределяются автоматически.
   */
  manual?: Record<string, string | null>;
}

function sortEvaluations(evals: Evaluation[]): Evaluation[] {
  return [...evals].sort((a, b) => {
    if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
    return b.score - a.score;
  });
}

/**
 * Основной решатель. Сначала применяет ручные решения (они приоритетны и
 * могут нарушать правила — оператор всегда прав, но его предупредят),
 * затем жадно распределяет остальных по убыванию срочности.
 */
export function solve(input: SolveInput): SolveResult {
  const { requests, places, now } = input;
  const manual = input.manual ?? {};

  validateData(requests, places);

  const placeById = new Map(places.map((p) => [p.id, p]));
  const occupancy: Record<string, number> = {};
  for (const p of places) occupancy[p.id] = 0;

  // Предрассчитываем оценки всех пар один раз.
  const evalsByRequest = new Map<string, Evaluation[]>();
  for (const r of requests) {
    evalsByRequest.set(
      r.id,
      sortEvaluations(places.map((p) => evaluatePair(r, p))),
    );
  }

  const assigned: Record<string, string | null> = {};
  const isManual: Record<string, boolean> = {};

  // Фаза 1. Ручные решения.
  for (const r of requests) {
    if (!(r.id in manual)) continue;
    const choice = manual[r.id];
    isManual[r.id] = true;
    if (choice && placeById.has(choice)) {
      assigned[r.id] = choice;
      occupancy[choice] += 1; // может превысить вместимость — это осознанно
    } else {
      assigned[r.id] = null;
    }
  }

  // Фаза 2. Автоматическое распределение остальных по срочности.
  const auto = requests
    .filter((r) => !(r.id in manual))
    .sort(byUrgency(now));

  for (const r of auto) {
    const evals = evalsByRequest.get(r.id)!;
    const candidate = evals.find(
      (e) => e.compatible && occupancy[e.placeId] < placeById.get(e.placeId)!.capacity,
    );
    if (candidate) {
      assigned[r.id] = candidate.placeId;
      occupancy[candidate.placeId] += 1;
    } else {
      assigned[r.id] = null;
    }
  }

  const outcomes: RequestOutcome[] = requests.map((r) => ({
    request: r,
    evaluations: evalsByRequest.get(r.id)!,
    assignedPlaceId: assigned[r.id] ?? null,
    manual: Boolean(isManual[r.id]),
    deadlineStatus: deadlineStatus(r.deadline, now),
  }));

  return { outcomes, occupancy, places, now };
}

/** Срочность: сперва просроченные, затем ближний дедлайн, затем тревожность. */
function byUrgency(now: string) {
  return (a: GhostRequest, b: GhostRequest): number => {
    const da = daysUntil(a.deadline, now);
    const db = daysUntil(b.deadline, now);
    if (da !== db) return da - db;
    if (a.anxiety !== b.anxiety) return b.anxiety - a.anxiety;
    return a.id.localeCompare(b.id);
  };
}

// ── Объяснение провала и проверка ручного выбора ─────────────────────

export interface UnresolvedReason {
  kind: 'all_full' | 'no_match';
  text: string;
  /** Для no_match — по одному отклонённому варианту с причиной. */
  rejections?: { placeName: string; reasons: string[] }[];
}

/** Почему заявку не удалось закрыть: нет совместимых мест или все заполнены. */
export function explainUnresolved(
  outcome: RequestOutcome,
  result: SolveResult,
): UnresolvedReason {
  const placeById = new Map(result.places.map((p) => [p.id, p]));
  const compatible = outcome.evaluations.filter((e) => e.compatible);

  if (compatible.length > 0) {
    return {
      kind: 'all_full',
      text: 'Все подходящие места заполнены.',
      rejections: compatible.map((e) => ({
        placeName: placeById.get(e.placeId)!.name,
        reasons: [
          `занято ${result.occupancy[e.placeId]} из ${placeById.get(e.placeId)!.capacity}`,
        ],
      })),
    };
  }

  return {
    kind: 'no_match',
    text: 'Ни одно место не отвечает особым условиям.',
    rejections: outcome.evaluations.map((e) => ({
      placeName: placeById.get(e.placeId)!.name,
      reasons: e.conflicts.map((c) => c.text),
    })),
  };
}

export interface ChoiceWarning {
  severity: 'error' | 'warning';
  text: string;
}

/**
 * Проверяет ручной выбор места и возвращает список предупреждений.
 * Пустой список — выбор безопасен.
 */
export function validateChoice(
  outcome: RequestOutcome,
  placeId: string,
  result: SolveResult,
): ChoiceWarning[] {
  const place = result.places.find((p) => p.id === placeId);
  if (!place) {
    return [{ severity: 'error', text: 'Такого места не существует.' }];
  }

  const evaluation = outcome.evaluations.find((e) => e.placeId === placeId)!;
  const warnings: ChoiceWarning[] = [];

  // Жёсткие конфликты по условиям.
  for (const c of evaluation.conflicts) {
    warnings.push({ severity: 'error', text: `Нарушено условие: ${c.text}.` });
  }

  // Переполнение: считаем занятость без учёта этой заявки.
  const alreadyHere = outcome.assignedPlaceId === placeId ? 1 : 0;
  const othersHere = result.occupancy[placeId] - alreadyHere;
  if (othersHere >= place.capacity) {
    warnings.push({
      severity: 'error',
      text: `Место переполнено: занято ${othersHere} из ${place.capacity}.`,
    });
  }

  // Есть ли совместимый вариант со свободным местом и более сильным сигналом.
  if (evaluation.compatible) {
    const better = outcome.evaluations.find((e) => {
      if (!e.compatible || e.placeId === placeId) return false;
      const p = result.places.find((x) => x.id === e.placeId)!;
      const free = result.occupancy[e.placeId] < p.capacity;
      return free && e.score > evaluation.score + 0.001;
    });
    if (better) {
      const p = result.places.find((x) => x.id === better.placeId)!;
      warnings.push({
        severity: 'warning',
        text: `Есть вариант сильнее: ${p.name} — сигнал ${Math.round(better.score * 100)}% против ${Math.round(evaluation.score * 100)}%.`,
      });
    }
  }

  return warnings;
}

// ── Защита от некорректных данных ────────────────────────────────────

export class DataError extends Error {}

export function validateData(requests: GhostRequest[], places: Place[]): void {
  const placeIds = new Set<string>();
  for (const p of places) {
    if (placeIds.has(p.id)) throw new DataError(`Дубликат id места: ${p.id}`);
    placeIds.add(p.id);
    if (p.capacity < 0) {
      throw new DataError(`Отрицательная вместимость у места «${p.name}».`);
    }
  }
  const reqIds = new Set<string>();
  for (const r of requests) {
    if (reqIds.has(r.id)) throw new DataError(`Дубликат id заявки: ${r.id}`);
    reqIds.add(r.id);
    for (const c of r.conditions) {
      if (!CONDITIONS[c as keyof typeof CONDITIONS]) {
        throw new DataError(
          `Заявка «${r.name}» ссылается на неизвестное условие: ${c}.`,
        );
      }
    }
  }
}

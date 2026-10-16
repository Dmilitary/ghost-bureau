import type { ConditionId, Place } from './types';

// Пороговые значения, при которых место считается «слишком …».
// Вынесены в одно место, чтобы и движок, и интерфейс говорили одинаково.
export const THRESHOLDS = {
  /** Светлее этого — «слишком светло» для боящихся света. */
  darkMaxLight: 4,
  /** Шумнее этого — «слишком шумно» для требующих тишины. */
  quietMaxNoise: 4,
  /** Суше этого — «слишком сухо» для любящих сырость. */
  dampMinHumidity: 5,
} as const;

export interface ConditionDef {
  id: ConditionId;
  /** Как условие читается в заявке: «боится зеркал». */
  label: string;
  /** Короткая метка-требование для интерфейса: «темно». */
  tag: string;
  /**
   * Проверка жёсткого ограничения. Возвращает причину конфликта,
   * если место нарушает условие, иначе null.
   */
  conflict: (place: Place) => string | null;
}

export const CONDITIONS: Record<ConditionId, ConditionDef> = {
  needs_attic: {
    id: 'needs_attic',
    label: 'нужен чердак',
    tag: 'чердак',
    conflict: (p) => (p.hasAttic ? null : 'нет чердака'),
  },
  fears_mirrors: {
    id: 'fears_mirrors',
    label: 'боится зеркал',
    tag: 'без зеркал',
    conflict: (p) => (p.hasMirrors ? 'есть зеркала' : null),
  },
  no_humans: {
    id: 'no_humans',
    label: 'нельзя рядом с людьми',
    tag: 'без людей',
    conflict: (p) => (p.hasHumans ? 'рядом живут люди' : null),
  },
  loves_damp: {
    id: 'loves_damp',
    label: 'любит сырость',
    tag: 'сырость',
    conflict: (p) =>
      p.humidity < THRESHOLDS.dampMinHumidity
        ? `слишком сухо (${p.humidity}/10)`
        : null,
  },
  needs_dark: {
    id: 'needs_dark',
    label: 'нужна темнота',
    tag: 'темно',
    conflict: (p) =>
      p.light > THRESHOLDS.darkMaxLight
        ? `слишком светло (${p.light}/10)`
        : null,
  },
  needs_silence: {
    id: 'needs_silence',
    label: 'нужна тишина',
    tag: 'тишина',
    conflict: (p) =>
      p.noise > THRESHOLDS.quietMaxNoise
        ? `слишком шумно (${p.noise}/10)`
        : null,
  },
};

export const CONDITION_LIST: ConditionDef[] = Object.values(CONDITIONS);

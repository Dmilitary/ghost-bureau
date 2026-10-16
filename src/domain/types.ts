// Доменная модель бюро переселения привидений.
// Единицы измерения специально простые и человекочитаемые,
// чтобы движок подбора оставался объяснимым.

/** Особые условия заявки. Каждое условие — это жёсткое требование к месту. */
export type ConditionId =
  | 'needs_attic' // нужен чердак
  | 'fears_mirrors' // боится зеркал
  | 'no_humans' // нельзя селить рядом с людьми
  | 'loves_damp' // любит сырость
  | 'needs_dark' // нужна темнота
  | 'needs_silence'; // нужна тишина

/** Заявка от привидения. */
export interface GhostRequest {
  id: string;
  /** Имя привидения, напр. «Леди в Белом». */
  name: string;
  /** Короткое описание типа, флавор для оператора. */
  kind: string;
  /** Уровень тревожности, 0 (спокоен) … 10 (на грани). */
  anxiety: number;
  /** Любимая температура, °C. */
  preferredTemp: number;
  /** Дедлайн переселения, ISO-дата (YYYY-MM-DD). */
  deadline: string;
  /** Особые условия. */
  conditions: ConditionId[];
  /** Необязательная заметка оператора / флавор. */
  note?: string;
}

/** Место переселения. */
export interface Place {
  id: string;
  name: string;
  /** Сколько привидений вмещает. */
  capacity: number;
  /** Освещение, 0 (кромешная тьма) … 10 (слепящий свет). */
  light: number;
  /** Уровень шума, 0 (гробовая тишина) … 10 (грохот). */
  noise: number;
  /** Влажность, 0 (сухо как в пустыне) … 10 (сыро, капает со стен). */
  humidity: number;
  /** Температура, °C. */
  temperature: number;
  /** Рядом живут люди. */
  hasHumans: boolean;
  /** Есть чердак. */
  hasAttic: boolean;
  /** Есть зеркала. */
  hasMirrors: boolean;
  /** Необязательная заметка / флавор. */
  note?: string;
}

export type DeadlineStatus = 'ok' | 'soon' | 'overdue';

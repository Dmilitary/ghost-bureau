import type { GhostRequest, Place } from '../domain/types';

// Точка отсчёта времени для дедлайнов.
// Фиксируем «сегодня», чтобы демонстрация дедлайнов была воспроизводимой
// и не «протухала» со временем. Интерфейс берёт now() именно отсюда.
export const NOW = '2026-10-16';

/**
 * Места переселения. Параметры подобраны так, чтобы в связке с заявками
 * воспроизводились все обязательные состояния: подходящее место, конфликт
 * по условию, переполнение, отсутствие варианта.
 */
export const SEED_PLACES: Place[] = [
  {
    id: 'lighthouse',
    name: 'Старый маяк',
    capacity: 2,
    light: 7, // вращающийся фонарь — светло
    noise: 2,
    humidity: 6,
    temperature: 6,
    hasHumans: false,
    hasAttic: true,
    hasMirrors: false,
    note: 'Фонарь гасят редко. Боящимся света — мимо.',
  },
  {
    id: 'castle',
    name: 'Замок Вересковых',
    capacity: 3,
    light: 3,
    noise: 2,
    humidity: 7,
    temperature: 4,
    hasHumans: false,
    hasAttic: true,
    hasMirrors: true, // зеркальный зал
    note: 'Тихо и прохладно, но зеркальный зал никто не демонтировал.',
  },
  {
    id: 'library',
    name: 'Городская библиотека',
    capacity: 4,
    light: 5,
    noise: 1, // тишина обязательна
    humidity: 3, // сухо для сохранности книг
    temperature: 18,
    hasHumans: true, // читатели днём
    hasAttic: false,
    hasMirrors: false,
    note: 'Идеальная тишина, но днём полно живых и сухой воздух.',
  },
  {
    id: 'theatre',
    name: 'Заброшенный театр',
    capacity: 2,
    light: 2,
    noise: 6, // скрипы, эхо, хлопающие двери
    humidity: 5,
    temperature: 10,
    hasHumans: false,
    hasAttic: true,
    hasMirrors: true, // гримёрные зеркала
    note: 'Атмосферно, но шумно и всюду гримёрные зеркала.',
  },
  {
    id: 'basement',
    name: 'Подвал старой типографии',
    capacity: 3,
    light: 1, // кромешная тьма
    noise: 3,
    humidity: 9, // сыро, капает со стен
    temperature: 8,
    hasHumans: false,
    hasAttic: false,
    hasMirrors: false,
    note: 'Темно и сыро — мечта меланхоличного привидения.',
  },
  {
    id: 'townhall-attic',
    name: 'Чердак ратуши',
    capacity: 1, // всего одно место — удобно для демонстрации переполнения
    light: 2,
    noise: 2,
    humidity: 2, // сухо
    temperature: 5,
    hasHumans: false,
    hasAttic: true,
    hasMirrors: false,
    note: 'Уютный чердак, но вмещает лишь одного и воздух сухой.',
  },
];

/**
 * Заявки от привидений. Подобраны под демонстрацию:
 *  - «Леди в Белом» — чистое совпадение с подвалом;
 *  - «Болотный огонёк» — конкурирует за подвал (сырость);
 *  - «Старый смотритель» — ни одно место не подходит (невозможное переселение);
 *  - несколько заявок на чердак — провоцируют переполнение;
 *  - просроченный дедлайн у «Горничной».
 */
export const SEED_REQUESTS: GhostRequest[] = [
  {
    id: 'lady',
    name: 'Леди в Белом',
    kind: 'Классический семейный призрак',
    anxiety: 8,
    preferredTemp: 8,
    deadline: '2026-10-18', // скоро
    conditions: ['fears_mirrors', 'needs_dark'],
    note: 'Бродит по коридорам. Зеркала приводят её в ужас.',
  },
  {
    id: 'bog-light',
    name: 'Болотный огонёк',
    kind: 'Блуждающий дух трясины',
    anxiety: 4,
    preferredTemp: 9,
    deadline: '2026-10-25',
    conditions: ['loves_damp'],
    note: 'Гаснет в сухом воздухе. Нужна сырость.',
  },
  {
    id: 'poltergeist',
    name: 'Стучащий дух',
    kind: 'Полтергейст',
    anxiety: 9,
    preferredTemp: 12,
    deadline: '2026-10-17', // почти горит
    conditions: ['needs_silence'],
    note: 'Сам шумит, но чужой шум выводит из себя.',
  },
  {
    id: 'maid',
    name: 'Горничная с чёрной лестницы',
    kind: 'Призрак прислуги',
    anxiety: 6,
    preferredTemp: 5,
    deadline: '2026-10-10', // просрочено
    conditions: ['no_humans', 'needs_dark'],
    note: 'Избегает живых. Дедлайн уже прошёл — разобрать в первую очередь.',
  },
  {
    id: 'attic-rustle',
    name: 'Чердачный шорох',
    kind: 'Домовой-отшельник',
    anxiety: 3,
    preferredTemp: 5,
    deadline: '2026-10-28',
    conditions: ['needs_attic'],
    note: 'Селится только под крышей.',
  },
  {
    id: 'twins',
    name: 'Близнецы с чердака',
    kind: 'Парный детский призрак',
    anxiety: 5,
    preferredTemp: 6,
    deadline: '2026-10-22',
    conditions: ['needs_attic'],
    note: 'Тоже претендуют на чердак — мест на всех не хватит.',
  },
  {
    id: 'keeper',
    name: 'Старый смотритель',
    kind: 'Призрак-перфекционист',
    anxiety: 7,
    preferredTemp: 7,
    deadline: '2026-10-30',
    conditions: [
      'needs_attic',
      'fears_mirrors',
      'needs_dark',
      'needs_silence',
      'loves_damp',
      'no_humans',
    ],
    note: 'Требует всё сразу: тёмный сырой тихий чердак без зеркал и людей. Таких мест нет.',
  },
];

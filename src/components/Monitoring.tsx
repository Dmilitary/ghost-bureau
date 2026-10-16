import type { Bureau } from '../state/useBureau';
import type { RequestOutcome } from '../domain/matching';
import { buildReport } from '../domain/report';

/**
 * Экран мониторинга — «диспетчерское табло» всего расселения: куда кто
 * заселён, насколько загружено каждое место и кто остался без крыши.
 * Отвечает на вопрос «что у нас в целом», в отличие от аналитического отчёта.
 */
export function Monitoring({ bureau }: { bureau: Bureau }) {
  const { result, error } = bureau;

  if (error || !result) {
    return (
      <div className="error" role="alert">
        <h2 className="error__title">⚠ Мониторинг недоступен</h2>
        <p className="error__msg">
          Данные смены не обработаны. Вернитесь в диспетчерскую и восстановите
          данные.
        </p>
        <div className="error__detail">{error ?? 'Нет данных.'}</div>
      </div>
    );
  }

  const report = buildReport(result);

  if (report.total === 0) {
    return (
      <div className="empty">
        <div className="empty__art">∅</div>
        <div className="empty__title">Табло пустое</div>
        <div>Заявок нет — расселять некого. Вернитесь в диспетчерскую.</div>
      </div>
    );
  }

  // Кто куда заселён.
  const byPlace = new Map<string, RequestOutcome[]>();
  for (const p of result.places) byPlace.set(p.id, []);
  for (const o of result.outcomes) {
    if (o.assignedPlaceId) byPlace.get(o.assignedPlaceId)?.push(o);
  }
  const unplaced = result.outcomes.filter((o) => !o.assignedPlaceId);

  const occupiedSlots = Object.values(result.occupancy).reduce(
    (a, b) => a + b,
    0,
  );
  const totalSlots = result.places.reduce((a, p) => a + p.capacity, 0);

  return (
    <div>
      <p className="wl__intro">
        Диспетчерское табло смены на {result.now}. Обзор всего расселения в
        реальном времени: загрузка мест и список без крыши.
      </p>

      <div className="mon-kpis">
        <Kpi
          value={`${report.assignedCount}/${report.total}`}
          label="расселено"
          tone="signal"
        />
        <Kpi value={`${occupiedSlots}/${totalSlots}`} label="мест занято" />
        <Kpi
          value={report.overloaded.length}
          label="перегружено"
          tone={report.overloaded.length > 0 ? 'alarm' : 'plain'}
        />
        <Kpi
          value={unplaced.length}
          label="без места"
          tone={unplaced.length > 0 ? 'alarm' : 'plain'}
        />
        <Kpi
          value={report.overdueCount}
          label="просрочено"
          tone={report.overdueCount > 0 ? 'alarm' : 'plain'}
        />
      </div>

      <div className="panel mon-chart">
        <div className="panel__head">
          <span className="panel__title">Заполняемость мест</span>
          <span className="panel__title">
            занято {occupiedSlots} из {totalSlots}
          </span>
        </div>
        <div className="panel__body mon-chart__body">
          <FillDonut
            occupied={occupiedSlots}
            total={totalSlots}
            overloaded={report.overloaded.length}
          />
          <div className="mon-legend">
            <div className="mon-legend__row">
              <span className="mon-legend__sw" style={{ background: 'var(--green)' }} />
              <span className="mon-legend__lbl">Занято</span>
              <span className="mon-legend__val">{occupiedSlots}</span>
            </div>
            <div className="mon-legend__row">
              <span
                className="mon-legend__sw"
                style={{ background: 'var(--surface-3)' }}
              />
              <span className="mon-legend__lbl">Свободно</span>
              <span className="mon-legend__val">
                {Math.max(totalSlots - occupiedSlots, 0)}
              </span>
            </div>
            {report.overloaded.length > 0 && (
              <div className="mon-legend__row">
                <span className="mon-legend__sw" style={{ background: 'var(--red)' }} />
                <span className="mon-legend__lbl">Перегружено мест</span>
                <span className="mon-legend__val">{report.overloaded.length}</span>
              </div>
            )}
            <p className="mon-legend__cap">
              Свободных слотов хватает, но подойдут не всем — место должно
              отвечать условиям привидения.
            </p>
          </div>
        </div>
      </div>

      <div className="mon-board">
        {result.places.map((place) => {
          const occ = byPlace.get(place.id) ?? [];
          const used = result.occupancy[place.id] ?? 0;
          const state =
            used > place.capacity
              ? 'over'
              : used === place.capacity && place.capacity > 0
                ? 'full'
                : 'free';
          const slots = Math.max(place.capacity, used);
          return (
            <div className={`mon-place mon-place--${state}`} key={place.id}>
              <div className="mon-place__head">
                <span className="mon-place__name">{place.name}</span>
                <span className={`mon-place__state mon-place__state--${state}`}>
                  {used}/{place.capacity}{' '}
                  {state === 'over'
                    ? 'перегружено'
                    : state === 'full'
                      ? 'заполнено'
                      : 'есть места'}
                </span>
              </div>
              <div className="bar">
                {Array.from({ length: slots }).map((_, i) => (
                  <div
                    key={i}
                    className={`bar__fill ${
                      i >= place.capacity
                        ? 'bar__fill--over'
                        : state === 'full'
                          ? 'bar__fill--full'
                          : ''
                    }`}
                    style={{ flex: 1, opacity: i < used ? 1 : 0.12 }}
                  />
                ))}
              </div>
              <div className="mon-occ-list">
                {occ.length === 0 ? (
                  <div className="mon-empty">— свободно —</div>
                ) : (
                  occ.map((o) => <Occupant key={o.request.id} outcome={o} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unplaced.length > 0 && (
        <div className="panel mon-watch">
          <div className="panel__head">
            <span className="panel__title">
              Без места — требуют решения <b>{unplaced.length}</b>
            </span>
          </div>
          <div className="panel__body">
            {unplaced.map((o) => (
              <div className="mon-watch__row" key={o.request.id}>
                <span className="mon-watch__name">✖ {o.request.name}</span>
                <span className="mon-watch__why">
                  {o.deadlineStatus === 'overdue' && 'дедлайн просрочен · '}
                  ни одно место не подходит
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Occupant({ outcome }: { outcome: RequestOutcome }) {
  const evaluation = outcome.evaluations.find(
    (e) => e.placeId === outcome.assignedPlaceId,
  );
  const compatible = evaluation?.compatible ?? false;
  const pct = Math.round((evaluation?.score ?? 0) * 100);
  return (
    <div className="mon-occ">
      <span className={`mon-occ__dot ${compatible ? '' : 'mon-occ__dot--bad'}`} />
      <span className="mon-occ__name">{outcome.request.name}</span>
      {outcome.manual && <span className="mon-occ__tag">вручную</span>}
      <span className={`mon-occ__pct ${compatible ? '' : 'mon-occ__pct--bad'}`}>
        {compatible ? `${pct}%` : 'конфликт'}
      </span>
    </div>
  );
}

function FillDonut({
  occupied,
  total,
  overloaded,
}: {
  occupied: number;
  total: number;
  overloaded: number;
}) {
  const size = 168;
  const sw = 20;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const denom = Math.max(total, occupied, 1);
  const ratio = Math.min(occupied / denom, 1);
  const pct = Math.round((occupied / Math.max(total, 1)) * 100);
  const dash = circ * ratio;
  const arcColor = overloaded > 0 ? 'var(--red)' : 'var(--green)';

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Занято ${occupied} из ${total} мест, ${pct} процентов`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={sw}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arcColor}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="donut__center">
        <div className="donut__pct">{pct}%</div>
        <div className="donut__sub">занято</div>
      </div>
    </div>
  );
}

function Kpi({
  value,
  label,
  tone = 'plain',
}: {
  value: string | number;
  label: string;
  tone?: 'plain' | 'signal' | 'alarm';
}) {
  const cls =
    tone === 'signal'
      ? 'mon-kpi__num--signal'
      : tone === 'alarm'
        ? 'mon-kpi__num--alarm'
        : '';
  return (
    <div className="mon-kpi">
      <div className={`mon-kpi__num ${cls}`}>{value}</div>
      <div className="mon-kpi__label">{label}</div>
    </div>
  );
}

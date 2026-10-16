import type { Bureau } from '../state/useBureau';
import { buildReport, type PlaceLoad } from '../domain/report';

export function Report({ bureau }: { bureau: Bureau }) {
  const { result, error } = bureau;

  if (error || !result) {
    return (
      <div className="error" role="alert">
        <h2 className="error__title">⚠ Отчёт недоступен</h2>
        <p className="error__msg">
          Данные смены не обработаны, поэтому свести отчёт нельзя. Вернитесь в
          диспетчерскую и восстановите данные.
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
        <div className="empty__title">Смена без заявок</div>
        <div>
          Расселять некого — отчёт пуст. Как только появятся заявки, здесь
          будет сводка по расселению, перегрузке мест и проблемным случаям.
        </div>
      </div>
    );
  }

  const rate = Math.round((report.assignedCount / report.total) * 100);

  return (
    <div>
      <p className="wl__intro">
        Сводка ночной смены на {result.now}. Расселено {report.assignedCount} из{' '}
        {report.total} ({rate}%). Ниже — загрузка мест и самые проблемные
        заявки в порядке срочности.
      </p>

      <div className="stats">
        <Stat value={report.assignedCount} label="расселено" tone="signal" />
        <Stat
          value={report.unresolvedCount}
          label="без места"
          tone={report.unresolvedCount > 0 ? 'alarm' : 'plain'}
        />
        <Stat value={report.manualCount} label="решено вручную" />
        <Stat
          value={report.overdueCount}
          label="просрочено"
          tone={report.overdueCount > 0 ? 'alarm' : 'plain'}
        />
      </div>

      <div className="report__grid">
        <div className="panel">
          <div className="panel__head">
            <span className="panel__title">Загрузка мест</span>
            {report.overloaded.length > 0 && (
              <span className="tab__badge">
                ⚠ перегружено: {report.overloaded.length}
              </span>
            )}
          </div>
          <div className="panel__body">
            <div className="loadchart">
              {report.placeLoads.map((l) => (
                <LoadRow key={l.place.id} load={l} />
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__title">
              Проблемные заявки <b>{report.problems.length}</b>
            </span>
          </div>
          <div className="panel__body">
            {report.problems.length === 0 ? (
              <div className="empty" style={{ padding: '1.5rem 0' }}>
                <div className="empty__title">Проблем нет</div>
                <div>Все заявки закрыты без нарушений и в срок.</div>
              </div>
            ) : (
              <div className="problems">
                {report.problems.map((p) => (
                  <div
                    key={p.outcome.request.id}
                    className={`problem ${p.severity < 50 ? 'problem--mild' : ''}`}
                  >
                    <div className="problem__name">
                      <span>{p.outcome.request.name}</span>
                      <span className="problem__sev">риск {p.severity}</span>
                    </div>
                    <ul className="problem__reasons">
                      {p.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  tone = 'plain',
}: {
  value: number;
  label: string;
  tone?: 'plain' | 'signal' | 'alarm';
}) {
  const cls =
    tone === 'signal'
      ? 'stat__num--signal'
      : tone === 'alarm'
        ? 'stat__num--alarm'
        : '';
  return (
    <div className="stat">
      <div className={`stat__num ${cls}`}>{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

function LoadRow({ load }: { load: PlaceLoad }) {
  const slots = Math.max(load.capacity, load.assigned);
  return (
    <div className="load">
      <span className="load__name">{load.place.name}</span>
      <span className="load__val">
        {load.assigned}/{load.capacity}
        {load.status === 'overloaded' && ' · перегружено'}
        {load.status === 'full' && ' · заполнено'}
      </span>
      <div
        className="load__track"
        role="img"
        aria-label={`${load.place.name}: занято ${load.assigned} из ${load.capacity}`}
      >
        {Array.from({ length: slots }).map((_, i) => {
          const filled = i < load.assigned;
          const over = i >= load.capacity;
          const cls = !filled
            ? ''
            : over
              ? 'load__cell--over'
              : load.status === 'full'
                ? 'load__cell--full'
                : 'load__cell--on';
          return <span key={i} className={`load__cell ${cls}`} />;
        })}
      </div>
    </div>
  );
}

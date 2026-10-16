import { useEffect, useState } from 'react';
import type { Bureau } from '../state/useBureau';
import type { RequestOutcome, SolveResult } from '../domain/matching';
import {
  daysUntil,
  explainUnresolved,
  validateChoice,
} from '../domain/matching';
import { CONDITIONS } from '../domain/conditions';
import type { DeadlineStatus } from '../domain/types';
import { SignalTrace } from './SignalTrace';

export function Dispatcher({ bureau }: { bureau: Bureau }) {
  const { result, error } = bureau;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Держим валидный выбор: если выбранная заявка исчезла — берём первую.
  const outcomes = result?.outcomes ?? [];
  const selected =
    outcomes.find((o) => o.request.id === selectedId) ?? outcomes[0] ?? null;

  useEffect(() => {
    if (selected && selected.request.id !== selectedId) {
      setSelectedId(selected.request.id);
    }
  }, [selected, selectedId]);

  if (error || !result) {
    return <DataErrorScreen message={error ?? 'Нет данных.'} onReset={bureau.reset} />;
  }

  return (
    <div className="disp">
      <div className="disp__rail">
        <RequestListPanel
          result={result}
          selectedId={selected?.request.id ?? null}
          onSelect={setSelectedId}
          onClear={bureau.clearAllRequests}
          onReset={bureau.reset}
        />
        <PlacesPanel result={result} />
      </div>

      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">Карточка заявки</span>
          {selected && (
            <span className="panel__title">
              #{String(outcomes.indexOf(selected) + 1).padStart(2, '0')}
            </span>
          )}
        </div>
        <div className="panel__body">
          {selected ? (
            <RequestDetail outcome={selected} result={result} bureau={bureau} />
          ) : (
            <EmptyDetail />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Левая колонка: список заявок ──────────────────────────────────

function RequestListPanel({
  result,
  selectedId,
  onSelect,
  onClear,
  onReset,
}: {
  result: SolveResult;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onReset: () => void;
}) {
  const { outcomes } = result;
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="panel__title">
          Входящие заявки <b>{outcomes.length}</b>
        </span>
        <span style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="btn btn--ghost" onClick={onReset}>
            Сброс
          </button>
          <button
            className="btn btn--ghost"
            onClick={onClear}
            disabled={outcomes.length === 0}
          >
            Очистить
          </button>
        </span>
      </div>
      {outcomes.length === 0 ? (
        <div className="empty">
          <div className="empty__art">∅</div>
          <div className="empty__title">Очередь пуста</div>
          <div>
            Входящих заявок нет. Смена спокойная. Нажмите «Сброс», чтобы
            вернуть демо-заявки.
          </div>
        </div>
      ) : (
        <div className="reqlist">
          {outcomes.map((o, i) => (
            <RequestRow
              key={o.request.id}
              outcome={o}
              index={i}
              result={result}
              active={o.request.id === selectedId}
              onSelect={() => onSelect(o.request.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({
  outcome,
  index,
  result,
  active,
  onSelect,
}: {
  outcome: RequestOutcome;
  index: number;
  result: SolveResult;
  active: boolean;
  onSelect: () => void;
}) {
  const place = result.places.find((p) => p.id === outcome.assignedPlaceId);
  return (
    <button
      type="button"
      className="req"
      aria-current={active}
      onClick={onSelect}
    >
      <span className="req__id">#{String(index + 1).padStart(2, '0')}</span>
      <span className="req__body">
        <span className="req__name">{outcome.request.name}</span>
        <span className="req__line">
          <AnxietyMeter value={outcome.request.anxiety} />
          <DeadlineChip outcome={outcome} now={result.now} />
        </span>
        <span className="req__line">
          {place ? (
            <span
              className={`req__status ${outcome.manual ? 'req__status--manual' : 'req__status--ok'}`}
            >
              {outcome.manual ? '✎' : '▸'} {place.name}
            </span>
          ) : (
            <span className="req__status req__status--none">✖ нет места</span>
          )}
        </span>
      </span>
    </button>
  );
}

// ─── Левая колонка: места ──────────────────────────────────────────

function PlacesPanel({ result }: { result: SolveResult }) {
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="panel__title">
          Места переселения <b>{result.places.length}</b>
        </span>
      </div>
      <div className="panel__body">
        {result.places.map((p) => {
          const used = result.occupancy[p.id] ?? 0;
          const full = used === p.capacity && p.capacity > 0;
          return (
            <div className="place" key={p.id}>
              <span className="place__name">{p.name}</span>
              <span className="place__count">
                {used}/{p.capacity}
              </span>
              <div className="bar">
                {Array.from({ length: Math.max(p.capacity, used) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className={`bar__fill ${
                        i >= p.capacity
                          ? 'bar__fill--over'
                          : full
                            ? 'bar__fill--full'
                            : ''
                      }`}
                      style={{
                        flex: 1,
                        opacity: i < used ? 1 : 0.12,
                        marginRight:
                          i < Math.max(p.capacity, used) - 1 ? 2 : 0,
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Правая колонка: карточка заявки ───────────────────────────────

function RequestDetail({
  outcome,
  result,
  bureau,
}: {
  outcome: RequestOutcome;
  result: SolveResult;
  bureau: Bureau;
}) {
  const { request } = outcome;
  const assignedEval = outcome.evaluations.find(
    (e) => e.placeId === outcome.assignedPlaceId,
  );
  const assignedPlace = result.places.find(
    (p) => p.id === outcome.assignedPlaceId,
  );
  const score = assignedEval?.score ?? 0;
  const compatible = assignedEval?.compatible ?? false;
  const warnings = outcome.assignedPlaceId
    ? validateChoice(outcome, outcome.assignedPlaceId, result)
    : [];

  return (
    <div>
      <div className="det__head">
        <div>
          <h2 className="det__name">{request.name}</h2>
          <div className="det__kind">{request.kind}</div>
        </div>
        <DeadlineChip outcome={outcome} now={result.now} big />
      </div>

      {request.note && <p className="det__note">{request.note}</p>}

      <div className="det__grid">
        <div className="field">
          <div className="field__label">Тревожность</div>
          <div className="field__value">
            <AnxietyMeter value={request.anxiety} /> {request.anxiety}/10
          </div>
        </div>
        <div className="field">
          <div className="field__label">Любимая температура</div>
          <div className="field__value">{request.preferredTemp}°C</div>
        </div>
        <div className="field">
          <div className="field__label">Дедлайн</div>
          <div className="field__value">{request.deadline}</div>
        </div>
      </div>

      <div className="field" style={{ marginBottom: '1.25rem' }}>
        <div className="field__label">Особые условия</div>
        <div className="tags">
          {request.conditions.length === 0 ? (
            <span className="chip">нет требований</span>
          ) : (
            request.conditions.map((c) => (
              <span className="chip chip--cond" key={c}>
                {CONDITIONS[c].label}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Сигнатура — захват сигнала текущего назначения */}
      <div className="signature">
        <div className="signature__top">
          <span className="signature__label">
            Захват сигнала{assignedPlace ? ` · ${assignedPlace.name}` : ''}
          </span>
          <span className={`lock ${compatible ? 'lock--ok' : 'lock--none'}`}>
            {compatible ? '● LOCK' : '✖ NO CARRIER'}
          </span>
        </div>
        <SignalTrace
          score={score}
          compatible={compatible}
          seed={`${request.id}:${outcome.assignedPlaceId ?? 'none'}`}
        />
        <div className="signature__read">
          <span>
            {assignedPlace
              ? assignedEval?.summary
              : 'Нет активного назначения.'}
          </span>
          <span
            className={`signature__pct ${compatible ? '' : 'signature__pct--none'}`}
          >
            {compatible ? `${Math.round(score * 100)}%` : '––'}
          </span>
        </div>
      </div>

      {/* Назначение или разбор причин провала */}
      {outcome.assignedPlaceId && assignedPlace ? (
        <div className={`assign ${compatible ? 'assign--ok' : 'assign--none'}`}>
          <div className="assign__head">
            <span className="eyebrow">
              {outcome.manual ? 'Назначено вручную' : 'Назначено автоматически'}
            </span>
            <span className="assign__to">▸ {assignedPlace.name}</span>
          </div>
          <div className="assign__summary">{assignedEval?.summary}</div>
          {assignedEval?.factors.map((f) => (
            <div className="factor" key={f.key}>
              <span className="factor__label">{f.label}</span>
              <span className="factor__track">
                <span
                  className="factor__fill"
                  style={{ width: `${Math.round(f.value * 100)}%` }}
                />
              </span>
              <span className="factor__val">{Math.round(f.value * 100)}%</span>
              <span className="factor__detail">{f.detail}</span>
            </div>
          ))}
        </div>
      ) : (
        <UnresolvedBlock outcome={outcome} result={result} />
      )}

      {/* Предупреждения по текущему (обычно ручному) выбору */}
      {warnings.length > 0 && (
        <div className="warnbox">
          {warnings.map((w, i) => (
            <div key={i} className={`warn warn--${w.severity}`}>
              <span>{w.severity === 'error' ? '✖' : '⚠'}</span>
              <span>{w.text}</span>
            </div>
          ))}
        </div>
      )}
      {outcome.manual && outcome.assignedPlaceId && warnings.length === 0 && (
        <div className="warnbox">
          <div className="warn warn--ok">
            <span>●</span>
            <span>Ручной выбор безопасен: условия соблюдены, место свободно.</span>
          </div>
        </div>
      )}

      {/* Альтернативы и управление выбором */}
      <Alternatives outcome={outcome} result={result} bureau={bureau} />
    </div>
  );
}

function UnresolvedBlock({
  outcome,
  result,
}: {
  outcome: RequestOutcome;
  result: SolveResult;
}) {
  const why = explainUnresolved(outcome, result);
  return (
    <div className="assign assign--none">
      <div className="assign__head">
        <span className="eyebrow">Переселение невозможно</span>
      </div>
      <div className="assign__summary">{why.text}</div>
      <ul className="reasons">
        {why.rejections?.map((r) => (
          <li key={r.placeName}>
            <span>{r.placeName}</span>
            <span className="why">{r.reasons.join(', ') || '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Alternatives({
  outcome,
  result,
  bureau,
}: {
  outcome: RequestOutcome;
  result: SolveResult;
  bureau: Bureau;
}) {
  return (
    <div className="alts">
      <div className="panel__head" style={{ padding: '0 0 0.6rem', border: 'none' }}>
        <span className="panel__title">Все места</span>
        {outcome.manual && (
          <button
            className="btn btn--ghost"
            onClick={() => bureau.clearManual(outcome.request.id)}
          >
            ↩ Вернуть авто
          </button>
        )}
      </div>
      {outcome.evaluations.map((e) => {
        const place = result.places.find((p) => p.id === e.placeId)!;
        const used = result.occupancy[e.placeId] ?? 0;
        const isAssigned = e.placeId === outcome.assignedPlaceId;
        return (
          <div className="alt" key={e.placeId}>
            <div>
              <div className="alt__name">{place.name}</div>
              {e.compatible ? (
                <div className="alt__meta">
                  занято {used}/{place.capacity} · {place.temperature}°C ·
                  шум {place.noise}/10 · свет {place.light}/10
                </div>
              ) : (
                <div className="alt__bad">
                  ✖ {e.conflicts.map((c) => c.text).join(', ')}
                </div>
              )}
            </div>
            <span className="alt__pct">
              {e.compatible ? `${Math.round(e.score * 100)}%` : '––'}
            </span>
            {isAssigned ? (
              <span className="chip chip--cond">● выбрано</span>
            ) : (
              <button
                className="btn"
                onClick={() =>
                  bureau.assignManual(outcome.request.id, e.placeId)
                }
              >
                Выбрать
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Мелкие элементы ───────────────────────────────────────────────

function AnxietyMeter({ value }: { value: number }) {
  return (
    <span className="meter" aria-label={`тревожность ${value} из 10`}>
      {Array.from({ length: 10 }).map((_, i) => {
        const on = i < value;
        const hot = on && i >= 7;
        return (
          <span
            key={i}
            className={`meter__seg ${on ? (hot ? 'meter__seg--hot' : 'meter__seg--on') : ''}`}
          />
        );
      })}
    </span>
  );
}

function DeadlineChip({
  outcome,
  now,
  big,
}: {
  outcome: RequestOutcome;
  now: string;
  big?: boolean;
}) {
  const days = daysUntil(outcome.request.deadline, now);
  const status: DeadlineStatus = outcome.deadlineStatus;
  const cls =
    status === 'overdue'
      ? 'chip--overdue'
      : status === 'soon'
        ? 'chip--soon'
        : '';
  const label =
    status === 'overdue'
      ? `просрочено на ${Math.abs(days)} дн`
      : days === 0
        ? 'дедлайн сегодня'
        : `через ${days} дн`;
  return (
    <span
      className={`chip ${cls}`}
      style={big ? { fontSize: 'var(--fs-sm)' } : undefined}
    >
      ⧗ {label}
    </span>
  );
}

function EmptyDetail() {
  return (
    <div className="empty">
      <div className="empty__art">⌁</div>
      <div className="empty__title">Заявка не выбрана</div>
      <div>Выберите заявку в очереди слева, чтобы увидеть подбор места.</div>
    </div>
  );
}

function DataErrorScreen({
  message,
  onReset,
}: {
  message: string;
  onReset: () => void;
}) {
  return (
    <div className="error" role="alert">
      <h2 className="error__title">⚠ Ошибка данных смены</h2>
      <p className="error__msg">
        Пульт не смог обработать входящие данные и остановил подбор, чтобы не
        показать неверные назначения. Ниже — что именно не так.
      </p>
      <div className="error__detail">{message}</div>
      <button type="button" className="btn" onClick={onReset}>
        Восстановить демо-данные
      </button>
    </div>
  );
}

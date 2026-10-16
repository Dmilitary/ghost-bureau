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

export function Dispatcher({
  bureau,
  onFinish,
}: {
  bureau: Bureau;
  onFinish: () => void;
}) {
  const { result, error, reviewed } = bureau;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const outcomes = result?.outcomes ?? [];
  const idx = Math.max(
    0,
    outcomes.findIndex((o) => o.request.id === selectedId),
  );
  const current = outcomes[idx] ?? null;

  // Если выбранная заявка исчезла (удалена/сброс) — встаём на первую.
  useEffect(() => {
    if (current && current.request.id !== selectedId) {
      setSelectedId(current.request.id);
    }
  }, [current, selectedId]);

  if (error || !result) {
    return <DataErrorScreen message={error ?? 'Нет данных.'} onReset={bureau.reset} />;
  }

  const reviewedCount = outcomes.filter((o) => reviewed[o.request.id]).length;
  const allReviewed =
    outcomes.length > 0 && reviewedCount === outcomes.length;
  const assignedCount = outcomes.filter((o) => o.assignedPlaceId).length;

  const goTo = (i: number) => {
    const j = Math.min(Math.max(i, 0), outcomes.length - 1);
    if (outcomes[j]) setSelectedId(outcomes[j].request.id);
  };

  // Подтвердить текущую и перейти к следующей неразобранной.
  const confirmAndNext = () => {
    if (!current) return;
    bureau.markReviewed(current.request.id);
    for (let k = 1; k <= outcomes.length; k++) {
      const j = (idx + k) % outcomes.length;
      const o = outcomes[j];
      if (o.request.id !== current.request.id && !reviewed[o.request.id]) {
        setSelectedId(o.request.id);
        return;
      }
    }
    // Все разобраны — остаёмся, покажется итог смены.
  };

  if (outcomes.length === 0) {
    return (
      <>
        <div className="wizard">
          <div className="panel">
            <div className="empty">
              <div className="empty__art">∅</div>
              <div className="empty__title">Очередь пуста</div>
              <div>
                Входящих заявок нет. Нажмите «Вернуть демо-заявки», чтобы начать
                разбор.
              </div>
              <div style={{ marginTop: '1.25rem' }}>
                <button className="btn btn--primary" onClick={bureau.reset}>
                  Вернуть демо-заявки
                </button>
              </div>
            </div>
          </div>
        </div>
        <div style={{ height: '1.25rem' }} />
        <PlacesPanel result={result} />
      </>
    );
  }

  return (
    <>
      <div className="wizard">
        <div className="wizard__bar">
          <span className="wizard__count">
            Заявка {idx + 1} из {outcomes.length} ·{' '}
            <b>разобрано {reviewedCount}</b>
          </span>
          <span className="wizard__tools">
            <button
              className="btn btn--ghost"
              onClick={() => goTo(idx - 1)}
              disabled={idx === 0}
            >
              ← Пред
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => goTo(idx + 1)}
              disabled={idx === outcomes.length - 1}
            >
              След →
            </button>
            <button
              className="btn btn--ghost"
              onClick={bureau.reset}
              title="Вернуть исходные демо-заявки"
            >
              Сброс
            </button>
            <button
              className="btn btn--ghost"
              onClick={bureau.clearAllRequests}
              title="Очистить очередь (пустое состояние)"
            >
              Очистить
            </button>
          </span>
        </div>

        {/* Очередь — компактный список всех заявок, он же навигация */}
        <div className="queue" role="tablist" aria-label="Очередь заявок">
          {outcomes.map((o, i) => {
            const done = reviewed[o.request.id];
            const st = !o.assignedPlaceId
              ? 'none'
              : o.manual
                ? 'manual'
                : 'ok';
            return (
              <button
                key={o.request.id}
                className="qchip"
                aria-current={i === idx}
                onClick={() => goTo(i)}
                title={o.request.name}
              >
                <span className="qchip__num">{i + 1}</span>
                {o.request.name}
                <span
                  className={`qchip__st qchip__st--${done ? 'done' : st}`}
                >
                  {done ? '✓' : st === 'none' ? '✖' : st === 'manual' ? '✎' : '•'}
                </span>
              </button>
            );
          })}
        </div>

        {allReviewed && (
          <div className="done">
            <div>
              <div className="done__title">
                Готово — все {outcomes.length} заявок разобраны
              </div>
              <div className="done__sub">
                Расселено {assignedCount}, без места{' '}
                {outcomes.length - assignedCount}. Посмотрите общую картину на
                табло мониторинга.
              </div>
            </div>
            <button className="btn btn--primary btn--lg" onClick={onFinish}>
              Открыть мониторинг →
            </button>
          </div>
        )}

        <div className="panel">
          <div className="panel__body">
            {current && (
              <RequestCard
                outcome={current}
                result={result}
                bureau={bureau}
                reviewed={Boolean(reviewed[current.request.id])}
                onConfirm={confirmAndNext}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ height: '1.25rem' }} />
      <PlacesPanel result={result} />
    </>
  );
}

// ─── Карточка текущей заявки ───────────────────────────────────────

function RequestCard({
  outcome,
  result,
  bureau,
  reviewed,
  onConfirm,
}: {
  outcome: RequestOutcome;
  result: SolveResult;
  bureau: Bureau;
  reviewed: boolean;
  onConfirm: () => void;
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
        <DeadlineChip outcome={outcome} now={result.now} />
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

      <div className="field" style={{ marginBottom: '0.5rem' }}>
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

      {/* ПЕРВИЧНОЕ ДЕЙСТВИЕ — что сделать с этой заявкой */}
      <ActionBar
        outcome={outcome}
        assignedPlace={assignedPlace?.name}
        score={score}
        compatible={compatible}
        hasWarnings={warnings.length > 0}
        reviewed={reviewed}
        onConfirm={onConfirm}
      />

      {/* Обоснование — осциллограф совпадения */}
      <div className="signature">
        <div className="signature__top">
          <span className="signature__label">
            Насколько подходит место
            {assignedPlace ? ` · ${assignedPlace.name}` : ''}
          </span>
          <span className={`lock ${compatible ? 'lock--ok' : 'lock--none'}`}>
            {compatible ? '✓ подходит' : '✖ не подходит'}
          </span>
        </div>
        <SignalTrace
          score={score}
          compatible={compatible}
          seed={`${request.id}:${outcome.assignedPlaceId ?? 'none'}`}
        />
        <div className="signature__read">
          <span>
            {assignedPlace ? assignedEval?.summary : 'Нет активного назначения.'}
          </span>
          <span
            className={`signature__pct ${compatible ? '' : 'signature__pct--none'}`}
          >
            {compatible ? `${Math.round(score * 100)}%` : '––'}
          </span>
        </div>
      </div>

      {outcome.assignedPlaceId && assignedPlace ? (
        <div className={`assign ${compatible ? 'assign--ok' : 'assign--none'}`}>
          <div className="assign__head">
            <span className="eyebrow">
              {outcome.manual ? 'Выбрано вручную' : 'Подобрано автоматически'}
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
            <span>✓</span>
            <span>Ручной выбор безопасен: условия соблюдены, место свободно.</span>
          </div>
        </div>
      )}

      <Alternatives outcome={outcome} result={result} bureau={bureau} />
    </div>
  );
}

function ActionBar({
  outcome,
  assignedPlace,
  score,
  compatible,
  hasWarnings,
  reviewed,
  onConfirm,
}: {
  outcome: RequestOutcome;
  assignedPlace?: string;
  score: number;
  compatible: boolean;
  hasWarnings: boolean;
  reviewed: boolean;
  onConfirm: () => void;
}) {
  // Нет места
  if (!outcome.assignedPlaceId) {
    return (
      <div className="cta cta--bad">
        <div className="cta__title">
          Подходящего места нет — переселить <b>невозможно</b>.
        </div>
        <div className="cta__actions">
          <button className="btn btn--lg" onClick={onConfirm}>
            {reviewed ? 'Дальше →' : 'Отметить и дальше →'}
          </button>
          <span className="cta__hint">
            или попробуйте назначить место вручную ниже ↓
          </span>
          {reviewed && (
            <span className="cta__badge">✓ разобрано</span>
          )}
        </div>
      </div>
    );
  }

  // Назначено вручную, но с нарушениями
  if (!compatible || hasWarnings) {
    return (
      <div className="cta cta--warn">
        <div className="cta__title">
          Выбрано вручную: <b>{assignedPlace}</b>. Есть замечания — смотрите ниже.
        </div>
        <div className="cta__actions">
          <button className="btn btn--lg" onClick={onConfirm}>
            {reviewed ? 'Дальше →' : 'Подтвердить всё равно →'}
          </button>
          <span className="cta__hint">или выберите другое место ниже ↓</span>
          {reviewed && <span className="cta__badge">✓ разобрано</span>}
        </div>
      </div>
    );
  }

  // Хорошее назначение
  return (
    <div className="cta cta--ok">
      <div className="cta__title">
        Предлагаем поселить в <b>{assignedPlace}</b> — подходит на{' '}
        {Math.round(score * 100)}%.
      </div>
      <div className="cta__actions">
        <button className="btn btn--primary btn--lg" onClick={onConfirm}>
          {reviewed ? 'Дальше →' : '✓ Подтвердить и дальше'}
        </button>
        <span className="cta__hint">или выберите другое место ниже ↓</span>
        {reviewed && <span className="cta__badge">✓ разобрано</span>}
      </div>
    </div>
  );
}

// ─── Места ─────────────────────────────────────────────────────────

function PlacesPanel({ result }: { result: SolveResult }) {
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="panel__title">
          Места переселения <b>{result.places.length}</b>
        </span>
        <span className="panel__title">занято / вместимость</span>
      </div>
      <div className="panel__body">
        {result.places.map((p) => {
          const used = result.occupancy[p.id] ?? 0;
          const full = used === p.capacity && p.capacity > 0;
          const slots = Math.max(p.capacity, used);
          return (
            <div className="place" key={p.id}>
              <span className="place__name">{p.name}</span>
              <span className="place__count">
                {used}/{p.capacity}
              </span>
              <div className="bar">
                {Array.from({ length: slots }).map((_, i) => (
                  <div
                    key={i}
                    className={`bar__fill ${
                      i >= p.capacity
                        ? 'bar__fill--over'
                        : full
                          ? 'bar__fill--full'
                          : ''
                    }`}
                    style={{ flex: 1, opacity: i < used ? 1 : 0.12 }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Разбор провала и альтернативы ─────────────────────────────────

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
        <span className="eyebrow">Почему не подходит ни одно место</span>
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
      <div
        className="panel__head"
        style={{ padding: '0 0 0.3rem', border: 'none', background: 'none' }}
      >
        <span className="panel__title">Назначить место вручную</span>
        {outcome.manual && (
          <button
            className="btn btn--ghost"
            onClick={() => bureau.clearManual(outcome.request.id)}
          >
            ↩ Вернуть авто-подбор
          </button>
        )}
      </div>
      <p className="subhead">
        Нажмите «Выбрать», чтобы переселить в другое место. Неподходящие варианты
        отмечены причиной.
      </p>
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
                  занято {used}/{place.capacity} · {place.temperature}°C · шум{' '}
                  {place.noise}/10 · свет {place.light}/10
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
                onClick={() => bureau.assignManual(outcome.request.id, e.placeId)}
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
}: {
  outcome: RequestOutcome;
  now: string;
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
  return <span className={`chip ${cls}`}>⧗ {label}</span>;
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

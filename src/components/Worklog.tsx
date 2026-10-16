import { WORKLOG } from '../data/worklog';

export function Worklog() {
  return (
    <div className="wl">
      <p className="wl__intro">
        Честный журнал разработки этого приложения: чем занимался человек, чем —
        AI, ключевые промпты и решения. Ведётся прямо в интерфейсе, а не только
        в README.
      </p>

      <div className="wl__meta">
        <div className="wl__metacell">
          <div className="wl__role">Инструменты</div>
          <ul className="wl__list">
            {WORKLOG.tools.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="wl__metacell">
          <div className="wl__role">Время разработки</div>
          <div style={{ color: 'var(--text)', fontWeight: 700 }}>{WORKLOG.time}</div>
        </div>
        <div className="wl__metacell">
          <div className="wl__role">Расход токенов</div>
          <div style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
            {WORKLOG.tokens}
          </div>
        </div>
      </div>

      <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>
        Этапы работы · человек × AI
      </div>
      {WORKLOG.stages.map((s) => (
        <div className="wl__stage" key={s.n}>
          <div className="wl__stagehead">
            <span className="wl__stagenum">{s.n}</span>
            <span className="wl__stagetitle">{s.title}</span>
          </div>
          <div className="wl__split">
            <div>
              <div className="wl__role">Что делал я</div>
              <div style={{ fontSize: 'var(--fs-sm)' }}>{s.human}</div>
            </div>
            <div>
              <div className="wl__role">Что делал AI</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>
                {s.ai}
              </div>
            </div>
          </div>
          <div className="wl__role">Ключевой промпт</div>
          <div className="wl__prompt">{s.prompt}</div>
        </div>
      ))}

      <Section title="Решения, которые принял сам" items={WORKLOG.decisions} />
      <Section
        title="Где AI ошибся или предложил слабое решение"
        items={WORKLOG.aiMistakes}
      />
      <Section
        title="Что переписал и доработал вручную"
        items={WORKLOG.manualWork}
      />
      <Section
        title="Что улучшил бы в реальном продукте"
        items={WORKLOG.future}
      />

      <div className="wl__stage">
        <div className="wl__stagehead">
          <span className="wl__stagetitle">
            Инженерные практики, которые я применяю на боевых проектах
          </span>
        </div>
        <p
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-3)',
            margin: '0 0 1rem',
          }}
        >
          {WORKLOG.practicesNote}
        </p>
        {WORKLOG.practices.map((g) => (
          <div key={g.area} style={{ marginBottom: '1rem' }}>
            <div className="wl__role">{g.area}</div>
            <ul className="wl__list">
              {g.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="wl__stage">
      <div className="wl__stagehead">
        <span className="wl__stagetitle">{title}</span>
      </div>
      <ul className="wl__list">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

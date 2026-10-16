import { useEffect, useState } from 'react';
import { useBureau } from './state/useBureau';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dispatcher } from './components/Dispatcher';
import { Report } from './components/Report';
import { Worklog } from './components/Worklog';

type Tab = 'disp' | 'report' | 'worklog';

const TABS: { id: Tab; label: string }[] = [
  { id: 'disp', label: 'Диспетчерская' },
  { id: 'report', label: 'Отчёт' },
  { id: 'worklog', label: 'AI Worklog' },
];

export default function App() {
  const bureau = useBureau();
  const [tab, setTab] = useState<Tab>('disp');

  const unresolved =
    bureau.result?.outcomes.filter((o) => !o.assignedPlaceId).length ?? 0;

  return (
    <>
      <div className="app">
        <div className="shell">
          <header className="hdr">
            <div>
              <h1 className="hdr__brand">Бюро переселения привидений</h1>
              <div className="hdr__sub">Ночная смена · пульт оператора</div>
            </div>
            <div className="hdr__status">
              <Clock />
              <span className="rec">
                <span className="rec__dot" /> СМЕНА АКТИВНА
              </span>
            </div>
          </header>

          <nav className="tabs" role="tablist" aria-label="Разделы пульта">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className="tab"
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'report' && unresolved > 0 && (
                  <span className="tab__badge">{unresolved}</span>
                )}
              </button>
            ))}
          </nav>

          <main>
            <ErrorBoundary>
              {tab === 'disp' && <Dispatcher bureau={bureau} />}
              {tab === 'report' && <Report bureau={bureau} />}
              {tab === 'worklog' && <Worklog />}
            </ErrorBoundary>
          </main>
        </div>

        <footer className="foot">
          <div className="foot__inner">
            <span>
              Демо-данные · время зафиксировано на {bureau.now} для
              воспроизводимости дедлайнов
            </span>
            <button
              className={`btn ${bureau.faulty ? 'btn--alarm' : 'btn--ghost'}`}
              onClick={bureau.toggleFault}
              title="Подмешать повреждённую заявку, чтобы показать обработку ошибки"
            >
              {bureau.faulty ? '↩ убрать сбой' : '⚠ смоделировать сбой данных'}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

function Clock() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="hdr__clock">{time}</span>;
}

function formatTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

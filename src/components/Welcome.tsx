import { useEffect } from 'react';

/**
 * Приветственный экран. Его единственная задача — за несколько секунд
 * объяснить, ЧТО это за продукт и ЗАЧЕМ он, прежде чем пользователь
 * окажется внутри рабочего пульта.
 */
export function Welcome({ onStart }: { onStart: () => void }) {
  // Закрытие по Escape — чтобы экран не ощущался ловушкой.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      onClick={onStart}
    >
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__eyebrow">Демо-задание · вымышленный сценарий</div>
        <h2 className="modal__title" id="welcome-title">
          👻 Бюро переселения привидений
        </h2>

        <p className="modal__lead">
          Старые дома идут под снос, и привидений нужно куда-то переселить. Вы —{' '}
          <b>оператор бюро</b>. Ваша цель — подобрать каждому привидению
          подходящее новое место обитания.
        </p>

        <p className="modal__why">
          Загвоздка в том, что у каждого привидения свои причуды: боится зеркал,
          любит сырость, нельзя селить рядом с людьми. А у каждого места — замок,
          маяк, подвал старой типографии — свои параметры и ограничения. Пульт
          сам находит лучшее совпадение, объясняет его и честно показывает, если
          переселить кого-то невозможно.
        </p>

        <div className="modal__steps">
          <div className="step">
            <span className="step__num">1</span>
            <span className="step__title">Смотрите заявку</span>
            <span className="step__text">
              Привидение, его требования и предложенное пультом место с
              обоснованием.
            </span>
          </div>
          <div className="step">
            <span className="step__num">2</span>
            <span className="step__title">Принимаете решение</span>
            <span className="step__text">
              Подтверждаете подбор или выбираете другое место вручную — пульт
              предупредит, если выбор плохой.
            </span>
          </div>
          <div className="step">
            <span className="step__num">3</span>
            <span className="step__title">Сводите отчёт</span>
            <span className="step__text">
              В конце — сводка смены: сколько расселено, кто без места, какие
              места перегружены.
            </span>
          </div>
        </div>

        <div className="modal__foot">
          <button className="btn btn--primary btn--lg" onClick={onStart}>
            Начать смену →
          </button>
          <span className="modal__note">
            Вернуться к описанию можно кнопкой «? О продукте» в шапке.
          </span>
        </div>
      </div>
    </div>
  );
}

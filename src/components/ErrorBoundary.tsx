import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Страхующий барьер на случай непредвиденной ошибки рендера.
 * Движок уже валидирует данные сам, но пользователь никогда не должен
 * увидеть белый экран — только понятное сообщение и путь назад.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="error" role="alert">
          <h2 className="error__title">⚠ Сбой на пульте</h2>
          <p className="error__msg">
            Что-то пошло не так при отрисовке экрана. Данные смены не
            потеряны — перезагрузите страницу, чтобы вернуться к работе.
          </p>
          <div className="error__detail">{error.message}</div>
          <button
            type="button"
            className="btn"
            onClick={() => window.location.reload()}
          >
            Перезапустить пульт
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

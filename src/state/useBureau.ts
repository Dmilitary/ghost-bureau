import { useCallback, useMemo, useState } from 'react';
import { NOW, SEED_PLACES, SEED_REQUESTS } from '../data/seed';
import { solve, type SolveResult } from '../domain/matching';
import type { GhostRequest, Place } from '../domain/types';

// Сломанная заявка для демонстрации обработки ошибок: ссылается на
// несуществующее условие, из-за чего движок осознанно падает с DataError,
// а интерфейс показывает понятное сообщение вместо белого экрана.
const BROKEN_REQUEST: GhostRequest = {
  id: 'corrupt',
  name: '░ПОВРЕЖДЁННАЯ ЗАПИСЬ░',
  kind: 'сбой канала',
  anxiety: 5,
  preferredTemp: 8,
  deadline: '2026-10-20',
  conditions: ['teleport_please' as unknown as GhostRequest['conditions'][number]],
};

export interface Bureau {
  requests: GhostRequest[];
  places: Place[];
  manual: Record<string, string | null>;
  now: string;
  /** Результат решателя либо null, если данные не удалось обработать. */
  result: SolveResult | null;
  /** Текст ошибки обработки данных, если она возникла. */
  error: string | null;
  faulty: boolean;

  assignManual: (requestId: string, placeId: string) => void;
  clearManual: (requestId: string) => void;
  removeRequest: (requestId: string) => void;
  clearAllRequests: () => void;
  reset: () => void;
  toggleFault: () => void;
}

export function useBureau(): Bureau {
  const [requests, setRequests] = useState<GhostRequest[]>(SEED_REQUESTS);
  const [manual, setManual] = useState<Record<string, string | null>>({});
  const [faulty, setFaulty] = useState(false);
  const places = SEED_PLACES;
  const now = NOW;

  const effectiveRequests = useMemo(
    () => (faulty ? [...requests, BROKEN_REQUEST] : requests),
    [requests, faulty],
  );

  const { result, error } = useMemo(() => {
    try {
      return {
        result: solve({ requests: effectiveRequests, places, manual, now }),
        error: null as string | null,
      };
    } catch (e) {
      return {
        result: null as SolveResult | null,
        error: e instanceof Error ? e.message : 'Неизвестная ошибка обработки данных.',
      };
    }
  }, [effectiveRequests, places, manual, now]);

  const assignManual = useCallback((requestId: string, placeId: string) => {
    setManual((m) => ({ ...m, [requestId]: placeId }));
  }, []);

  const clearManual = useCallback((requestId: string) => {
    setManual((m) => {
      const next = { ...m };
      delete next[requestId];
      return next;
    });
  }, []);

  const removeRequest = useCallback((requestId: string) => {
    setRequests((rs) => rs.filter((r) => r.id !== requestId));
    setManual((m) => {
      const next = { ...m };
      delete next[requestId];
      return next;
    });
  }, []);

  const clearAllRequests = useCallback(() => {
    setRequests([]);
    setManual({});
  }, []);

  const reset = useCallback(() => {
    setRequests(SEED_REQUESTS);
    setManual({});
    setFaulty(false);
  }, []);

  const toggleFault = useCallback(() => setFaulty((f) => !f), []);

  return {
    requests: effectiveRequests,
    places,
    manual,
    now,
    result,
    error,
    faulty,
    assignManual,
    clearManual,
    removeRequest,
    clearAllRequests,
    reset,
    toggleFault,
  };
}

import type { Place } from './types';
import type { RequestOutcome, SolveResult } from './matching';
import { explainUnresolved, validateChoice } from './matching';

export interface PlaceLoad {
  place: Place;
  assigned: number;
  capacity: number;
  status: 'free' | 'full' | 'overloaded';
  /** Доля заполнения (может быть > 1 при переполнении). */
  ratio: number;
}

export interface ProblemRequest {
  outcome: RequestOutcome;
  /** Вес проблемы — чем больше, тем выше в списке. */
  severity: number;
  reasons: string[];
}

export interface Report {
  total: number;
  assignedCount: number;
  unresolvedCount: number;
  manualCount: number;
  overdueCount: number;
  placeLoads: PlaceLoad[];
  overloaded: PlaceLoad[];
  problems: ProblemRequest[];
}

export function buildReport(result: SolveResult): Report {
  const { outcomes, occupancy, places } = result;

  const placeLoads: PlaceLoad[] = places.map((place) => {
    const assigned = occupancy[place.id] ?? 0;
    const status: PlaceLoad['status'] =
      assigned > place.capacity
        ? 'overloaded'
        : assigned === place.capacity && place.capacity > 0
          ? 'full'
          : 'free';
    return {
      place,
      assigned,
      capacity: place.capacity,
      status,
      ratio: place.capacity > 0 ? assigned / place.capacity : assigned,
    };
  });

  const assignedCount = outcomes.filter((o) => o.assignedPlaceId).length;
  const unresolvedCount = outcomes.length - assignedCount;
  const manualCount = outcomes.filter((o) => o.manual).length;
  const overdueCount = outcomes.filter(
    (o) => o.deadlineStatus === 'overdue',
  ).length;

  const problems = collectProblems(result);

  return {
    total: outcomes.length,
    assignedCount,
    unresolvedCount,
    manualCount,
    overdueCount,
    placeLoads,
    overloaded: placeLoads.filter((l) => l.status === 'overloaded'),
    problems,
  };
}

function collectProblems(result: SolveResult): ProblemRequest[] {
  const problems: ProblemRequest[] = [];

  for (const outcome of result.outcomes) {
    const reasons: string[] = [];
    let severity = 0;

    if (outcome.deadlineStatus === 'overdue') {
      reasons.push('дедлайн просрочен');
      severity += 50;
    }

    if (!outcome.assignedPlaceId) {
      const why = explainUnresolved(outcome, result);
      reasons.push(`без места — ${why.text.toLowerCase()}`);
      severity += 100;
    } else {
      // Назначено — но, возможно, с нарушениями (чаще при ручном выборе).
      const warnings = validateChoice(
        outcome,
        outcome.assignedPlaceId,
        result,
      );
      for (const w of warnings) {
        reasons.push(w.text.toLowerCase().replace(/\.$/, ''));
        severity += w.severity === 'error' ? 40 : 15;
      }

      // Назначено, но сигнал слабый.
      const evaluation = outcome.evaluations.find(
        (e) => e.placeId === outcome.assignedPlaceId,
      );
      if (evaluation && evaluation.compatible && evaluation.score < 0.5) {
        reasons.push(`слабый сигнал ${Math.round(evaluation.score * 100)}%`);
        severity += Math.round((0.5 - evaluation.score) * 40);
      }
    }

    if (reasons.length > 0) {
      problems.push({ outcome, severity, reasons });
    }
  }

  return problems.sort((a, b) => b.severity - a.severity);
}

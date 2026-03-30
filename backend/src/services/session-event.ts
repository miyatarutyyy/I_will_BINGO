import { MAX_BINGO_NUMBER, MIN_BINGO_NUMBER } from "../constants/bingo.js";
import type {
  EventChoiceOption,
  EventDirection,
  EventSegment,
  EventState,
  ResolvedEventSegment,
} from "../types/session.js";

const shuffle = <T>(items: T[]): T[] => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [
      nextItems[randomIndex],
      nextItems[index],
    ];
  }

  return nextItems;
};

export const getClockwiseStep = (from: number, to: number): number => {
  return (to - from + MAX_BINGO_NUMBER) % MAX_BINGO_NUMBER;
};

export const getCounterClockwiseStep = (from: number, to: number): number => {
  return getClockwiseStep(from, to) - MAX_BINGO_NUMBER;
};

const buildChoiceLabel = (step: number): string => {
  return step > 0 ? `+${step}` : `${step}`;
};

export const buildEventChoiceOptions = (segment: EventSegment): EventChoiceOption[] => {
  return [
    {
      direction: "clockwise",
      step: segment.clockwiseStep,
      label: buildChoiceLabel(segment.clockwiseStep),
    },
    {
      direction: "counterclockwise",
      step: segment.counterClockwiseStep,
      label: buildChoiceLabel(segment.counterClockwiseStep),
    },
  ];
};

export const createEventState = (params: {
  playerIds: string[];
  decidedNumbers: number[];
  startNumber: number;
}): EventState => {
  const candidateGoalNumbers: number[] = [];

  for (let value = MIN_BINGO_NUMBER; value <= MAX_BINGO_NUMBER; value += 1) {
    if (params.decidedNumbers.includes(value) || value === params.startNumber) {
      continue;
    }

    candidateGoalNumbers.push(value);
  }

  const goalNumber =
    candidateGoalNumbers[
      Math.floor(Math.random() * candidateGoalNumbers.length)
    ];
  const relaySourceNumbers = shuffle(
    candidateGoalNumbers.filter((value) => value !== goalNumber),
  );
  const relayNumbers = relaySourceNumbers.slice(0, params.playerIds.length - 1);
  const pathNodes = [params.startNumber, ...relayNumbers, goalNumber];
  const assignedPlayerIds = shuffle(params.playerIds);
  const segments: EventSegment[] = [];

  for (let index = 0; index < assignedPlayerIds.length; index += 1) {
    const from = pathNodes[index];
    const to = pathNodes[index + 1];
    const clockwiseStep = getClockwiseStep(from, to);

    segments.push({
      order: index,
      assignedPlayerId: assignedPlayerIds[index],
      from,
      to,
      clockwiseStep,
      counterClockwiseStep: clockwiseStep - MAX_BINGO_NUMBER,
      selectedDirection: null,
      selectedStep: null,
    });
  }

  return {
    startNumber: params.startNumber,
    goalNumber,
    relayNumbers,
    segments,
    resolvedTimeline: [],
  };
};

export const getPlayerEventSegment = (
  eventState: EventState,
  playerId: string,
): EventSegment | null => {
  return (
    eventState.segments.find((segment) => segment.assignedPlayerId === playerId) ??
    null
  );
};

export const resolveEventSegmentChoice = (
  segment: EventSegment,
  direction: EventDirection,
): EventSegment => {
  return {
    ...segment,
    selectedDirection: direction,
    selectedStep:
      direction === "clockwise"
        ? segment.clockwiseStep
        : segment.counterClockwiseStep,
  };
};

export const buildResolvedTimeline = (
  eventState: EventState,
): ResolvedEventSegment[] => {
  return eventState.segments.map((segment) => {
    if (segment.selectedDirection === null || segment.selectedStep === null) {
      throw new Error("未提出のイベント区間があります。");
    }

    return {
      order: segment.order,
      playerId: segment.assignedPlayerId,
      from: segment.from,
      to: segment.to,
      direction: segment.selectedDirection,
      selectedStep: segment.selectedStep,
    };
  });
};

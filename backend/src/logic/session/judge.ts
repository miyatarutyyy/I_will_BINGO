// backend/src/logic/session/judge.ts

import { MAX_BINGO_NUMBER } from "../../constants/bingo.js";
import type {
  SessionEndCondition,
  SessionEndReason,
} from "../../types/session.js";

export const createDefaultEndCondition = (): SessionEndCondition => {
  return {
    bingoCount: 1,
    finishWhenAllNumbersDrawn: true,
  };
};

export const judgeSessionEnd = (
  params: {
    bingoCount: number;
    drawnNumbers: number[];
    endCondition: SessionEndCondition;
  },
): SessionEndReason => {
  if (params.bingoCount >= params.endCondition.bingoCount) {
    return "bingo";
  }

  if (
    params.endCondition.finishWhenAllNumbersDrawn &&
    params.drawnNumbers.length >= MAX_BINGO_NUMBER
  ) {
    return "all_numbers_drawn";
  }

  return null;
};

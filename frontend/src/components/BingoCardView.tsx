import type { BingoCard } from "../types/game";

type BingoCardViewProps = {
  card: BingoCard | null;
  interactive?: boolean;
  highlightedPositions?: Set<number>;
  matchingPositionId?: number | null;
  isBusy: boolean;
  onAct?: () => void;
};

export const BingoCardView = ({
  card,
  interactive = false,
  highlightedPositions,
  matchingPositionId = null,
  isBusy,
  onAct,
}: BingoCardViewProps) => {
  if (!card) {
    return <p className="empty-state">カードはまだ配布されていません。</p>;
  }

  return (
    <div className="bingo-card">
      {card.cells.map((cell) => {
        const isDrawTarget = interactive && matchingPositionId === cell.positionId;
        const isHighlighted = highlightedPositions?.has(cell.positionId) ?? false;

        return (
          <button
            key={cell.positionId}
            type="button"
            className={[
              "card-cell",
              cell.isOpened ? "opened" : "",
              cell.isFree ? "free" : "",
              isDrawTarget ? "target" : "",
              isHighlighted ? "winning" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!isDrawTarget || isBusy}
            onClick={isDrawTarget ? onAct : undefined}
          >
            <span className="cell-value">{cell.isFree ? "FREE" : cell.value}</span>
          </button>
        );
      })}
    </div>
  );
};

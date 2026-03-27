import { BingoCardView } from "./BingoCardView";
import type { PlayerSummary } from "../types/game";

type ResultScreenProps = {
  resultHeadline: string;
  winners: PlayerSummary[];
  getHighlightedPositions: (player: PlayerSummary) => Set<number>;
  onReturnToTitle: () => void;
  isBusy: boolean;
};

export const ResultScreen = ({
  resultHeadline,
  winners,
  getHighlightedPositions,
  onReturnToTitle,
  isBusy,
}: ResultScreenProps) => {
  return (
    <main className="screen result-screen">
      <section className="result-header">
        <h2>{resultHeadline}</h2>
      </section>

      <section className="winner-stack">
        {winners.map((winner) => (
          <article key={winner.id} className="panel winner-panel">
            <div className="panel-header-row">
              <h3>{winner.name}</h3>
              <span className="status-badge champion">WINNER</span>
            </div>
            <BingoCardView
              card={winner.card}
              highlightedPositions={getHighlightedPositions(winner)}
              isBusy={isBusy}
            />
          </article>
        ))}
      </section>

      <div className="result-actions">
        <button
          type="button"
          className="primary-button"
          onClick={onReturnToTitle}
        >
          ゲームを終了
        </button>
      </div>
    </main>
  );
};

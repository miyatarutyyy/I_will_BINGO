import { BingoCardView } from "./BingoCardView";
import type { PlayerSummary, Room, RoundPhase } from "../types/game";

type GameScreenProps = {
  room: Room | null;
  currentPlayer: PlayerSummary | null;
  currentPhase: RoundPhase;
  syncStatus: string;
  isHost: boolean;
  isBusy: boolean;
  canAct: boolean;
  matchingPositionId: number | null;
  onAct: () => void;
  onNextRound: () => void;
};

export const GameScreen = ({
  room,
  currentPlayer,
  syncStatus,
  isHost,
  isBusy,
  canAct,
  matchingPositionId,
  onAct,
  onNextRound,
}: GameScreenProps) => {
  void syncStatus;
  const isWaitingForNextRound =
    room?.currentSession.phase === "waiting_for_host_next_round";
  const hasMatchingCell = matchingPositionId !== null;
  const bingoCount = currentPlayer?.bingoCount ?? 0;
  const reachCount = currentPlayer?.reachCount ?? 0;
  const scoreBadgeClassName =
    bingoCount > 0
      ? "status-badge bingo"
      : reachCount > 0
        ? "status-badge reach"
        : "status-badge neutral";

  const renderProgressButton = () => {
    if (canAct) {
      if (hasMatchingCell) {
        return (
          <button type="button" className="secondary-button" disabled>
            番号のマスを開いてください
          </button>
        );
      }

      return (
        <button
          type="button"
          className="primary-button"
          onClick={onAct}
          disabled={isBusy}
        >
          スキップする
        </button>
      );
    }

    if (isWaitingForNextRound) {
      if (isHost) {
        return (
          <button
            type="button"
            className="primary-button accent-button"
            onClick={onNextRound}
            disabled={isBusy}
          >
            次のラウンドを始める
          </button>
        );
      }

      return (
        <button type="button" className="secondary-button" disabled>
          次のラウンドが始まります
        </button>
      );
    }

    return (
      <button type="button" className="secondary-button" disabled>
        他プレイヤーの操作待ちです
      </button>
    );
  };

  return (
    <main className="screen game-screen">
      <section className="game-topbar">
        <div className="current-number-card">
          <strong>{room?.currentSession.currentDrawnNumber ?? "-"}</strong>
        </div>
      </section>

      <section className="game-layout">
        <article className="panel board-panel">
          <div className="panel-header-row">
            {
              // <h3>{currentPlayer?.name ?? "Player"} のカード</h3>
            }
            <span
              className={scoreBadgeClassName}
              style={{ width: "100%", textAlign: "center" }}
            >
              Bingo {bingoCount} / Reach {reachCount}
            </span>
          </div>
          <BingoCardView
            card={currentPlayer?.card ?? null}
            interactive={canAct}
            matchingPositionId={matchingPositionId}
            isBusy={isBusy}
            onAct={onAct}
          />
          {
            // <div className="action-strip">
            //   {canAct ? (
            //     matchingPositionId !== null ? (
            //       <p>
            //         光っているマスを押して、このラウンドのアクションを完了します。
            //       </p>
            //     ) : (
            //       <p>
            //         今回の番号はあなたのカードにありません。下のスキップするボタンでこのラウンドを完了します。
            //       </p>
            //     )
            //   ) : (
            //     <p>
            //       {currentPlayer?.hasActedThisRound
            //         ? "このラウンドの操作は完了しています。"
            //         : "現在はあなたの操作ターンではありません。"}
            //     </p>
            //   )}
            // </div>
          }
        </article>

        <aside className="game-side">
          {
            //<section className="panel">
            // <h3>参加プレイヤー</h3>
            // <div className="player-list compact">
            //   {room?.players.map((player) => (
            //     <div key={player.id} className="player-row">
            //       <div>
            //         <strong>{player.name}</strong>
            //         <p>{player.id === room.hostPlayerId ? "HOST" : "PLAYER"}</p>
            //       </div>
            //       <span
            //         className={`mini-badge ${player.hasActedThisRound ? "ready" : ""}`}
            //       >
            //         {player.hasActedThisRound ? "DONE" : "TURN"}
            //       </span>
            //     </div>
            //   ))}
            // </div>
            //</section>
          }

          {
            // <section className="panel">
            //   <h3>抽選履歴</h3>
            //   <div className="draw-history">
            //     {room?.currentSession.drawnNumbers.map((value) => (
            //       <span key={value} className="draw-chip">
            //         {value}
            //       </span>
            //     ))}
            //   </div>
            // </section>
          }

          <section className="panel">
            {
              //<h3>進行操作</h3>
            }
            {renderProgressButton()}
          </section>
        </aside>
      </section>
    </main>
  );
};

import { BingoCardView } from "./BingoCardView";
import { getPhaseLabel } from "../lib/game";
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
  currentPhase,
  syncStatus,
  isHost,
  isBusy,
  canAct,
  matchingPositionId,
  onAct,
  onNextRound,
}: GameScreenProps) => {
  return (
    <main className="screen game-screen">
      <section className="game-topbar">
        <div>
          <p className="panel-kicker">Game Session</p>
          <h2>Round {room?.currentSession.round}</h2>
        </div>
        <div className="session-stats">
          <div>
            <span>現在の番号</span>
            <strong>{room?.currentSession.currentDrawnNumber ?? "-"}</strong>
          </div>
          <div>
            <span>フェーズ</span>
            <strong>{getPhaseLabel(currentPhase)}</strong>
          </div>
          <div hidden>
            {/* 現在は UI 上で使っていないため非表示のまま保持しています。 */}
            <span>同期</span>
            <strong>{syncStatus}</strong>
          </div>
        </div>
      </section>

      <section className="game-layout">
        <article className="panel board-panel">
          <div className="panel-header-row">
            <h3>{currentPlayer?.name ?? "Player"} のカード</h3>
            <span className="status-badge">
              Bingo {currentPlayer?.bingoCount ?? 0} / Reach {currentPlayer?.reachCount ?? 0}
            </span>
          </div>
          <BingoCardView
            card={currentPlayer?.card ?? null}
            interactive={canAct}
            matchingPositionId={matchingPositionId}
            isBusy={isBusy}
            onAct={onAct}
          />
          <div className="action-strip">
            {canAct ? (
              matchingPositionId !== null ? (
                <p>光っているマスを押して、このラウンドのアクションを完了します。</p>
              ) : (
                <>
                  <p>今回の番号はあなたのカードにありません。完了ボタンでラウンドを進めます。</p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={onAct}
                    disabled={isBusy}
                  >
                    該当なしで完了
                  </button>
                </>
              )
            ) : (
              <p>
                {currentPlayer?.hasActedThisRound
                  ? "このラウンドの操作は完了しています。"
                  : "現在はあなたの操作ターンではありません。"}
              </p>
            )}
          </div>
        </article>

        <aside className="game-side">
          <section className="panel">
            <h3>参加プレイヤー</h3>
            <div className="player-list compact">
              {room?.players.map((player) => (
                <div key={player.id} className="player-row">
                  <div>
                    <strong>{player.name}</strong>
                    <p>{player.id === room.hostPlayerId ? "HOST" : "PLAYER"}</p>
                  </div>
                  <span className={`mini-badge ${player.hasActedThisRound ? "ready" : ""}`}>
                    {player.hasActedThisRound ? "DONE" : "TURN"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>抽選履歴</h3>
            <div className="draw-history">
              {room?.currentSession.drawnNumbers.map((value) => (
                <span key={value} className="draw-chip">
                  {value}
                </span>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>進行操作</h3>
            {isHost ? (
              <button
                type="button"
                className="primary-button accent-button"
                onClick={onNextRound}
                disabled={
                  isBusy ||
                  room?.currentSession.phase !== "waiting_for_host_next_round"
                }
              >
                次のラウンドへ
              </button>
            ) : (
              <p className="panel-copy">
                全員のアクションが終わると、ホストが次のラウンドを開始します。
              </p>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
};

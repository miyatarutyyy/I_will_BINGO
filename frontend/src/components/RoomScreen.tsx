import { getPhaseLabel } from "../lib/game";
import type { PlayerSummary, Room, RoundPhase } from "../types/game";

type RoomScreenProps = {
  room: Room | null;
  playerId: string;
  currentPlayer: PlayerSummary | null;
  currentPhase: RoundPhase;
  isHost: boolean;
  canStart: boolean;
  isBusy: boolean;
  onCopyRoomId: () => void;
  onPrepare: () => void;
  onStartSession: () => void;
  onReturnToTitle: () => void;
};

export const RoomScreen = ({
  room,
  playerId,
  currentPlayer,
  currentPhase,
  isHost,
  canStart,
  isBusy,
  onCopyRoomId,
  onPrepare,
  onStartSession,
  onReturnToTitle,
}: RoomScreenProps) => {
  return (
    <main className="screen room-screen">
      <section className="room-hero">
        <div>
          <p className="panel-kicker">Room Lobby</p>
          <h2>ルーム待機画面</h2>
        </div>
        <div className="room-id-card">
          <span>ROOM ID</span>
          <div className="room-id-row">
            <strong>{room?.id}</strong>
            <button
              type="button"
              className="copy-button"
              onClick={onCopyRoomId}
              disabled={isBusy}
            >
              コピー
            </button>
          </div>
        </div>
      </section>

      <section className="room-layout">
        <article className="panel">
          <div className="panel-header-row">
            <h3>プレイヤー</h3>
            <span className="status-badge">{getPhaseLabel(currentPhase)}</span>
          </div>
          <div className="player-list">
            {room?.players.map((player) => {
              const isCurrent = player.id === playerId;
              const hasCard = player.card !== null;

              return (
                <div key={player.id} className={`player-row ${isCurrent ? "current" : ""}`}>
                  <div>
                    <strong>
                      {player.name}
                      {player.id === room.hostPlayerId ? " / HOST" : ""}
                    </strong>
                    <p>
                      {player.isReadyForStart
                        ? "準備完了"
                        : hasCard
                          ? "FREE マス待ち"
                          : "カード未配布"}
                    </p>
                  </div>
                  <span className={`mini-badge ${player.isReadyForStart ? "ready" : ""}`}>
                    {player.isReadyForStart ? "READY" : "WAIT"}
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="panel action-panel">
          <h3>準備</h3>

          {currentPlayer && !currentPlayer.isReadyForStart ? (
            <button
              type="button"
              className="primary-button"
              onClick={onPrepare}
              disabled={isBusy || currentPhase !== "waiting_for_ready"}
            >
              準備OK
            </button>
          ) : (
            <div className="info-card success">準備完了</div>
          )}

          {isHost ? (
            <button
              type="button"
              className="primary-button accent-button"
              onClick={onStartSession}
              disabled={isBusy || !canStart}
            >
              セッションを開始
            </button>
          ) : (
            <div className="info-card">ホストの開始を待機中です。</div>
          )}

          <button
            type="button"
            className="secondary-button"
            onClick={onReturnToTitle}
            disabled={isBusy}
          >
            タイトルに戻る
          </button>
        </aside>
      </section>
    </main>
  );
};

import { getPhaseLabel } from "../lib/game";
import type { PlayerSummary, Room, RoundPhase } from "../types/game";

type RoomScreenProps = {
  room: Room | null;
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
        <div style={{ display: "flex" }}>
          <h2>ルーム待機画面</h2>
          {
            //<p className="panel-kicker">Room Lobby</p>
          }
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
            <h3>プレイヤーリスト</h3>
            <span className="status-badge">{getPhaseLabel(currentPhase)}</span>
          </div>
          <div className="player-list">
            {room?.players.map((player) => {
              return (
                <div key={player.id} className="player-row">
                  <div>
                    <strong>
                      {player.name}
                      {player.id === room.hostPlayerId ? " / HOST" : ""}
                    </strong>
                  </div>
                  <span
                    className={`mini-badge ${player.isReadyForStart ? "ready" : ""}`}
                  >
                    {player.isReadyForStart ? "READY" : "WAIT"}
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="panel action-panel">
          {currentPlayer && !currentPlayer.isReadyForStart ? (
            <button
              type="button"
              className="primary-button"
              onClick={onPrepare}
              disabled={isBusy || currentPhase !== "waiting_for_ready"}
            >
              {isHost ? "参加を締め切る" : "準備ができたら押してください"}
            </button>
          ) : (
            <button
              type="button"
              className="info-card success status-button"
              disabled
            >
              準備完了
            </button>
          )}

          {isHost ? (
            canStart ? (
              <button
                type="button"
                className="primary-button accent-button"
                onClick={onStartSession}
                disabled={isBusy}
              >
                セッションを開始
              </button>
            ) : (
              <button
                type="button"
                className="primary-button accent-button"
                onClick={onStartSession}
                disabled
              >
                全員が準備できたら開始できます
              </button>
            )
          ) : (
            <button type="button" className="info-card status-button" disabled>
              {getPhaseLabel(currentPhase) === "開始待ち"
                ? "ホストが開始するまで待ってください"
                : "他のプレイヤーが準備中です"}
            </button>
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

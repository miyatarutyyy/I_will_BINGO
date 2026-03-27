import { getPhaseLabel } from "../lib/game";
import type { PlayerSummary, Room, RoundPhase } from "../types/game";

type RoomScreenProps = {
  room: Room | null;
  currentPlayer: PlayerSummary | null;
  currentPhase: RoundPhase;
  isHost: boolean;
  canStart: boolean;
  isBusy: boolean;
  isLeaveModalOpen: boolean;
  onCopyRoomId: () => void;
  onPrepare: () => void;
  onStartSession: () => void;
  onOpenLeaveModal: () => void;
  onCloseLeaveModal: () => void;
  onConfirmLeave: () => void;
};

export const RoomScreen = ({
  room,
  currentPlayer,
  currentPhase,
  isHost,
  canStart,
  isBusy,
  isLeaveModalOpen,
  onCopyRoomId,
  onPrepare,
  onStartSession,
  onOpenLeaveModal,
  onCloseLeaveModal,
  onConfirmLeave,
}: RoomScreenProps) => {
  const leaveConfirmMessage = isHost
    ? "ホストプレイヤーが退室すると、参加している他のプレイヤーも退室します。退室してよろしいですか？"
    : "ホストプレイヤーが参加を締め切った後の再入室はできません。ルームを退室してよろしいですか？";

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
            onClick={onOpenLeaveModal}
            disabled={isBusy}
          >
            ルームを退室する
          </button>
        </aside>
      </section>

      {isLeaveModalOpen ? (
        <div className="modal-overlay" role="presentation">
          <section
            className="title-modal leave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-modal-heading"
          >
            <h2 id="leave-modal-heading">ルームを退室する</h2>
            <p className="panel-copy">{leaveConfirmMessage}</p>
            <div className="leave-modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={onConfirmLeave}
                disabled={isBusy}
              >
                はい
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={onCloseLeaveModal}
                disabled={isBusy}
              >
                いいえ
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
};

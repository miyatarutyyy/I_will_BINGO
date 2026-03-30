import type { FormEventHandler } from "react";

import { trimText } from "../lib/game";
import type { PendingRoomDraft, TitleModal } from "../types/game";

type TitleScreenProps = {
  playerName: string;
  roomIdInput: string;
  titleModal: TitleModal;
  pendingRoomDraft: PendingRoomDraft | null;
  isBusy: boolean;
  isBootstrapping: boolean;
  onPlayerNameChange: (value: string) => void;
  onRoomIdInputChange: (value: string) => void;
  onOpenCreateModal: () => void;
  onOpenJoinModal: () => void;
  onCancelCreateModal: () => void;
  onCloseJoinModal: () => void;
  onConfirmCreateRoom: () => void;
  onJoinRoom: FormEventHandler<HTMLFormElement>;
  onCopyDraftRoomId: () => void;
};

export const TitleScreen = ({
  playerName,
  roomIdInput,
  titleModal,
  pendingRoomDraft,
  isBusy,
  isBootstrapping,
  onPlayerNameChange,
  onRoomIdInputChange,
  onOpenCreateModal,
  onOpenJoinModal,
  onCancelCreateModal,
  onCloseJoinModal,
  onConfirmCreateRoom,
  onJoinRoom,
  onCopyDraftRoomId,
}: TitleScreenProps) => {
  return (
    <main className="screen title-screen">
      <section className="title-panel">
        <p className="panel-kicker">Change Your Destiny</p>
        <h1>I Will BINGO</h1>
        <label className="field">
          <input
            value={playerName}
            onChange={(event) => onPlayerNameChange(event.target.value)}
            placeholder="プレイヤー名を入力"
            maxLength={24}
          />
        </label>

        <div className="join-stack">
          <button
            type="button"
            className="secondary-button"
            onClick={onOpenCreateModal}
            disabled={isBusy || isBootstrapping}
          >
            ルームを作成
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={onOpenJoinModal}
            disabled={isBusy || isBootstrapping}
          >
            ルームに参加
          </button>
        </div>
      </section>

      {titleModal !== "closed" ? (
        <div className="modal-overlay" role="presentation">
          <section
            className="title-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="title-modal-heading"
          >
            <button
              type="button"
              className="icon-button"
              onClick={
                titleModal === "create" ? onCancelCreateModal : onCloseJoinModal
              }
              disabled={isBusy}
              aria-label="前の画面に戻る"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M14.5 5.5L8 12l6.5 6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
            </button>

            {titleModal === "create" ? (
              <>
                <h2
                  id="title-modal-heading"
                  style={{
                    textAlign: "center",
                    marginBottom: "5px",
                  }}
                >
                  ルームを作成
                </h2>

                <div className="modal-stack">
                  <div className="modal-card">
                    <span>ホストプレイヤー名</span>
                    <strong>{trimText(playerName)}</strong>
                  </div>

                  <div className="modal-card">
                    <span>ルームID</span>
                    <div className="modal-room-id">
                      <strong>{pendingRoomDraft?.room.id ?? ""}</strong>
                      <button
                        type="button"
                        className="copy-button"
                        onClick={onCopyDraftRoomId}
                        disabled={isBusy || !pendingRoomDraft}
                      >
                        コピー
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={onConfirmCreateRoom}
                    disabled={isBusy || !pendingRoomDraft}
                  >
                    作成
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="title-modal-heading"
                  style={{
                    textAlign: "center",
                    marginBottom: "5px",
                  }}
                >
                  ルームに参加
                </h2>
                <form className="modal-stack" onSubmit={onJoinRoom}>
                  <label className="field modal-field">
                    <input
                      value={roomIdInput}
                      onChange={(event) =>
                        onRoomIdInputChange(event.target.value)
                      }
                      placeholder="共有されたルームIDを入力"
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isBusy}
                  >
                    参加
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
};

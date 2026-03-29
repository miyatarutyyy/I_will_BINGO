import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { BingoCardView } from "./BingoCardView";
import { DrawRevealModal } from "./DrawRevealModal";
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
  const [activeDrawKey, setActiveDrawKey] = useState("");
  const [isDrawRevealActive, setIsDrawRevealActive] = useState(false);
  const [isDrawAnimating, setIsDrawAnimating] = useState(false);
  const lastPresentedDrawKeyRef = useRef("");
  const scoreBadgeClassName =
    bingoCount > 0
      ? "status-badge bingo"
      : reachCount > 0
        ? "status-badge reach"
        : "status-badge neutral";
  const currentDrawnNumber = room?.currentSession.currentDrawnNumber ?? null;
  const eventGauge = room?.currentSession.eventGauge ?? 0;
  const eventGaugeMax = room?.currentSession.eventGaugeMax ?? 0;
  const eventGaugeProgress =
    eventGaugeMax > 0
      ? Math.min(100, Math.round((eventGauge / eventGaugeMax) * 100))
      : 0;
  const numberGaugeStyle = {
    "--gauge-progress": `${eventGaugeProgress}%`,
    "--gauge-progress-soft": `${eventGaugeProgress * 0.7}%`,
  } as CSSProperties;
  const canActNow = canAct && !isDrawAnimating;
  const drawPresentationKey =
    room?.currentSession.status === "in_progress" && currentDrawnNumber !== null
      ? `${room.currentSession.id}:${room.currentSession.round}:${currentDrawnNumber}`
      : "";

  useEffect(() => {
    if (drawPresentationKey === "") {
      setIsDrawRevealActive(false);
      setIsDrawAnimating(false);
      return;
    }

    if (drawPresentationKey === lastPresentedDrawKeyRef.current) return;

    lastPresentedDrawKeyRef.current = drawPresentationKey;
    setActiveDrawKey(drawPresentationKey);
    setIsDrawRevealActive(true);
  }, [drawPresentationKey]);

  const renderProgressButton = () => {
    if (isDrawAnimating) {
      return (
        <button type="button" className="secondary-button" disabled>
          抽選中
        </button>
      );
    }

    if (canActNow) {
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
          <div
            className={`number-gauge-orb ${eventGauge <= 0 ? "is-empty" : ""}`}
            style={numberGaugeStyle}
          >
            <div className="number-gauge-core">
              <DrawRevealModal
                animationKey={activeDrawKey}
                isOpen={isDrawRevealActive}
                targetNumber={currentDrawnNumber}
                onAnimationStateChange={setIsDrawAnimating}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="game-layout">
        <article className="panel board-panel" style={{ borderRadius: "0px" }}>
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
            interactive={canActNow}
            matchingPositionId={matchingPositionId}
            isBusy={isBusy || isDrawAnimating}
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

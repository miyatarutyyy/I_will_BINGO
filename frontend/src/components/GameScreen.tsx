import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { BingoCardView } from "./BingoCardView";
import { DrawRevealModal } from "./DrawRevealModal";
import type {
  EventChoice,
  EventDirection,
  PlayerSummary,
  Room,
  RoundPhase,
} from "../types/game";

type GameScreenProps = {
  room: Room | null;
  currentPlayer: PlayerSummary | null;
  currentPhase: RoundPhase;
  syncStatus: string;
  isHost: boolean;
  isBusy: boolean;
  canAct: boolean;
  matchingPositionId: number | null;
  isEventChoicePending: boolean;
  eventChoice: EventChoice | null;
  onAct: () => void;
  onNextRound: () => void;
  onSubmitEventChoice: (direction: EventDirection) => void;
};

const MAX_BINGO_NUMBER = 75;

const getNextEventValue = (value: number, direction: EventDirection) => {
  if (direction === "clockwise") {
    return value === MAX_BINGO_NUMBER ? 1 : value + 1;
  }

  return value === 1 ? MAX_BINGO_NUMBER : value - 1;
};

const buildEventTrackValues = (
  from: number,
  to: number,
  direction: EventDirection,
) => {
  const values = [from];
  let currentValue = from;

  while (currentValue !== to) {
    currentValue = getNextEventValue(currentValue, direction);
    values.push(currentValue);
  }

  return values;
};

export const GameScreen = ({
  room,
  currentPlayer,
  syncStatus,
  isHost,
  isBusy,
  canAct,
  matchingPositionId,
  isEventChoicePending,
  eventChoice,
  onAct,
  onNextRound,
  onSubmitEventChoice,
}: GameScreenProps) => {
  void syncStatus;
  const isWaitingForNextRound =
    room?.currentSession.phase === "waiting_for_host_next_round";
  const hasMatchingCell = matchingPositionId !== null;
  const bingoCount = currentPlayer?.bingoCount ?? 0;
  const reachCount = currentPlayer?.reachCount ?? 0;
  const [isDrawAnimating, setIsDrawAnimating] = useState(false);
  const [completedDrawPresentationKey, setCompletedDrawPresentationKey] =
    useState("");
  const [isEventAnimating, setIsEventAnimating] = useState(false);
  const [eventStepLabel, setEventStepLabel] = useState<string | null>(null);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [showEventModalDetails, setShowEventModalDetails] = useState(false);
  const [selectedEventDirection, setSelectedEventDirection] =
    useState<EventDirection | null>(null);
  const [eventTransition, setEventTransition] = useState<{
    key: string;
    values: number[];
  } | null>(null);
  const previousDrawAnimatingRef = useRef(false);
  const lastDrawPresentationKeyRef = useRef("");
  const startedAnimationIdsRef = useRef(new Set<string>());
  const scoreBadgeClassName =
    bingoCount > 0
      ? "status-badge bingo"
      : reachCount > 0
        ? "status-badge reach"
        : "status-badge neutral";
  const currentDrawnNumber = room?.currentSession.currentDrawnNumber ?? null;
  const currentEvent = room?.currentSession.currentEvent ?? null;
  const resolvedTimeline = useMemo(
    () => currentEvent?.resolvedTimeline ?? [],
    [currentEvent],
  );
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
  const drawPresentationKey =
    room?.currentSession.status === "in_progress" && currentDrawnNumber !== null
      ? `${room.currentSession.id}:${room.currentSession.round}:${currentDrawnNumber}`
      : "";
  const resolvedEventAnimationId =
    currentEvent?.animationId && resolvedTimeline.length > 0
      ? currentEvent.animationId
      : "";
  const isResolvedEventReady = resolvedEventAnimationId !== "";
  const isDrawRevealActive =
    drawPresentationKey !== "" && !isResolvedEventReady;
  const canActNow = canAct && !isDrawAnimating && !isEventAnimating;
  const isEventModalOpen =
    isEventChoicePending &&
    !isDrawAnimating &&
    completedDrawPresentationKey === drawPresentationKey;
  const hasSubmittedEventChoice =
    currentPlayer?.hasSubmittedEventChoice ?? false;

  useEffect(() => {
    if (drawPresentationKey === "") {
      lastDrawPresentationKeyRef.current = "";
      setCompletedDrawPresentationKey("");
      return;
    }

    if (drawPresentationKey !== lastDrawPresentationKeyRef.current) {
      lastDrawPresentationKeyRef.current = drawPresentationKey;
      setCompletedDrawPresentationKey(
        isResolvedEventReady ? drawPresentationKey : "",
      );
    }
  }, [drawPresentationKey, isResolvedEventReady]);

  useEffect(() => {
    const wasAnimating = previousDrawAnimatingRef.current;

    if (
      wasAnimating &&
      !isDrawAnimating &&
      isDrawRevealActive &&
      drawPresentationKey !== ""
    ) {
      setCompletedDrawPresentationKey(drawPresentationKey);
    }

    previousDrawAnimatingRef.current = isDrawAnimating;
  }, [drawPresentationKey, isDrawAnimating, isDrawRevealActive]);

  useEffect(() => {
    if (!isEventModalOpen) {
      setShowEventModalDetails(false);
      setSelectedEventDirection(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowEventModalDetails(true);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isEventModalOpen]);

  useEffect(() => {
    if (!eventChoice || hasSubmittedEventChoice) {
      setSelectedEventDirection(null);
      return;
    }

    setSelectedEventDirection((currentDirection) => {
      if (
        currentDirection &&
        eventChoice.options.some(
          (option) => option.direction === currentDirection,
        )
      ) {
        return currentDirection;
      }

      return eventChoice.options[0]?.direction ?? null;
    });
  }, [eventChoice, hasSubmittedEventChoice]);

  useEffect(() => {
    if (!currentEvent || resolvedEventAnimationId === "") return;
    if (startedAnimationIdsRef.current.has(resolvedEventAnimationId)) return;

    const sortedTimeline = [...resolvedTimeline].sort(
      (left, right) => left.order - right.order,
    );
    const timeoutIds: number[] = [];
    let elapsed = 0;

    timeoutIds.push(
      window.setTimeout(() => {
        startedAnimationIdsRef.current.add(resolvedEventAnimationId);
        setIsEventAnimating(true);
        setDisplayNumber(currentEvent.startNumber);
        setEventStepLabel(null);
        setEventTransition(null);
      }, 0),
    );

    for (const segment of sortedTimeline) {
      const stepLabel =
        segment.selectedStep > 0
          ? `+${segment.selectedStep}`
          : `${segment.selectedStep}`;

      timeoutIds.push(
        window.setTimeout(() => {
          setEventStepLabel(stepLabel);
        }, elapsed),
      );

      elapsed += 520;

      timeoutIds.push(
        window.setTimeout(() => {
          const values = buildEventTrackValues(
            segment.from,
            segment.to,
            segment.direction,
          );

          setEventTransition({
            key: `${resolvedEventAnimationId}:${segment.order}`,
            values,
          });
        }, elapsed),
      );

      elapsed += 760;

      timeoutIds.push(
        window.setTimeout(() => {
          setDisplayNumber(segment.to);
          setEventTransition(null);
          setEventStepLabel(null);
        }, elapsed),
      );

      elapsed += 180;
    }

    timeoutIds.push(
      window.setTimeout(() => {
        setDisplayNumber(currentEvent.goalNumber);
        setEventTransition(null);
        setEventStepLabel(null);
        setIsEventAnimating(false);
      }, elapsed),
    );

    return () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [currentEvent, resolvedEventAnimationId, resolvedTimeline]);

  const eventTrackStyle = useMemo(() => {
    if (!eventTransition) return undefined;

    const trackLength = eventTransition.values.length;

    return {
      "--event-track-length": `${trackLength}`,
      "--event-track-end": `${((trackLength - 1) / trackLength) * 100}%`,
    } as CSSProperties;
  }, [eventTransition]);
  const visibleNumber =
    isResolvedEventReady || isEventAnimating
      ? (displayNumber ?? currentEvent?.startNumber ?? currentDrawnNumber)
      : currentDrawnNumber;
  const selectedEventOption =
    eventChoice?.options.find(
      (option) => option.direction === selectedEventDirection,
    ) ?? null;

  const renderProgressButton = () => {
    console.log("抽選中before");
    if (isDrawAnimating) {
      console.log("抽選中before");
      return (
        <button type="button" className="secondary-button" disabled>
          抽選中
        </button>
      );
    }

    if (isEventAnimating) {
      return (
        <button type="button" className="secondary-button" disabled>
          運命改変中
        </button>
      );
    }

    if (isEventChoicePending) {
      return (
        <button type="button" className="secondary-button" disabled>
          イベント待機中
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
      {isEventModalOpen ? (
        <div className="modal-overlay">
          <section
            className="title-modal event-modal"
            aria-modal="true"
            role="dialog"
          >
            {!showEventModalDetails ? (
              <div className="event-modal-intro">
                <h2>運命に抗え!</h2>
              </div>
            ) : (
              <div className="event-modal-body">
                <h2>運命に抗え!</h2>
                <p className="panel-copy">どちらか一枚を選びとってください</p>
                {eventChoice ? (
                  <>
                    <div className="event-choice-grid">
                      {eventChoice.options.map((option) => (
                        <button
                          key={option.direction}
                          type="button"
                          className={`event-choice-card ${
                            selectedEventDirection === option.direction
                              ? "is-selected"
                              : ""
                          }`}
                          onClick={() =>
                            setSelectedEventDirection(option.direction)
                          }
                          disabled={isBusy || hasSubmittedEventChoice}
                          aria-pressed={
                            selectedEventDirection === option.direction
                          }
                        >
                          <span className="event-choice-card-value">
                            {option.step}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={
                        hasSubmittedEventChoice
                          ? "secondary-button event-submit-button"
                          : "primary-button event-submit-button"
                      }
                      onClick={() => {
                        if (selectedEventOption) {
                          onSubmitEventChoice(selectedEventOption.direction);
                        }
                      }}
                      disabled={
                        isBusy ||
                        hasSubmittedEventChoice ||
                        selectedEventOption === null
                      }
                    >
                      {hasSubmittedEventChoice
                        ? "他のプレイヤーを待っています"
                        : "運命を変える"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="secondary-button event-submit-button"
                    disabled
                  >
                    イベントカードを読み込んでいます
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      ) : null}

      <section className="game-topbar">
        <div className="current-number-card">
          <div className="number-gauge-row">
            <div
              className={`number-gauge-orb ${eventGauge <= 0 ? "is-empty" : ""}`}
              style={numberGaugeStyle}
            >
              <div className="number-gauge-core">
                {isResolvedEventReady ? (
                  <div className="event-draw-stage">
                    <div className="event-number-window">
                      {eventTransition ? (
                        <div
                          key={eventTransition.key}
                          className="event-number-track"
                          style={eventTrackStyle}
                        >
                          {eventTransition.values.map((value, index) => (
                            <div
                              key={`${eventTransition.key}:${value}:${index}`}
                              className="event-number-value"
                            >
                              {value}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="event-number-static">
                          {visibleNumber}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <DrawRevealModal
                    key={drawPresentationKey || "idle"}
                    animationKey={drawPresentationKey}
                    isOpen={isDrawRevealActive}
                    targetNumber={currentDrawnNumber}
                    onAnimationStateChange={setIsDrawAnimating}
                  />
                )}
              </div>
            </div>

            {isEventAnimating && eventStepLabel ? (
              <div className="event-step-indicator" aria-live="polite">
                <span className="event-step-label">Move</span>
                <strong>{eventStepLabel}</strong>
              </div>
            ) : null}
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
            isBusy={isBusy || isDrawAnimating || isEventAnimating}
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

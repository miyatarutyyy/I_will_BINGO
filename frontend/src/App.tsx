import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type BingoCell = {
  positionId: number;
  value: number | null;
  isOpened: boolean;
  isFree: boolean;
};

type BingoCard = {
  cells: BingoCell[];
};

type SessionStatus = "waiting" | "in_progress" | "finished";
type SessionEndReason = null | "bingo" | "all_numbers_drawn";
type RoundPhase =
  | "waiting_for_ready"
  | "waiting_for_host_start"
  | "waiting_for_player_actions"
  | "waiting_for_host_next_round"
  | "finished";

type SessionEndCondition = {
  bingoCount: number;
  finishWhenAllNumbersDrawn: boolean;
};

type PlayerSummary = {
  id: string;
  name: string;
  isReadyForStart: boolean;
  hasActedThisRound: boolean;
  card: BingoCard | null;
  openedPositionIds?: number[];
  bingoCount?: number;
  reachCount?: number;
};

type GameSession = {
  id: string;
  status: SessionStatus;
  phase: RoundPhase;
  round: number;
  currentDrawnNumber: number | null;
  drawnNumbers: number[];
  endReason: SessionEndReason;
  winners: string[];
  endCondition: SessionEndCondition;
  playerStates: Record<
    string,
    {
      card: BingoCard | null;
      isReadyForStart: boolean;
      hasActedThisRound: boolean;
    }
  >;
};

type Room = {
  id: string;
  hostPlayerId: string;
  players: PlayerSummary[];
  currentSession: GameSession;
};

type ApiResponse = {
  message?: string;
  playerId?: string;
  room?: Room;
  player?: PlayerSummary;
  drawNumber?: number | null;
};

type Screen = "title" | "room" | "game" | "result";
type JoinMode = "hidden" | "visible";
type NoticeTone = "neutral" | "error" | "success";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";

const STORAGE_KEYS = {
  playerName: "iwillbingo:playerName",
  roomId: "iwillbingo:roomId",
  playerId: "iwillbingo:playerId",
} as const;

const CARD_SIZE = 5;

const ALL_LINES = (() => {
  const lines: number[][] = [];

  for (let row = 0; row < CARD_SIZE; row += 1) {
    const line: number[] = [];
    for (let col = 0; col < CARD_SIZE; col += 1) {
      line.push(row * CARD_SIZE + col);
    }
    lines.push(line);
  }

  for (let col = 0; col < CARD_SIZE; col += 1) {
    const line: number[] = [];
    for (let row = 0; row < CARD_SIZE; row += 1) {
      line.push(row * CARD_SIZE + col);
    }
    lines.push(line);
  }

  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);

  return lines;
})();

const readStoredValue = (key: string) => {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(key) ?? "";
};

const writeStoredValue = (key: string, value: string) => {
  if (typeof window === "undefined") return;

  if (value === "") {
    window.sessionStorage.removeItem(key);
    return;
  }

  window.sessionStorage.setItem(key, value);
};

const trimText = (value: string) => value.trim();

const getApiMessage = (payload: unknown, fallback: string) => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
};

const getScreenFromRoom = (room: Room | null): Screen => {
  if (!room) return "title";
  if (room.currentSession.status === "finished") return "result";
  if (room.currentSession.status === "in_progress") return "game";
  return "room";
};

const getPlayerById = (room: Room | null, playerId: string) => {
  if (!room || playerId === "") return null;
  return room.players.find((player) => player.id === playerId) ?? null;
};

const getHighlightedLines = (card: BingoCard | null) => {
  if (!card) return [];

  return ALL_LINES.filter((line) =>
    line.every((positionId) => card.cells[positionId]?.isOpened),
  );
};

const getHighlightedCellSet = (card: BingoCard | null) => {
  const positions = new Set<number>();

  for (const line of getHighlightedLines(card)) {
    for (const positionId of line) {
      positions.add(positionId);
    }
  }

  return positions;
};

const getPhaseLabel = (phase: RoundPhase) => {
  switch (phase) {
    case "waiting_for_ready":
      return "準備中";
    case "waiting_for_host_start":
      return "開始待ち";
    case "waiting_for_player_actions":
      return "アクション待ち";
    case "waiting_for_host_next_round":
      return "次ラウンド待ち";
    case "finished":
      return "終了";
  }
};

const getEndReasonLabel = (reason: SessionEndReason) => {
  if (reason === "bingo") return "誰かがビンゴしました";
  if (reason === "all_numbers_drawn") return "全ての番号が抽選されました";
  return "ゲーム終了";
};

const App = () => {
  const eventSourceRef = useRef<EventSource | null>(null);

  const [playerName, setPlayerName] = useState(() =>
    readStoredValue(STORAGE_KEYS.playerName),
  );
  const [roomIdInput, setRoomIdInput] = useState(() =>
    readStoredValue(STORAGE_KEYS.roomId),
  );
  const [playerId, setPlayerId] = useState(() =>
    readStoredValue(STORAGE_KEYS.playerId),
  );
  const [room, setRoom] = useState<Room | null>(null);
  const [screen, setScreen] = useState<Screen>("title");
  const [joinMode, setJoinMode] = useState<JoinMode>("hidden");
  const [isBusy, setIsBusy] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("neutral");
  const [syncStatus, setSyncStatus] = useState("offline");

  const currentPlayer = getPlayerById(room, playerId);
  const isHost = room !== null && playerId === room.hostPlayerId;
  const currentPhase = room?.currentSession.phase ?? "waiting_for_ready";
  const canStart =
    isHost &&
    room?.currentSession.status === "waiting" &&
    room.currentSession.phase === "waiting_for_host_start";

  const matchingCell =
    currentPlayer?.card?.cells.find(
      (cell) =>
        !cell.isFree &&
        !cell.isOpened &&
        cell.value === room?.currentSession.currentDrawnNumber,
    ) ?? null;

  const canAct =
    room?.currentSession.status === "in_progress" &&
    room.currentSession.phase === "waiting_for_player_actions" &&
    currentPlayer !== null &&
    !currentPlayer.hasActedThisRound;

  const winners =
    room?.players.filter((player) =>
      room.currentSession.winners.includes(player.id),
    ) ?? [];

  const resultHeadline =
    winners.length === 1
      ? `${winners[0].name}がビンゴしました!`
      : winners.length > 1
        ? `${winners.map((winner) => winner.name).join(" / ")}がビンゴしました!`
        : getEndReasonLabel(room?.currentSession.endReason ?? null);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.playerName, playerName);
  }, [playerName]);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.roomId, roomIdInput);
  }, [roomIdInput]);

  useEffect(() => {
    writeStoredValue(STORAGE_KEYS.playerId, playerId);
  }, [playerId]);

  useEffect(() => {
    const storedRoomId = readStoredValue(STORAGE_KEYS.roomId);
    const storedPlayerId = readStoredValue(STORAGE_KEYS.playerId);

    if (storedRoomId === "" || storedPlayerId === "") return;

    setIsBootstrapping(true);

    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${storedRoomId}`);
        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.room) {
          writeStoredValue(STORAGE_KEYS.roomId, "");
          writeStoredValue(STORAGE_KEYS.playerId, "");
          setPlayerId("");
          setRoomIdInput("");
          setScreen("title");
          setNotice(getApiMessage(payload, "保存済みのルームを復元できませんでした。"));
          setNoticeTone("error");
          return;
        }

        setRoom(payload.room);
        setScreen(getScreenFromRoom(payload.room));
        setNotice("前回のルーム接続を復元しました。");
        setNoticeTone("neutral");
      } catch {
        setNotice("ルーム復元に失敗しました。backend が起動しているか確認してください。");
        setNoticeTone("error");
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!room) {
      setScreen("title");
      setSyncStatus("offline");

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      return;
    }

    setScreen(getScreenFromRoom(room));

    const source = new EventSource(`${API_BASE}/rooms/${room.id}/events`);
    eventSourceRef.current?.close();
    eventSourceRef.current = source;
    setSyncStatus("connecting");

    source.addEventListener("room_updated", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as ApiResponse;

      if (!payload.room) return;

      setRoom(payload.room);
      setScreen(getScreenFromRoom(payload.room));
      setSyncStatus("live");
    });

    source.onopen = () => {
      setSyncStatus("live");
    };

    source.onerror = () => {
      setSyncStatus("reconnecting");
    };

    return () => {
      source.close();

      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
  }, [room?.id]);

  const handleApiRequest = async (
    path: string,
    options?: RequestInit,
  ): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });

    const payload = (await response.json()) as ApiResponse;

    if (!response.ok) {
      throw new Error(getApiMessage(payload, "リクエストに失敗しました。"));
    }

    return payload;
  };

  const syncRoom = async (nextRoom: Room, nextPlayerId?: string) => {
    setRoom(nextRoom);
    setScreen(getScreenFromRoom(nextRoom));

    if (nextPlayerId) {
      setPlayerId(nextPlayerId);
    }
  };

  const handleCreateRoom = async () => {
    const trimmedName = trimText(playerName);

    if (trimmedName === "") {
      setNotice("playerName を入力してください。");
      setNoticeTone("error");
      return;
    }

    setIsBusy(true);
    setNotice("");

    try {
      const payload = await handleApiRequest("/rooms", {
        method: "POST",
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!payload.room || !payload.playerId) {
        throw new Error("ルーム作成レスポンスが不正です。");
      }

      setRoomIdInput(payload.room.id);
      await syncRoom(payload.room, payload.playerId);
      setJoinMode("hidden");
      setNotice(payload.message ?? "ルームを作成しました。");
      setNoticeTone("success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ルーム作成に失敗しました。");
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinRoom = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = trimText(playerName);
    const trimmedRoomId = trimText(roomIdInput);

    if (trimmedName === "") {
      setNotice("playerName を入力してください。");
      setNoticeTone("error");
      return;
    }

    if (trimmedRoomId === "") {
      setNotice("ルーム ID を入力してください。");
      setNoticeTone("error");
      return;
    }

    setIsBusy(true);
    setNotice("");

    try {
      const payload = await handleApiRequest(`/rooms/${trimmedRoomId}/join`, {
        method: "POST",
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!payload.room || !payload.playerId) {
        throw new Error("参加レスポンスが不正です。");
      }

      setRoomIdInput(payload.room.id);
      await syncRoom(payload.room, payload.playerId);
      setNotice(payload.message ?? "ルームに参加しました。");
      setNoticeTone("success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ルーム参加に失敗しました。");
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePrepare = async () => {
    if (!room || !currentPlayer) return;

    setIsBusy(true);
    setNotice("");

    try {
      let latestRoom = room;

      if (!currentPlayer.card) {
        const setupPayload = await handleApiRequest(
          `/rooms/${room.id}/session/setup`,
          {
            method: "POST",
            body: JSON.stringify({ playerId }),
          },
        );

        if (!setupPayload.room) {
          throw new Error("カード作成レスポンスが不正です。");
        }

        latestRoom = setupPayload.room;
        setRoom(latestRoom);
      }

      const readyPayload = await handleApiRequest(
        `/rooms/${room.id}/session/ready`,
        {
          method: "POST",
          body: JSON.stringify({ playerId }),
        },
      );

      if (!readyPayload.room) {
        throw new Error("準備完了レスポンスが不正です。");
      }

      await syncRoom(readyPayload.room);
      setNotice(
        latestRoom.currentSession.phase === "waiting_for_ready"
          ? "FREE マスを開いて準備完了にしました。"
          : "準備完了を送信しました。",
      );
      setNoticeTone("success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "準備処理に失敗しました。");
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartSession = async () => {
    if (!room) return;

    setIsBusy(true);
    setNotice("");

    try {
      const payload = await handleApiRequest(`/rooms/${room.id}/session/start`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });

      if (!payload.room) {
        throw new Error("開始レスポンスが不正です。");
      }

      await syncRoom(payload.room);
      setNotice(payload.message ?? "セッションを開始しました。");
      setNoticeTone("success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "セッション開始に失敗しました。");
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleAct = async () => {
    if (!room || !canAct) return;

    setIsBusy(true);
    setNotice("");

    try {
      const payload = await handleApiRequest(`/rooms/${room.id}/session/act`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });

      if (!payload.room) {
        throw new Error("アクションレスポンスが不正です。");
      }

      await syncRoom(payload.room);
      setNotice(
        matchingCell
          ? "該当マスを開きました。"
          : "該当する番号がないため、このラウンドを完了しました。",
      );
      setNoticeTone("success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "アクションに失敗しました。");
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleNextRound = async () => {
    if (!room) return;

    setIsBusy(true);
    setNotice("");

    try {
      const payload = await handleApiRequest(
        `/rooms/${room.id}/session/next-round`,
        {
          method: "POST",
          body: JSON.stringify({ playerId }),
        },
      );

      if (!payload.room) {
        throw new Error("次ラウンドレスポンスが不正です。");
      }

      await syncRoom(payload.room);
      setNotice(payload.message ?? "次のラウンドへ進みました。");
      setNoticeTone("success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "次ラウンド開始に失敗しました。");
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleReturnToTitle = () => {
    setRoom(null);
    setPlayerId("");
    setRoomIdInput("");
    setScreen("title");
    setJoinMode("hidden");
    setNotice("");
    setNoticeTone("neutral");
    setSyncStatus("offline");
    writeStoredValue(STORAGE_KEYS.roomId, "");
    writeStoredValue(STORAGE_KEYS.playerId, "");
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  };

  const handleCopyRoomId = async () => {
    if (!room?.id) return;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(room.id);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = room.id;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setNotice("ルームIDをコピーしました。");
      setNoticeTone("success");
    } catch {
      setNotice("ルームIDのコピーに失敗しました。");
      setNoticeTone("error");
    }
  };

  const renderCard = (
    card: BingoCard | null,
    options?: {
      interactive?: boolean;
      highlightedPositions?: Set<number>;
    },
  ) => {
    if (!card) {
      return <p className="empty-state">カードはまだ配布されていません。</p>;
    }

    return (
      <div className="bingo-card">
        {card.cells.map((cell) => {
          const isDrawTarget =
            options?.interactive === true &&
            matchingCell?.positionId === cell.positionId;
          const isHighlighted =
            options?.highlightedPositions?.has(cell.positionId) ?? false;

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
              onClick={isDrawTarget ? handleAct : undefined}
            >
              <span className="cell-value">{cell.isFree ? "FREE" : cell.value}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderTitleScreen = () => (
    <main className="screen title-screen">
      <section className="title-panel">
        <p className="panel-kicker">Online Room Bingo</p>
        <h1>I Will BINGO</h1>
        <label className="field">
          <span>playerName</span>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="あなたの名前"
            maxLength={24}
          />
        </label>

        <div className={`join-stack ${joinMode === "visible" ? "visible" : ""}`}>
          <button
            type="button"
            className="primary-button"
            onClick={handleCreateRoom}
            disabled={isBusy || isBootstrapping}
          >
            ルームを作成
          </button>

          <div className="join-block">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setJoinMode((current) =>
                  current === "hidden" ? "visible" : "hidden",
                )
              }
              disabled={isBusy || isBootstrapping}
            >
              ルームに参加
            </button>

            <form className="join-form" onSubmit={handleJoinRoom}>
              <input
                value={roomIdInput}
                onChange={(event) => setRoomIdInput(event.target.value)}
                placeholder="共有されたルームID"
              />
              <button type="submit" className="primary-button" disabled={isBusy}>
                参加
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );

  const renderRoomScreen = () => (
    <main className="screen room-screen">
      <section className="room-hero">
        <div>
          <p className="panel-kicker">Room Lobby</p>
          <h2>ルーム待機画面</h2>
          <p className="panel-copy">
            ルームIDを他のプレイヤーに共有し、全員の準備完了を待ちます。
          </p>
        </div>
        <div className="room-id-card">
          <span>ROOM ID</span>
          <div className="room-id-row">
            <strong>{room?.id}</strong>
            <button
              type="button"
              className="copy-button"
              onClick={handleCopyRoomId}
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
          <h3>あなたの操作</h3>
          <p className="panel-copy">
            現在の backend 仕様では、待機中にカード配布と FREE マス開放を済ませてからホストが開始します。
          </p>

          {currentPlayer && !currentPlayer.isReadyForStart ? (
            <button
              type="button"
              className="primary-button"
              onClick={handlePrepare}
              disabled={isBusy || currentPhase !== "waiting_for_ready"}
            >
              {currentPlayer.card ? "FREEマスを開いて準備完了" : "カードを受け取って準備完了"}
            </button>
          ) : (
            <div className="info-card success">あなたの準備は完了しています。</div>
          )}

          {isHost ? (
            <button
              type="button"
              className="primary-button accent-button"
              onClick={handleStartSession}
              disabled={isBusy || !canStart}
            >
              セッションを開始
            </button>
          ) : (
            <div className="info-card">ホストがセッション開始を行うまで待機します。</div>
          )}

          <button
            type="button"
            className="secondary-button"
            onClick={handleReturnToTitle}
            disabled={isBusy}
          >
            タイトルに戻る
          </button>
        </aside>
      </section>
    </main>
  );

  const renderGameScreen = () => (
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
          <div>
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
          {renderCard(currentPlayer?.card ?? null, { interactive: canAct })}
          <div className="action-strip">
            {canAct ? (
              matchingCell ? (
                <p>光っているマスを押して、このラウンドのアクションを完了します。</p>
              ) : (
                <>
                  <p>今回の番号はあなたのカードにありません。完了ボタンでラウンドを進めます。</p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleAct}
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
                onClick={handleNextRound}
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

  const renderResultScreen = () => (
    <main className="screen result-screen">
      <section className="result-header">
        <p className="panel-kicker">Result</p>
        <h2>セッション終了</h2>
        <p className="panel-copy">{resultHeadline}</p>
      </section>

      <section className="winner-stack">
        {winners.map((winner) => {
          const highlightedPositions = getHighlightedCellSet(winner.card);
          const highlightedLines = getHighlightedLines(winner.card);

          return (
            <article key={winner.id} className="panel winner-panel">
              <div className="panel-header-row">
                <h3>{winner.name}</h3>
                <span className="status-badge champion">WINNER</span>
              </div>
              {renderCard(winner.card, { highlightedPositions })}
              <p className="panel-copy">
                ビンゴライン:
                {" "}
                {highlightedLines.length > 0
                  ? highlightedLines
                      .map((line) => `[${line.map((value) => value + 1).join(", ")}]`)
                      .join(" ")
                  : "なし"}
              </p>
            </article>
          );
        })}
      </section>

      <div className="result-actions">
        <button
          type="button"
          className="primary-button"
          onClick={handleReturnToTitle}
        >
          タイトルに戻る
        </button>
      </div>
    </main>
  );

  return (
    <div className="app-shell">
      <div className="background-orb orb-a" />
      <div className="background-orb orb-b" />
      <div className="background-orb orb-c" />

      <div className="notice-slot">
        {notice ? (
          <div className={`notice-banner ${noticeTone}`}>{notice}</div>
        ) : null}
      </div>

      {isBootstrapping && <div className="boot-message">保存済みルームを確認しています...</div>}

      {!isBootstrapping && screen === "title" && renderTitleScreen()}
      {!isBootstrapping && screen === "room" && renderRoomScreen()}
      {!isBootstrapping && screen === "game" && renderGameScreen()}
      {!isBootstrapping && screen === "result" && renderResultScreen()}
    </div>
  );
};

export default App;

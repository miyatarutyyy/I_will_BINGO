import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { GameScreen } from "./components/GameScreen";
import { ResultScreen } from "./components/ResultScreen";
import { RoomScreen } from "./components/RoomScreen";
import { TitleScreen } from "./components/TitleScreen";
import {
  getApiMessage,
  getEndReasonLabel,
  getHighlightedCellSet,
  getPlayerById,
  getScreenFromRoom,
  trimText,
} from "./lib/game";
import type {
  ApiResponse,
  NoticeTone,
  PendingRoomDraft,
  Room,
  Screen,
  TitleModal,
} from "./types/game";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";

const STORAGE_KEYS = {
  playerName: "iwillbingo:playerName",
  roomId: "iwillbingo:roomId",
  playerId: "iwillbingo:playerId",
} as const;

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
  const [titleModal, setTitleModal] = useState<TitleModal>("closed");
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [pendingRoomDraft, setPendingRoomDraft] =
    useState<PendingRoomDraft | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("neutral");
  const [syncStatus, setSyncStatus] = useState("offline");

  const roomId = room?.id ?? null;
  const currentScreenValue = getScreenFromRoom(room);
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
      ? `${winners[0].name}の優勝!`
      : winners.length > 1
        ? `${winners.map((winner) => winner.name).join(" / ")}の優勝!`
        : getEndReasonLabel(room?.currentSession.endReason ?? null);
  const shouldShowNotice =
    notice !== "" &&
    (noticeTone !== "success" || notice === "ルームIDをコピーしました。");

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
    if (notice === "") return;

    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setNoticeTone("neutral");
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

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
          setNotice(
            getApiMessage(payload, "保存済みのルームを復元できませんでした。"),
          );
          setNoticeTone("error");
          return;
        }

        setRoom(payload.room);
        setScreen(getScreenFromRoom(payload.room));
        setNotice("前回のルーム接続を復元しました。");
        setNoticeTone("neutral");
      } catch {
        setNotice(
          "ルーム復元に失敗しました。backend が起動しているか確認してください。",
        );
        setNoticeTone("error");
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!roomId) {
      setScreen("title");
      setSyncStatus("offline");

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      return;
    }

    setScreen(currentScreenValue);

    const source = new EventSource(`${API_BASE}/rooms/${roomId}/events`);
    eventSourceRef.current?.close();
    eventSourceRef.current = source;
    setSyncStatus("connecting");

    source.addEventListener("room_updated", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent<string>).data,
      ) as ApiResponse;

      if (!payload.room) return;

      setRoom(payload.room);
      setScreen(getScreenFromRoom(payload.room));
      setSyncStatus("live");
    });

    source.addEventListener("room_closed", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent<string>).data,
      ) as ApiResponse;

      setRoom(null);
      setPlayerId("");
      setRoomIdInput("");
      setScreen("title");
      setTitleModal("closed");
      setIsLeaveModalOpen(false);
      setPendingRoomDraft(null);
      setSyncStatus("offline");
      writeStoredValue(STORAGE_KEYS.roomId, "");
      writeStoredValue(STORAGE_KEYS.playerId, "");
      setNotice(payload.message ?? "ルームが閉じられました。");
      setNoticeTone("neutral");
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
  }, [currentScreenValue, roomId]);

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

  const copyText = async (
    value: string,
    successMessage: string,
    errorMessage: string,
  ) => {
    if (value === "") {
      setNotice(errorMessage);
      setNoticeTone("error");
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const didCopy = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!didCopy) {
          throw new Error("copy failed");
        }
      }

      setNotice(successMessage);
      setNoticeTone("success");
    } catch {
      setNotice(errorMessage);
      setNoticeTone("error");
    }
  };

  const handleOpenCreateModal = async () => {
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

      setPendingRoomDraft({
        room: payload.room,
        playerId: payload.playerId,
      });
      setRoomIdInput(payload.room.id);
      setTitleModal("create");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ルーム作成に失敗しました。",
      );
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmCreateRoom = async () => {
    if (!pendingRoomDraft) return;

    setNotice("");
    setNoticeTone("neutral");
    await syncRoom(pendingRoomDraft.room, pendingRoomDraft.playerId);
    setTitleModal("closed");
    setPendingRoomDraft(null);
    setNotice("ルーム待機画面へ移動しました。");
    setNoticeTone("success");
  };

  const handleCancelCreateModal = async () => {
    if (!pendingRoomDraft) {
      setTitleModal("closed");
      return;
    }

    setIsBusy(true);
    setNotice("");

    try {
      await handleApiRequest(`/rooms/${pendingRoomDraft.room.id}`, {
        method: "DELETE",
        body: JSON.stringify({ playerId: pendingRoomDraft.playerId }),
      });

      setPendingRoomDraft(null);
      setRoomIdInput("");
      setTitleModal("closed");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ルーム削除に失敗しました。",
      );
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenJoinModal = () => {
    const trimmedName = trimText(playerName);

    if (trimmedName === "") {
      setNotice("playerName を入力してください。");
      setNoticeTone("error");
      return;
    }

    setNotice("");
    setNoticeTone("neutral");
    setTitleModal("join");
  };

  const handleCloseJoinModal = () => {
    setTitleModal("closed");
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
      setTitleModal("closed");
      setNotice(payload.message ?? "ルームに参加しました。");
      setNoticeTone("success");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ルーム参加に失敗しました。",
      );
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
      setNotice(
        error instanceof Error ? error.message : "準備処理に失敗しました。",
      );
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
      const payload = await handleApiRequest(
        `/rooms/${room.id}/session/start`,
        {
          method: "POST",
          body: JSON.stringify({ playerId }),
        },
      );

      if (!payload.room) {
        throw new Error("開始レスポンスが不正です。");
      }

      await syncRoom(payload.room);
      setNotice(payload.message ?? "セッションを開始しました。");
      setNoticeTone("success");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "セッション開始に失敗しました。",
      );
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
      setNotice(
        error instanceof Error ? error.message : "アクションに失敗しました。",
      );
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
      setNotice(
        error instanceof Error
          ? error.message
          : "次ラウンド開始に失敗しました。",
      );
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
    setTitleModal("closed");
    setIsLeaveModalOpen(false);
    setPendingRoomDraft(null);
    setNotice("");
    setNoticeTone("neutral");
    setSyncStatus("offline");
    writeStoredValue(STORAGE_KEYS.roomId, "");
    writeStoredValue(STORAGE_KEYS.playerId, "");
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  };

  const handleOpenLeaveModal = () => {
    setIsLeaveModalOpen(true);
  };

  const handleCloseLeaveModal = () => {
    setIsLeaveModalOpen(false);
  };

  const handleLeaveRoom = async () => {
    if (!room) return;

    setIsBusy(true);
    setNotice("");

    try {
      const payload = isHost
        ? await handleApiRequest(`/rooms/${room.id}`, {
            method: "DELETE",
            body: JSON.stringify({ playerId }),
          })
        : await handleApiRequest(`/rooms/${room.id}/leave`, {
            method: "POST",
            body: JSON.stringify({ playerId }),
          });

      handleReturnToTitle();
      setNotice(payload.message ?? "ルームを退室しました。");
      setNoticeTone("success");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "ルーム退室に失敗しました。",
      );
      setNoticeTone("error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyRoomId = async () => {
    if (!room?.id) return;
    await copyText(
      room.id,
      "ルームIDをコピーしました。",
      "ルームIDのコピーに失敗しました。",
    );
  };

  const handleCopyDraftRoomId = async () => {
    await copyText(
      pendingRoomDraft?.room.id ?? "",
      "ルームIDをコピーしました。",
      "ルームIDのコピーに失敗しました。",
    );
  };

  return (
    <div className="app-shell">
      <div className="background-orb orb-a" />
      <div className="background-orb orb-b" />
      <div className="background-orb orb-c" />

      {shouldShowNotice ? (
        <div className={`notice-banner is-visible ${noticeTone}`}>{notice}</div>
      ) : null}

      {isBootstrapping && (
        <div className="boot-message">保存済みルームを確認しています...</div>
      )}

      {!isBootstrapping && screen === "title" && (
        <TitleScreen
          playerName={playerName}
          roomIdInput={roomIdInput}
          titleModal={titleModal}
          pendingRoomDraft={pendingRoomDraft}
          isBusy={isBusy}
          isBootstrapping={isBootstrapping}
          onPlayerNameChange={setPlayerName}
          onRoomIdInputChange={setRoomIdInput}
          onOpenCreateModal={() => void handleOpenCreateModal()}
          onOpenJoinModal={handleOpenJoinModal}
          onCancelCreateModal={() => void handleCancelCreateModal()}
          onCloseJoinModal={handleCloseJoinModal}
          onConfirmCreateRoom={() => void handleConfirmCreateRoom()}
          onJoinRoom={handleJoinRoom}
          onCopyDraftRoomId={() => void handleCopyDraftRoomId()}
        />
      )}

      {!isBootstrapping && screen === "room" && (
        <RoomScreen
          room={room}
          currentPlayer={currentPlayer}
          currentPhase={currentPhase}
          isHost={isHost}
          canStart={canStart}
          isBusy={isBusy}
          isLeaveModalOpen={isLeaveModalOpen}
          onCopyRoomId={() => void handleCopyRoomId()}
          onPrepare={() => void handlePrepare()}
          onStartSession={() => void handleStartSession()}
          onOpenLeaveModal={handleOpenLeaveModal}
          onCloseLeaveModal={handleCloseLeaveModal}
          onConfirmLeave={() => void handleLeaveRoom()}
        />
      )}

      {!isBootstrapping && screen === "game" && (
        <GameScreen
          room={room}
          currentPlayer={currentPlayer}
          currentPhase={currentPhase}
          syncStatus={syncStatus}
          isHost={isHost}
          isBusy={isBusy}
          canAct={canAct}
          matchingPositionId={matchingCell?.positionId ?? null}
          onAct={() => void handleAct()}
          onNextRound={() => void handleNextRound()}
        />
      )}

      {!isBootstrapping && screen === "result" && (
        <ResultScreen
          resultHeadline={resultHeadline}
          winners={winners}
          getHighlightedPositions={(player) =>
            getHighlightedCellSet(player.card)
          }
          onReturnToTitle={handleReturnToTitle}
          isBusy={isBusy}
        />
      )}
    </div>
  );
};

export default App;

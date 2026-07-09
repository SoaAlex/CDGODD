import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DeckCard,
  RoomCardResult,
  RoomClientMessage,
  RoomMode,
  RoomServerMessage,
  RoomState,
  Side,
} from '@cdgodd/shared';
import { WS_BASE } from '@/lib/api';
import { getSessionId } from '@/lib/session';

interface LiveTally {
  cardIndex: number;
  votesLeft: number;
  votesRight: number;
}

/**
 * Connects to a room's Durable Object over WebSocket and mirrors its state.
 *
 * Players swipe the whole round at their own pace — no waiting between
 * cards. `deck` is the full round dealt at start; `myIndex` is how far this
 * player has swiped. Once you've voted every card you're `done` and wait
 * only for the others; the room reveals when everyone has finished.
 */
export function useRoom(code: string, name: string | null) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [deck, setDeck] = useState<DeckCard[] | null>(null);
  const [myIndex, setMyIndex] = useState(0);
  const [liveTally, setLiveTally] = useState<LiveTally | null>(null);
  const [results, setResults] = useState<RoomCardResult[] | null>(null);
  /** This player's own votes for the current round, indexed by card. */
  const [myVotes, setMyVotes] = useState<Side[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    // No nickname yet: the room screen is still asking for one.
    if (!name) return;
    let closed = false;
    let socket: WebSocket | null = null;

    void getSessionId().then((sid) => {
      if (closed) return;
      setSessionId(sid);
      socket = new WebSocket(`${WS_BASE}/rooms/${code}/ws`);
      ws.current = socket;

      socket.onopen = () => {
        setConnected(true);
        const join: RoomClientMessage = { type: 'join', sessionId: sid, name };
        socket?.send(JSON.stringify(join));
      };

      socket.onmessage = (event) => {
        const msg = JSON.parse(String(event.data)) as RoomServerMessage;
        switch (msg.type) {
          case 'state':
            setRoom(msg.room);
            break;
          case 'deck':
            // A fresh deck also means a fresh round (host replay): wipe
            // everything left over from the previous one.
            indexRef.current = 0;
            setMyIndex(0);
            setResults(null);
            setLiveTally(null);
            setMyVotes([]);
            setDeck(msg.cards);
            break;
          case 'tally':
            setLiveTally(msg);
            break;
          case 'reveal':
            setResults(msg.results);
            break;
          case 'error':
            setError(msg.message);
            break;
        }
      };

      socket.onclose = () => setConnected(false);
      socket.onerror = () => setError('connection failed');
    });

    return () => {
      closed = true;
      socket?.close();
      ws.current = null;
    };
  }, [code, name]);

  const send = useCallback((msg: RoomClientMessage) => {
    ws.current?.send(JSON.stringify(msg));
  }, []);

  const start = useCallback(() => send({ type: 'start' }), [send]);

  const restart = useCallback(
    (settings?: { mode: RoomMode; roundSize: number; categoryKeys: string[] }) =>
      send({ type: 'restart', ...settings }),
    [send],
  );

  const vote = useCallback(
    (side: Side) => {
      const idx = indexRef.current;
      if (!deck || idx >= deck.length) return;
      send({ type: 'vote', cardIndex: idx, side });
      setMyVotes((prev) => {
        const next = [...prev];
        next[idx] = side;
        return next;
      });
      indexRef.current = idx + 1;
      setMyIndex(idx + 1);
    },
    [deck, send],
  );

  const isHost =
    room !== null && sessionId !== null && room.hostId === sessionId;
  /** Finished my own deck; waiting only for the other players now. */
  const done = deck !== null && myIndex >= deck.length && results === null;

  return {
    room,
    deck,
    myIndex,
    liveTally,
    results,
    myVotes,
    error,
    connected,
    isHost,
    done,
    start,
    restart,
    vote,
  };
}

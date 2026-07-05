import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DeckCard,
  RoomCardResult,
  RoomClientMessage,
  RoomServerMessage,
  RoomState,
  Side,
} from '@cdgodd/shared';
import { WS_BASE } from '@/lib/api';
import { getSessionId } from '@/lib/session';

interface CurrentCard {
  index: number;
  card: DeckCard;
}

interface LiveTally {
  cardIndex: number;
  votesLeft: number;
  votesRight: number;
}

/**
 * Connects to a room's Durable Object over WebSocket and mirrors its
 * state. `votedIndex` tracks the card we already voted on so the UI can
 * show "waiting for the others" until the room advances.
 */
export function useRoom(code: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [current, setCurrent] = useState<CurrentCard | null>(null);
  const [liveTally, setLiveTally] = useState<LiveTally | null>(null);
  const [results, setResults] = useState<RoomCardResult[] | null>(null);
  const [votedIndex, setVotedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;

    void getSessionId().then((sid) => {
      if (closed) return;
      setSessionId(sid);
      socket = new WebSocket(`${WS_BASE}/rooms/${code}/ws`);
      ws.current = socket;

      socket.onopen = () => {
        setConnected(true);
        const join: RoomClientMessage = { type: 'join', sessionId: sid };
        socket?.send(JSON.stringify(join));
      };

      socket.onmessage = (event) => {
        const msg = JSON.parse(String(event.data)) as RoomServerMessage;
        switch (msg.type) {
          case 'state':
            setRoom(msg.room);
            break;
          case 'card':
            setCurrent({ index: msg.cardIndex, card: msg.card });
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
  }, [code]);

  const send = useCallback((msg: RoomClientMessage) => {
    ws.current?.send(JSON.stringify(msg));
  }, []);

  const start = useCallback(() => send({ type: 'start' }), [send]);

  const vote = useCallback(
    (side: Side) => {
      if (!current) return;
      setVotedIndex(current.index);
      send({ type: 'vote', cardIndex: current.index, side });
    },
    [current, send],
  );

  const isHost = room !== null && sessionId !== null && room.hostId === sessionId;
  const waiting =
    current !== null && votedIndex === current.index && results === null;

  return {
    room,
    current,
    liveTally,
    results,
    error,
    connected,
    isHost,
    waiting,
    start,
    vote,
  };
}

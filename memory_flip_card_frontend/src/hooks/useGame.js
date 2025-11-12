import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGame, flipCard, resetGame, getGame } from '../lib/api';

/**
 * Utility: format time in mm:ss from seconds
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Map backend CardView[] to UI board model
 * @param {Array<{index:number,isFaceUp:boolean,isMatched:boolean,value?:number|null}>} cards
 * @returns {Array<{id:string,index:number,faceUp:boolean,matched:boolean,value?:number|null}>}
 */
function toBoard(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.map((c) => ({
    id: `card-${c.index}`,
    index: c.index,
    faceUp: !!c.isFaceUp,
    matched: !!c.isMatched,
    // keep value if present to allow UI reveal (backend reveals value when faceUp or matched)
    value: c.value ?? null,
  }));
}

/**
 * Compute best score storage key for a board size
 * @param {'4x4'|'6x6'} size
 * @returns {string}
 */
function bestKey(size) {
  return `memory.bestScore.${size}`;
}

/**
 * Read best score for a size from localStorage
 * @param {'4x4'|'6x6'} size
 * @returns {{moves:number,timeSeconds:number}|null}
 */
function loadBest(size) {
  try {
    const raw = window.localStorage.getItem(bestKey(size));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (
      obj &&
      typeof obj === 'object' &&
      Number.isFinite(obj.moves) &&
      Number.isFinite(obj.timeSeconds)
    ) {
      return { moves: obj.moves, timeSeconds: obj.timeSeconds };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Save best score if better than previous.
 * Fewest moves wins; tie broken by lowest timeSeconds.
 * @param {'4x4'|'6x6'} size
 * @param {{moves:number,timeSeconds:number}} candidate
 * @returns {{moves:number,timeSeconds:number}}
 */
function saveBest(size, candidate) {
  const prev = loadBest(size);
  let toSave = candidate;
  if (prev) {
    const better =
      candidate.moves < prev.moves ||
      (candidate.moves === prev.moves && candidate.timeSeconds < prev.timeSeconds);
    toSave = better ? candidate : prev;
  }
  try {
    window.localStorage.setItem(bestKey(size), JSON.stringify(toSave));
  } catch {
    // ignore storage errors
  }
  return toSave;
}

// PUBLIC_INTERFACE
/**
 * useGame
 *
 * Hook that manages the Memory Flip Card game state and integrates with backend API.
 * - Initializes a game session by calling createGame({ size })
 * - Maintains board, size, move count, matched pairs, gameOver, timer, busy state, and gameId
 * - Exposes actions: startNewGame(size), flip(index), reset(), setSize(size)
 *
 * State shape returned:
 * {
 *   board: Array<{id,index,faceUp,matched,value?}>,
 *   size: '4x4'|'6x6',
 *   moves: number,
 *   matchedPairs: number,
 *   gameOver: boolean,
 *   timeSeconds: number,
 *   formattedTime: string,
 *   bestScore: {moves:number,timeSeconds:number} | null,
 *   isBusy: boolean,
 *   error: string | null,
 * }
 *
 * Actions:
 * {
 *   startNewGame: (size?: '4x4'|'6x6') => Promise<void>,
 *   flip: (index: number) => Promise<void>,
 *   reset: () => Promise<void>,
 *   setSize: (size: '4x4'|'6x6') => void,
 * }
 */
export default function useGame() {
  const [size, setSize] = useState('4x4');
  const [gameId, setGameId] = useState(null);
  const [board, setBoard] = useState([]);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);
  const [bestScore, setBestScore] = useState(null);

  // Track timer running and interval
  const timerRef = useRef(null);
  const timerRunningRef = useRef(false);

  // Track first card selected for local optimistic logic
  const firstSelectedRef = useRef(null);

  // Local glyph map used when backend value is temporarily masked; stable per session
  // Maps card.index -> stable pseudo-value number for glyph selection
  const localGlyphMapRef = useRef(new Map());
  // Simple deterministic glyph assignment counter
  const nextGlyphValRef = useRef(0);

  /**
   * Resolve a display value for a card:
   * - Prefer backend value when provided
   * - If faceUp/matched but value is null (masked), provide a stable local pseudo value
   * - Otherwise return null
   */
  const resolveDisplayValue = useCallback((card) => {
    if (card == null) return null;
    if (card.value != null) return card.value;
    if (card.faceUp || card.matched) {
      const map = localGlyphMapRef.current;
      if (!map.has(card.index)) {
        // Assign next pseudo value
        const v = nextGlyphValRef.current;
        map.set(card.index, v);
        nextGlyphValRef.current = (v + 1) % 1000;
      }
      return map.get(card.index);
    }
    return null;
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        timerRunningRef.current = false;
      }
    };
  }, []);

  // Load best score when size changes
  useEffect(() => {
    setBestScore(loadBest(size));
  }, [size]);

  /**
   * Starts or restarts the timer.
   */
  const startTimer = useCallback(() => {
    if (timerRunningRef.current) return;
    timerRunningRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeSeconds((t) => t + 1);
    }, 1000);
  }, []);

  /**
   * Stops the timer.
   */
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerRunningRef.current = false;
  }, []);

  /**
   * Initialize a new game from backend for a given size.
   * @param {'4x4'|'6x6'} nextSize
   */
  const startNewGame = useCallback(
    async (nextSize) => {
      const s = nextSize || size;
      setError(null);
      setIsBusy(true);
      try {
        const session = await createGame({ size: s });
        // Normalize from backend response GameSessionView
        const newId = session.session_id;
        setGameId(newId);
        setSize(session.size || s);
        setMoves(session.moveCount || 0);
        setGameOver(!!session.gameOver);
        // Reset local glyph map at new game start
        localGlyphMapRef.current = new Map();
        nextGlyphValRef.current = 0;
        const initial = toBoard(session.cards || []);
        // Compute displayValue immediately for UI
        const withDisplay = initial.map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
        setBoard(withDisplay);
        setMatchedPairs(session.matchedCount || 0);
        setTimeSeconds(0);
        firstSelectedRef.current = session.firstSelection ?? null;
        // timer resets; do not start until first flip
        stopTimer();
        setBestScore(loadBest(s));
        // Debug logs to aid diagnosis of masked values
        try {
          // eslint-disable-next-line no-console
          console.debug('[Game] createGame session', { sessionId: newId, size: session.size, cards: session.cards });
          // eslint-disable-next-line no-console
          console.debug('[Game] initial board', withDisplay.map(({ index, faceUp, matched, value, displayValue }) => ({ index, faceUp, matched, value, displayValue })));
        } catch {}
      } catch (e) {
        setError(e?.message || 'Failed to start game');
      } finally {
        setIsBusy(false);
      }
    },
    [size, stopTimer]
  );

  /**
   * Reset game using backend reset endpoint (keeps same size)
   */
  const reset = useCallback(async () => {
    if (!gameId) {
      // If no game yet, just start a new one
      await startNewGame(size);
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const res = await resetGame(gameId);
      const session = res.session || res;
      setGameId(session.session_id);
      setSize(session.size || size);
      setMoves(session.moveCount || 0);
      setGameOver(!!session.gameOver);
      // Reset local pseudo glyph state on reset
      localGlyphMapRef.current = new Map();
      nextGlyphValRef.current = 0;
      const initial = toBoard(session.cards || []);
      const withDisplay = initial.map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
      setBoard(withDisplay);
      setMatchedPairs(session.matchedCount || 0);
      setTimeSeconds(0);
      firstSelectedRef.current = session.firstSelection ?? null;
      stopTimer();
      setBestScore(loadBest(session.size || size));
      try {
        // eslint-disable-next-line no-console
        console.debug('[Game] resetGame session', { sessionId: session.session_id, size: session.size, cards: session.cards });
        // eslint-disable-next-line no-console
        console.debug('[Game] board after reset', withDisplay.map(({ index, faceUp, matched, value, displayValue }) => ({ index, faceUp, matched, value, displayValue })));
      } catch {}
    } catch (e) {
      setError(e?.message || 'Failed to reset game');
    } finally {
      setIsBusy(false);
    }
  }, [gameId, size, startNewGame, stopTimer]);

  /**
   * Reconcile session state from backend FlipResult or GameSessionView
   * @param {any} payload
   */
  const reconcileSession = useCallback((payload) => {
    const session = payload.session || payload;
    try {
      // eslint-disable-next-line no-console
      console.debug('[Game] reconcile payload', {
        moveCount: session.moveCount,
        matchedCount: session.matchedCount,
        firstSelection: session.firstSelection,
        gameOver: session.gameOver,
        sampleCards: (session.cards || []).slice(0, 4)
      });
    } catch {}
    setMoves(session.moveCount || 0);
    setMatchedPairs(session.matchedCount || 0);
    setGameOver(!!session.gameOver);
    const mapped = toBoard(session.cards || []);
    const withDisplay = mapped.map((c) => {
      // If backend now provides value for an index we had a local mapping for, prefer backend
      if (c.value != null && localGlyphMapRef.current.has(c.index)) {
        // optional: keep map entry but it won't be used when value exists
      }
      return { ...c, displayValue: resolveDisplayValue(c) };
    });
    setBoard(withDisplay);
    firstSelectedRef.current = session.firstSelection ?? null;
  }, [resolveDisplayValue]);

  /**
   * Handle end of game: stop timer and persist best score
   */
  useEffect(() => {
    if (gameOver) {
      stopTimer();
      // Save best score if better
      const current = { moves, timeSeconds };
      const saved = saveBest(size, current);
      setBestScore(saved);
    }
  }, [gameOver, moves, timeSeconds, size, stopTimer]);

  /**
   * Flip a card with optimistic UI for the first flip, and server resolution for the second.
   * - Ignores input when busy, game over, or invalid index.
   * - Starts timer on first flip.
   * @param {number} index
   */
  const flip = useCallback(
    async (index) => {
      if (isBusy || gameOver || gameId == null) return;
      if (typeof index !== 'number' || index < 0 || index >= board.length) return;

      setError(null);

      const first = firstSelectedRef.current;

      if (first == null) {
        // Optimistic first flip: reveal the selected card locally
        const prev = board;
        const target = prev[index];
        if (!target || target.faceUp || target.matched) return;
        const optimistic = prev.map((c, i) =>
          i === index ? { ...c, faceUp: true } : c
        ).map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
        setBoard(optimistic);
        firstSelectedRef.current = index;
        // start timer on very first flip of the game session
        startTimer();

        try {
          // Send first flip to backend (no move increment yet)
          const result = await flipCard(gameId, index);
          try {
            // eslint-disable-next-line no-console
            console.debug('[Game] first flip result', { turnResolved: result.turnResolved, wasMatch: result.wasMatch, sessionMoves: result?.session?.moveCount });
          } catch {}
          // Merge with server truth to avoid drift
          reconcileSession(result);
        } catch (e) {
          // Rollback optimistic flip on error
          const rolledBack = prev.map((c, i) => (i === index ? { ...c, faceUp: false } : c))
            .map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
          setBoard(rolledBack);
          firstSelectedRef.current = null;
          setError(e?.message || 'Flip failed');
        }
        return;
      }

      // Second flip: we need to lock until resolution
      if (first === index) return; // ignore flipping the same card

      const prev = board;
      const firstCard = prev[first];
      const secondCard = prev[index];

      if (!firstCard || !secondCard) return;
      if (secondCard.faceUp || secondCard.matched) return;

      // Optimistically flip second card to show the user
      const optimisticSecond = prev.map((c, i) =>
        i === index ? { ...c, faceUp: true } : c
      ).map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
      setBoard(optimisticSecond);
      setIsBusy(true);

      try {
        const result = await flipCard(gameId, index);
        // Server will increment moveCount and determine match
        const turnResolved = !!result.turnResolved;
        const wasMatch = result.wasMatch;

        try {
          // eslint-disable-next-line no-console
          console.debug('[Game] second flip result', { turnResolved, wasMatch, sessionMoves: result?.session?.moveCount });
        } catch {}

        // Always reconcile to server state first
        reconcileSession(result);

        if (turnResolved && wasMatch === false) {
          // Not a match: briefly show both, then flip them back.
          // However, server state may already have one or both face-down.
          // To ensure UX delay, we display current board for ~1s, then fetch session to ensure final.
          await new Promise((r) => setTimeout(r, 1000));
          // Refresh state from server to avoid desync after delay
          try {
            const fresh = await getGame(gameId);
            try {
              // eslint-disable-next-line no-console
              console.debug('[Game] refreshed session after mismatch delay', { moveCount: fresh.moveCount, matchedCount: fresh.matchedCount });
            } catch {}
            reconcileSession(fresh);
          } catch {
            // If refresh fails, we keep whatever state we already have from result
          }
        }
      } catch (e) {
        // On error, rollback the optimistic second flip
        const rolledBack = prev.map((c, i) => (i === index ? { ...c, faceUp: false } : c))
          .map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
        setBoard(rolledBack);
        setError(e?.message || 'Flip failed');
        // best-effort sync from server to avoid drift
        try {
          if (gameId) {
            const fresh = await getGame(gameId);
            reconcileSession(fresh);
          }
        } catch {
          // ignore
        }
      } finally {
        firstSelectedRef.current = null; // turn completed or failed; next turn fresh
        setIsBusy(false);
      }
    },
    [board, gameOver, gameId, isBusy, reconcileSession, startTimer, resolveDisplayValue]
  );

  // Initial auto-start a game on mount if none exists
  useEffect(() => {
    if (!gameId) {
      // Fire and forget; no dependency on startNewGame to avoid eslint exhaustive-deps noise
      (async () => {
        await startNewGame(size);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formattedTime = useMemo(() => formatTime(timeSeconds), [timeSeconds]);

  // Dev-only: log board concise summary when it changes; helpful for diagnosing missing glyphs
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug('[Game] board update', board.map(({ index, faceUp, matched, value, displayValue }) => ({ index, faceUp, matched, value, displayValue })));
    } catch {}
  }, [board]);

  const state = useMemo(
    () => ({
      board,
      size,
      moves,
      matchedPairs,
      gameOver,
      timeSeconds,
      formattedTime,
      bestScore,
      isBusy,
      error,
      gameId,
    }),
    [
      board,
      size,
      moves,
      matchedPairs,
      gameOver,
      timeSeconds,
      formattedTime,
      bestScore,
      isBusy,
      error,
      gameId,
    ]
  );

  const actions = useMemo(
    () => ({
      startNewGame,
      flip,
      reset,
      setSize, // allow UI to change desired size; call startNewGame after changing size
    }),
    [flip, reset, startNewGame]
  );

  return { state, actions };
}

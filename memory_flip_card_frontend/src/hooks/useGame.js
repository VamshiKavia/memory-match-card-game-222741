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
 *   board: Array<{id,index,faceUp,matched,value?,displayValue?}>,
 *   size: '4x4'|'6x6',
 *   moves: number,
 *   matchedPairs: number,
 *   totalPairs: number,
 *   gameOver: boolean,
 *   timeSeconds: number,
 *   formattedTime: string,
 *   bestScore: {moves:number,timeSeconds:number} | null,
 *   isBusy: boolean, // lockDuringEval
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
  const [isBusy, setIsBusy] = useState(false); // lockDuringEval
  const [error, setError] = useState(null);
  const [bestScore, setBestScore] = useState(null);

  // Derived: total pairs from board length
  const totalPairs = useMemo(() => Math.floor((board?.length || 0) / 2), [board]);

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
        const newId = session.session_id;
        setGameId(newId);
        setSize(session.size || s);
        setMoves(session.moveCount || 0);
        setGameOver(!!session.gameOver);
        // Reset local glyph map at new game start
        localGlyphMapRef.current = new Map();
        nextGlyphValRef.current = 0;
        const initial = toBoard(session.cards || []);
        const withDisplay = initial.map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
        setBoard(withDisplay);
        setMatchedPairs(session.matchedCount || 0);
        setTimeSeconds(0);
        firstSelectedRef.current = session.firstSelection ?? null;
        // timer resets; do not start until first flip
        stopTimer();
        setBestScore(loadBest(s));
      } catch (e) {
        setError(e?.message || 'Failed to start game');
      } finally {
        setIsBusy(false);
      }
    },
    [size, stopTimer, resolveDisplayValue]
  );

  /**
   * Reset game using backend reset endpoint (keeps same size)
   */
  const reset = useCallback(async () => {
    if (!gameId) {
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
    } catch (e) {
      setError(e?.message || 'Failed to reset game');
    } finally {
      setIsBusy(false);
    }
  }, [gameId, size, startNewGame, stopTimer, resolveDisplayValue]);

  /**
   * Reconcile session state from backend FlipResult or GameSessionView
   * @param {any} payload
   */
  const reconcileSession = useCallback((payload) => {
    const session = payload.session || payload;
    // Targeted trace for debugging; avoid sensitive/large logs
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[useGame] reconcile', {
        moveCount: session.moveCount,
        matchedCount: session.matchedCount,
        gameOver: session.gameOver,
        firstSelection: session.firstSelection,
        cardsLen: Array.isArray(session.cards) ? session.cards.length : 0,
      });
    }
    setMoves(session.moveCount || 0);
    setMatchedPairs(session.matchedCount || 0);
    setGameOver(!!session.gameOver);
    const mapped = toBoard(session.cards || []);
    const withDisplay = mapped.map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
    setBoard(withDisplay);
    firstSelectedRef.current = session.firstSelection ?? null;
  }, [resolveDisplayValue]);

  /**
   * Handle end of game: stop timer and persist best score
   */
  useEffect(() => {
    if (gameOver) {
      stopTimer();
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
      // Prevent flipping during evaluation, game over, or invalid index
      if (isBusy || gameOver || gameId == null) return;
      if (typeof index !== 'number' || index < 0 || index >= board.length) return;

      setError(null);

      const first = firstSelectedRef.current;

      if (first == null) {
        // Optimistic first flip: reveal and keep it visible
        const prev = board;
        const target = prev[index];
        if (!target || target.faceUp || target.matched) return;
        const optimistic = prev.map((c, i) =>
          i === index ? { ...c, faceUp: true } : c
        ).map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
        setBoard(optimistic);
        firstSelectedRef.current = index;
        startTimer();

        try {
          // Inform backend of first flip (no move increment yet)
          const result = await flipCard(gameId, index);
          reconcileSession(result); // keep UI aligned with server
        } catch (e) {
          // Rollback if server call fails
          const rolledBack = prev.map((c, i) => (i === index ? { ...c, faceUp: false } : c))
            .map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
          setBoard(rolledBack);
          firstSelectedRef.current = null;
          setError(e?.message || 'Flip failed');
        }
        return;
      }

      // Second flip handling
      if (first === index) return; // ignore same card

      const prev = board;
      const firstCard = prev[first];
      const secondCard = prev[index];
      if (!firstCard || !secondCard) return;
      if (secondCard.faceUp || secondCard.matched) return;

      // Optimistically reveal second card
      const optimisticSecond = prev.map((c, i) =>
        i === index ? { ...c, faceUp: true } : c
      ).map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
      setBoard(optimisticSecond);

      // Lock to prevent third flip while we evaluate
      setIsBusy(true);

      try {
        // Backend resolves pair and increments moves
        const result = await flipCard(gameId, index);
        const turnResolved = !!result.turnResolved;
        const wasMatch = result.wasMatch;

        // Reconcile to server truth right away
        reconcileSession(result);

        // If mismatch, keep both visible briefly then flip back (server returns snapshot with both up)
        if (turnResolved && wasMatch === false) {
          await new Promise((r) => setTimeout(r, 850)); // brief delay before showing flip-back
          try {
            // Ensure final state after delay is consistent with backend (which has already flipped them down)
            const fresh = await getGame(gameId);
            reconcileSession(fresh);
          } catch {
            // ignore refresh error; state will be reconciled on next interaction
          }
        }
      } catch (e) {
        // On failure, flip the second back optimistically and try to refetch
        const rolledBack = prev.map((c, i) => (i === index ? { ...c, faceUp: false } : c))
          .map((c) => ({ ...c, displayValue: resolveDisplayValue(c) }));
        setBoard(rolledBack);
        setError(e?.message || 'Flip failed');
        try {
          if (gameId) {
            const fresh = await getGame(gameId);
            reconcileSession(fresh);
          }
        } catch {
          // ignore refresh error
        }
      } finally {
        // Clear selection for next turn and unlock
        firstSelectedRef.current = null;
        setIsBusy(false);
      }
    },
    [board, gameOver, gameId, isBusy, reconcileSession, startTimer, resolveDisplayValue]
  );

  // Auto start a game on initial mount
  useEffect(() => {
    if (!gameId) {
      (async () => {
        await startNewGame(size);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formattedTime = useMemo(() => formatTime(timeSeconds), [timeSeconds]);

  const state = useMemo(
    () => ({
      board,
      size,
      moves,
      matchedPairs,
      totalPairs,
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
      totalPairs,
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

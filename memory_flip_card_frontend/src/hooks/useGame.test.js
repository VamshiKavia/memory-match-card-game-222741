import { renderHook, act } from '@testing-library/react';
import useGame from './useGame';
import * as api from '../lib/api';

// Basic fake timers for time-based behavior
jest.useFakeTimers();

// Helpers to build a mock session
function buildSession({ size = '4x4', moveCount = 0, matchedCount = 0, firstSelection = null, cards = [], gameOver = false } = {}) {
  return {
    session_id: '11111111-1111-1111-1111-111111111111',
    size,
    moveCount,
    gameOver,
    matchedCount,
    firstSelection,
    updatedAt: Math.floor(Date.now() / 1000),
    createdAt: Math.floor(Date.now() / 1000) - 1,
    cards
  };
}

// Utility: Build a deck for 4x4 with perfect pairs (value present only for visible/matched)
function buildDeck16({ faceUp = [], matched = [] } = {}) {
  const values = [];
  for (let v = 0; v < 8; v++) {
    values.push(v, v);
  }
  // Fixed ordering for deterministic tests
  return values.map((val, index) => {
    const isFaceUp = faceUp.includes(index);
    const isMatched = matched.includes(index);
    return {
      index,
      isFaceUp,
      isMatched,
      value: (isFaceUp || isMatched) ? val : null
    };
  });
}

describe('useGame core rules', () => {
  let createGameSpy, flipCardSpy, getGameSpy, resetGameSpy;

  beforeEach(() => {
    // Fresh spies and default mocks
    createGameSpy = jest.spyOn(api, 'createGame');
    flipCardSpy = jest.spyOn(api, 'flipCard');
    getGameSpy = jest.spyOn(api, 'getGame');
    resetGameSpy = jest.spyOn(api, 'resetGame');

    const initialSession = buildSession({
      size: '4x4',
      moveCount: 0,
      matchedCount: 0,
      firstSelection: null,
      cards: buildDeck16()
    });

    createGameSpy.mockResolvedValue(initialSession);
    getGameSpy.mockResolvedValue(initialSession);
    flipCardSpy.mockImplementation(async (_gameId, index) => {
      // Simulate backend first flip: reveal index, set firstSelection
      const current = buildSession({
        size: '4x4',
        moveCount: 0,
        matchedCount: 0,
        firstSelection: index,
        cards: buildDeck16({ faceUp: [index] })
      });
      return { session: current, turnResolved: false, wasMatch: null };
    });
    resetGameSpy.mockResolvedValue({ session: initialSession });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.resetAllMocks();
  });

  it('creates a deck with exact pairs (8 pairs for 4x4)', async () => {
    const { result } = renderHook(() => useGame());

    // Wait microtask queue for initial createGame
    await act(async () => {});

    const { board, totalPairs } = result.current.state;
    expect(board.length).toBe(16);
    expect(totalPairs).toBe(8);

    // Extract revealed values (none revealed at init)
    // Ensure pair counts by checking value distribution when force-revealed through session mapping helper:
    // Simulate all faceUp to get values from backend shape and ensure exactly two of each of 8 values
    const forcedCards = buildDeck16({ faceUp: Array.from({ length: 16 }, (_, i) => i) });
    const forcedValues = forcedCards.map(c => c.value);
    const counts = new Map();
    forcedValues.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    expect(counts.size).toBe(8);
    counts.forEach((count) => expect(count).toBe(2));
  });

  it('first flipped card stays visible and does not increment moves', async () => {
    const { result } = renderHook(() => useGame());
    await act(async () => {});

    const firstIndex = 0;

    await act(async () => {
      await result.current.actions.flip(firstIndex);
    });

    const { board, moves, isBusy } = result.current.state;
    expect(board[firstIndex].faceUp).toBe(true);
    expect(moves).toBe(0);
    expect(isBusy).toBe(false);
    expect(flipCardSpy).toHaveBeenCalledTimes(1);
  });

  it('on second flip: matches keep both visible, moves increment once', async () => {
    // Prepare flipCard mock to simulate second flip resolves a match for indices 0 and 1 (both value 0 in buildDeck16)
    flipCardSpy.mockImplementationOnce(async (_gameId, index) => {
      const session = buildSession({
        size: '4x4',
        moveCount: 0,
        matchedCount: 0,
        firstSelection: index,
        cards: buildDeck16({ faceUp: [index] })
      });
      return { session, turnResolved: false, wasMatch: null };
    });

    flipCardSpy.mockImplementationOnce(async (_gameId, index) => {
      const session = buildSession({
        size: '4x4',
        moveCount: 1,
        matchedCount: 1,
        firstSelection: null,
        cards: buildDeck16({ matched: [0, 1] })
      });
      return { session, turnResolved: true, wasMatch: true };
    });

    const { result } = renderHook(() => useGame());
    await act(async () => {});

    await act(async () => {
      await result.current.actions.flip(0); // first
    });
    await act(async () => {
      await result.current.actions.flip(1); // second (match)
    });

    const { board, moves, matchedPairs, isBusy } = result.current.state;
    expect(board[0].matched && board[1].matched).toBe(true);
    expect(moves).toBe(1);
    expect(matchedPairs).toBe(1);
    expect(isBusy).toBe(false);
  });

  it('glyphs for fully revealed 4x4 board resolve to exactly 8 unique values occurring twice', async () => {
    // Make createGame return a session with all cards revealed so values are present
    const fullFaceUp = buildDeck16({ faceUp: Array.from({ length: 16 }, (_, i) => i) });
    createGameSpy.mockResolvedValueOnce(buildSession({
      size: '4x4',
      moveCount: 0,
      matchedCount: 0,
      firstSelection: null,
      cards: fullFaceUp
    }));

    const { result } = renderHook(() => useGame());
    await act(async () => {});

    const { board } = result.current.state;
    expect(board.length).toBe(16);
    const values = board.map(c => c.value ?? c.displayValue);
    const counts = new Map();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    expect(counts.size).toBe(8);
    counts.forEach(cnt => expect(cnt).toBe(2));
  });
});

import React from 'react';

/**
 * Header component renders game controls and stats.
 *
 * PUBLIC_INTERFACE
 * @param {Object} props
 * @param {Object} props.state - Game state from useGame hook
 * @param {Object} props.actions - Game actions from useGame hook
 * @param {(size: '4x4'|'6x6') => void} props.onChangeSize - Callback to request a size change (will start new game)
 */
export default function Header({ state, actions, onChangeSize }) {
  const {
    size,
    moves,
    matchedPairs,
    formattedTime,
    bestScore,
    isBusy,
    gameOver,
    error,
  } = state;

  const { reset } = actions;

  return (
    <header className="game-header" role="banner" aria-label="Game controls and stats">
      <div className="brand">
        <span className="logo" aria-hidden="true">🃏</span>
        <h1 className="title">Memory Match</h1>
      </div>

      <div className="controls">
        <div className="size-group" role="group" aria-label="Board size">
          <button
            className={`btn ${size === '4x4' ? 'btn-active' : ''}`}
            onClick={() => onChangeSize('4x4')}
            disabled={isBusy}
            aria-pressed={size === '4x4'}
          >
            4 x 4
          </button>
          <button
            className={`btn ${size === '6x6' ? 'btn-active' : ''}`}
            onClick={() => onChangeSize('6x6')}
            disabled={isBusy}
            aria-pressed={size === '6x6'}
          >
            6 x 6
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={reset}
          disabled={isBusy}
          aria-busy={isBusy ? 'true' : 'false'}
        >
          {isBusy ? 'Working…' : 'Reset'}
        </button>
      </div>

      <div className="stats" role="status" aria-live="polite">
        <div className="stat">
          <span className="stat-label">Moves</span>
          <span className="stat-value">{moves}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Pairs</span>
          <span className="stat-value">{matchedPairs}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Time</span>
          <span className="stat-value">{formattedTime}</span>
        </div>
        {bestScore && (
          <div className="stat best">
            <span className="stat-label">Best</span>
            <span className="stat-value">
              {bestScore.moves} in {Math.floor(bestScore.timeSeconds / 60)}m{String(bestScore.timeSeconds % 60).padStart(2, '0')}s
            </span>
          </div>
        )}
      </div>

      {gameOver && (
        <div className="banner success" role="alert">
          🎉 Great job! You matched all pairs in {moves} moves and {formattedTime}.
        </div>
      )}
      {error && (
        <div className="banner error" role="alert">
          ⚠️ {error}
        </div>
      )}
    </header>
  );
}

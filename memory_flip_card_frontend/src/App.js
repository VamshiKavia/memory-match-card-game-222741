import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import useGame from './hooks/useGame';
import Header from './components/Header';
import Board from './components/Board';

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');
  const { state, actions } = useGame();

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const { board, size, isBusy } = state;
  const { flip, startNewGame, setSize } = actions;

  // When size changes from header, update and start a new game
  const handleChangeSize = async (nextSize) => {
    if (nextSize === size) return;
    setSize(nextSize);
    await startNewGame(nextSize);
  };

  // Memoize onFlip to avoid re-renders
  const onFlip = useMemo(() => (index) => {
    // Ensure click passes to game logic; first flip remains visible,
    // second keeps both visible during evaluation (handled in hook).
    flip(index);
  }, [flip]);

  return (
    <div className="App">
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
      </button>

      <Header state={state} actions={actions} onChangeSize={handleChangeSize} />
      <Board board={board} size={size} onFlip={onFlip} isBusy={isBusy} />
    </div>
  );
}

export default App;

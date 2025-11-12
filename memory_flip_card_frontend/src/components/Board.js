import React, { useMemo } from 'react';
import Card from './Card';

/**
 * Board component renders the grid of cards and wires up click handling.
 *
 * PUBLIC_INTERFACE
 * @param {Object} props
 * @param {Array<{id:string,index:number,faceUp:boolean,matched:boolean,value?:number|null,displayValue?:number|null}>} props.board
 * @param {'4x4'|'6x6'} props.size
 * @param {(index:number)=>void} props.onFlip
 * @param {boolean} props.isBusy
 */
export default function Board({ board, size, onFlip, isBusy }) {
  const columns = useMemo(() => (size === '6x6' ? 6 : 4), [size]);

  // Dev-only sanity checks: detect cases where a single glyph/value appears for all revealed cards.
  if (process.env.NODE_ENV !== 'production') {
    try {
      const revealed = board.filter(c => (c.faceUp || c.matched) && (c.value != null || c.displayValue != null));
      if (revealed.length >= 3) {
        const glyphSet = new Set(revealed.map(c => (c.value ?? c.displayValue)));
        if (glyphSet.size <= 1) {
          // eslint-disable-next-line no-console
          console.warn('[Board] All revealed cards appear to share the same glyph/value. Expected variety.', {
            count: revealed.length, unique: glyphSet.size
          });
        }
      }
      if (board.length === 16) {
        const allRevealed = board.filter(c => (c.faceUp || c.matched) && (c.value != null || c.displayValue != null));
        if (allRevealed.length === 16) {
          const vals = allRevealed.map(c => (c.value ?? c.displayValue));
          const counts = new Map();
          vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
          const ok = counts.size === 8 && Array.from(counts.values()).every(n => n === 2);
          if (!ok) {
            // eslint-disable-next-line no-console
            console.warn('[Board] Visible value distribution anomaly (expect 8 uniques x2).', { counts: Object.fromEntries(counts.entries()) });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return (
    <section
      className="board"
      role="grid"
      aria-label="Memory board"
      aria-busy={isBusy ? 'true' : 'false'}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(var(--card-size), var(--card-size)))`,
        pointerEvents: isBusy ? 'none' : 'auto', // disable interaction during evaluation
      }}
    >
      {board.map((card) => (
        <Card
          key={card.id}
          card={card}
          onClick={() => onFlip(card.index)}
          disabled={isBusy || card.matched || card.faceUp}
        />
      ))}
    </section>
  );
}

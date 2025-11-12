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

  // Let global CSS variables determine size/gaps/fonts.
  // Only specify the number of columns here.
  // Dev-only sanity: if all revealed in 4x4, ensure 8 uniques x2 by rendering-time sample
  if (process.env.NODE_ENV !== 'production') {
    try {
      if (board.length === 16) {
        const revealed = board.filter(c => (c.faceUp || c.matched) && (c.value != null || c.displayValue != null));
        if (revealed.length === 16) {
          const vals = revealed.map(c => (c.value ?? c.displayValue));
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

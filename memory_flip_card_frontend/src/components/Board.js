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

  // Define per-size CSS variable overrides for consistent scaling.
  // Smaller base for 6x6 to fit more cards, slightly larger for 4x4.
  const cssVars =
    size === '6x6'
      ? {
          // For dense grid, keep compact sizing
          '--card-min': 'var(--card-size)',
          '--card-max': '1fr',
          '--card-gap': '6px',
          '--card-aspect': '120%',
          '--card-font': 'clamp(12px, calc(var(--card-size) * 0.5), 18px)',
        }
      : {
          // For 4x4, still apply compact size to satisfy global requirement
          '--card-min': 'var(--card-size)',
          '--card-max': '1fr',
          '--card-gap': '8px',
          '--card-aspect': '120%',
          '--card-font': 'clamp(12px, calc(var(--card-size) * 0.6), 20px)',
        };

  return (
    <section
      className="board"
      role="grid"
      aria-label="Memory board"
      aria-busy={isBusy ? 'true' : 'false'}
      style={{
        ...cssVars,
        gridTemplateColumns: `repeat(${columns}, minmax(var(--card-min), var(--card-max)))`,
        pointerEvents: isBusy ? 'none' : 'auto', // disable interaction during evaluation
      }}
    >
      {board.map((card) => (
        <Card
          key={card.id}
          card={card}
          onClick={() => onFlip(card.index)}
          disabled={isBusy || card.matched}
        />
      ))}
    </section>
  );
}

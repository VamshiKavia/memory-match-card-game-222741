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
          // Use exact fixed sizing for all grids
          '--card-min': 'var(--card-size)',
          '--card-max': 'var(--card-size)',
          '--card-gap': '3px',
          '--card-aspect': '120%',
          '--card-font': 'clamp(10px, calc(var(--card-size) * 0.7), 14px)',
        }
      : {
          // Same fixed sizing for 4x4, with slightly larger gap than 6x6
          '--card-min': 'var(--card-size)',
          '--card-max': 'var(--card-size)',
          '--card-gap': '4px',
          '--card-aspect': '120%',
          '--card-font': 'clamp(10px, calc(var(--card-size) * 0.7), 14px)',
        };

  return (
    <section
      className="board"
      role="grid"
      aria-label="Memory board"
      aria-busy={isBusy ? 'true' : 'false'}
      style={{
        ...cssVars,
        gridTemplateColumns: `repeat(${columns}, minmax(var(--card-size), var(--card-size)))`,
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

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

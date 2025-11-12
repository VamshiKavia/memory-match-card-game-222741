import React from 'react';

/**
 * A single memory card.
 *
 * PUBLIC_INTERFACE
 * @param {Object} props
 * @param {{id:string,index:number,faceUp:boolean,matched:boolean,value?:number|null,displayValue?:number|null}} props.card
 * @param {() => void} props.onClick
 * @param {boolean} props.disabled
 */
export default function Card({ card, onClick, disabled }) {
  const { faceUp, matched, value, displayValue } = card;
  const showValue = faceUp || matched;
  const effectiveValue = (displayValue != null ? displayValue : value);

  const ariaLabel = matched
    ? 'Matched card'
    : faceUp
      ? `Card value ${effectiveValue ?? '?'}`
      : 'Face-down card';

  return (
    <button
      className={`card ${faceUp ? 'is-faceup' : ''} ${matched ? 'is-matched' : ''}`}
      onClick={onClick}
      disabled={disabled || matched}
      role="gridcell"
      aria-label={ariaLabel}
    >
      <div className="card-inner">
        {/* Front face (question mark) */}
        <div className="card-face card-front">
          {!showValue && '❓'}
        </div>

        {/* Back face (glyph). Keep content present to avoid accidental hiding */}
        <div className="card-face card-back">
          <span className="card-value">
            {showValue
              ? (effectiveValue == null ? '•' : renderValueGlyph(effectiveValue))
              : ''}
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Render a playful glyph for a card value. Purely cosmetic.
 * @param {number} v
 * @returns {string}
 */
function renderValueGlyph(v) {
  const glyphs = ['🍎','🍊','🍌','🍉','🍇','🍓','🍒','🍑','🍍','🥝','🥥','🥑','🌶️','🥕','🌽','🥔','🧀','🥨'];
  return glyphs[v % glyphs.length];
}

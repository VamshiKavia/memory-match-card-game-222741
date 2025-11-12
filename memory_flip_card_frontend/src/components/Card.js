import React from 'react';

/**
 * A single memory card.
 *
 * PUBLIC_INTERFACE
 * @param {Object} props
 * @param {{id:string,index:number,faceUp:boolean,matched:boolean,value?:number|null}} props.card
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
        <div className="card-face card-front" aria-hidden={showValue ? 'true' : 'false'}>
          ❓
        </div>
        <div className="card-face card-back" aria-hidden={showValue ? 'false' : 'true'}>
          {/* Use emoji numbers or shapes based on value for playful vibe */}
          <span className="card-value">
            {effectiveValue == null ? '•' : renderValueGlyph(effectiveValue)}
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

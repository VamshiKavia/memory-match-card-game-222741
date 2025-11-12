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

  // IMPORTANT: Only use per-index values provided by backend (value) or per-index temporary displayValue.
  // Never derive a single global glyph or fallback to a constant that would apply to all cards.
  const effectiveValue =
    showValue
      ? (value != null ? value : displayValue)
      : null;

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
              ? (effectiveValue == null
                  ? '•'
                  : renderValueGlyph(
                      typeof effectiveValue === 'number'
                        ? effectiveValue
                        : Number.isFinite(Number(effectiveValue))
                          ? Number(effectiveValue)
                          : 0
                    ))
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
  // Keep fixed first 8 glyphs matching backend 4x4 set; this function uses per-index numeric value.
  const glyphs = ['🍎','🍌','🍇','🍉','🍒','🥝','🍑','🍍',  '🍊','🍓','🥥','🥑','🌶️','🥕','🌽','🥔','🧀','🥨'];
  return glyphs[Math.abs(v) % glyphs.length];
}

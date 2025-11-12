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
  // Prefer backend-provided value when revealed; otherwise use stable local displayValue assigned by hook
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
  // For 4x4 the backend should use exactly this fixed set duplicated once and shuffled:
  // 🍎, 🍌, 🍇, 🍉, 🍒, 🥝, 🍑, 🍍
  // Keep these as the first eight entries so modulo mapping preserves intended visuals when values are 0..7.
  const glyphs = ['🍎','🍌','🍇','🍉','🍒','🥝','🍑','🍍',  '🍊','🍓','🥥','🥑','🌶️','🥕','🌽','🥔','🧀','🥨'];
  return glyphs[Math.abs(v) % glyphs.length];
}

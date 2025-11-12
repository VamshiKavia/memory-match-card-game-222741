/**
 * Simple API client for the Memory Flip Card game frontend.
 * - Centralized fetch wrapper with JSON parsing
 * - Normalized error handling returning consistent objects or throwing Errors
 * - No external dependencies
 */

import { getApiBase } from './env';

/**
 * Build full API URL with /api prefix.
 * @param {string} path - Path starting with '/', e.g. '/game'
 * @returns {string} Full URL
 */
function buildUrl(path) {
  const base = getApiBase();
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}/api${cleanPath}`;
}

/**
 * Normalize an error payload into a standard Error with extra info.
 * @param {number} status 
 * @param {any} body 
 * @param {string} url
 * @returns {Error}
 */
function toApiError(status, body, url) {
  const err = new Error(
    (body && (body.message || body.detail || body.error || body.code)) ||
      `Request failed with status ${status}`
  );
  err.status = status;
  err.url = url;
  // Preserve backend error structure if available
  if (body && typeof body === 'object') {
    err.code = body.code || body.type || undefined;
    err.details = body.details || body.detail || undefined;
    err.raw = body;
  }
  return err;
}

/**
 * Core fetch wrapper.
 * - Sends/accepts JSON
 * - Parses JSON response (if any)
 * - Throws normalized Error for non-2xx
 * @param {string} url 
 * @param {RequestInit} options 
 * @returns {Promise<any>} Parsed JSON or null for empty body
 */
async function request(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  // Add Content-Type json only when there is a body to send
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  const text = await response.text();
  const maybeJson = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw toApiError(response.status, maybeJson, url);
  }
  return maybeJson;
}

/**
 * Safe JSON parse helper.
 * @param {string} text 
 * @returns {any|null}
 */
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
/**
 * createGame
 * Create a new game with specified board size.
 * @param {{ size: '4x4' | '6x6' }} payload
 * @returns {Promise<any>} GameSessionView
 */
export async function createGame({ size = '4x4' } = {}) {
  const url = buildUrl('/game');
  return request(url, {
    method: 'POST',
    body: JSON.stringify({ size }),
  });
}

// PUBLIC_INTERFACE
/**
 * getGame
 * Fetch the current state for a given game session.
 * @param {string} gameId - UUID for the game session
 * @returns {Promise<any>} GameSessionView
 */
export async function getGame(gameId) {
  if (!gameId || typeof gameId !== 'string') {
    throw new Error('gameId is required');
  }
  const url = buildUrl(`/game/${encodeURIComponent(gameId)}`);
  return request(url, { method: 'GET' });
}

// PUBLIC_INTERFACE
/**
 * flipCard
 * Perform a flip action for the specified card index in the game.
 * @param {string} gameId - UUID for the game session
 * @param {number} index - Zero-based index of the card to flip
 * @returns {Promise<any>} FlipResult
 */
export async function flipCard(gameId, index) {
  if (!gameId || typeof gameId !== 'string') {
    throw new Error('gameId is required');
  }
  if (typeof index !== 'number' || index < 0) {
    throw new Error('index must be a non-negative number');
  }
  const url = buildUrl(`/game/${encodeURIComponent(gameId)}/flip`);
  return request(url, {
    method: 'POST',
    body: JSON.stringify({ index }),
  });
}

// PUBLIC_INTERFACE
/**
 * resetGame
 * Reset an existing game session to a fresh new game with the same board size.
 * @param {string} gameId - UUID for the game session
 * @returns {Promise<any>} ResetGameResponse
 */
export async function resetGame(gameId) {
  if (!gameId || typeof gameId !== 'string') {
    throw new Error('gameId is required');
  }
  const url = buildUrl(`/game/${encodeURIComponent(gameId)}/reset`);
  return request(url, { method: 'POST' });
}

//
// PUBLIC_INTERFACE
/**
 * getApiBase
 * 
 * Determines the base URL for the backend API used by the frontend.
 * Resolution order:
 * 1. REACT_APP_API_BASE (highest precedence)
 * 2. REACT_APP_BACKEND_URL
 * 3. Derive from window.location by replacing port :3000 -> :3001,
 *    or if no explicit port, append :3001 to current origin.
 *
 * Notes:
 * - This helper avoids hardcoding URLs and supports different environments.
 * - Ensure env vars are set via CRA-compatible prefix REACT_APP_* at build time.
 * - No secrets should be embedded in these variables; they are public at build time.
 *
 * @returns {string} Fully-qualified base URL string (e.g., https://host:3001)
 */
export function getApiBase() {
  // Prefer explicit env-provided bases if present
  const apiBase = process.env.REACT_APP_API_BASE;
  if (apiBase && typeof apiBase === 'string' && apiBase.trim() !== '') {
    return apiBase.trim().replace(/\/+$/, ''); // strip trailing slashes
  }

  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  if (backendUrl && typeof backendUrl === 'string' && backendUrl.trim() !== '') {
    return backendUrl.trim().replace(/\/+$/, '');
  }

  // Derive from current window location as a sensible default for local dev
  if (typeof window !== 'undefined' && window.location) {
    try {
      const { protocol, hostname, port } = window.location;
      // If running on 3000 (CRA default), switch to 3001 for backend
      if (port === '3000') {
        return `${protocol}//${hostname}:3001`;
      }
      // If another explicit port exists, still try 3001 as convention
      if (port && port.length > 0) {
        return `${protocol}//${hostname}:3001`;
      }
      // No explicit port; append :3001
      return `${protocol}//${hostname}:3001`;
    } catch {
      // fallthrough to absolute minimal default
    }
  }

  // Final fallback: assume same host, backend port 3001 over http
  return 'http://localhost:3001';
}

/**
 * UUID generation utility with fallback for non-secure contexts.
 *
 * crypto.randomUUID() requires a secure context (HTTPS) in some browsers.
 * This utility provides a fallback for development on HTTP.
 */

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID() if available, otherwise falls back to manual generation.
 */
export function generateUUID(): string {
    // Use native API if available (secure context)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback: generate UUID v4 manually using crypto.getRandomValues
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);

        // Set version (4) and variant (RFC4122)
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC4122

        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // Last resort fallback using Math.random (less secure but functional)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

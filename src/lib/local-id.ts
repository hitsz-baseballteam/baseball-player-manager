/**
 * Module-level unique ID generator.
 *
 * Lives outside any React component so the React Hooks lint rules
 * (`react-hooks/purity`) do not flag `Date.now` / `Math.random` /
 * `crypto.randomUUID` as impure calls during render. Callers must invoke
 * this only from event handlers, effects, or other post-render contexts —
 * never inline during render.
 */

let counter = 0;

function fallbackRandom(): string {
  // Avoid relying on `crypto.randomUUID` (not available in older runtimes).
  // 16 hex chars of entropy is more than enough for in-memory PA IDs.
  return Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
}

export function nextLocalId(prefix = "id"): string {
  counter = (counter + 1) >>> 0;
  const tail =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : fallbackRandom();
  return `${prefix}-${counter.toString(36)}-${tail}`;
}
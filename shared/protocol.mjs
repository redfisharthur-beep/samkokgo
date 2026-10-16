// Shared Cloudflare room protocol registry.
// Matching wire versions do not imply compatible combat simulations.
export const PROTOCOL_VERSION = 1;
export const DEFAULT_RULESET = "threejs-alpha";
export const RULESETS = Object.freeze({
  "threejs-alpha": Object.freeze({ engine: "threejs", roundSeconds: 720 }),
  "godot-alpha": Object.freeze({ engine: "godot", roundSeconds: 360 })
});
export function resolveRuleset(value) {
  if (value == null || value === "") return DEFAULT_RULESET;
  return Object.hasOwn(RULESETS, value) ? value : null;
}
export function sameRuleset(stored, requested) {
  return requested !== null && resolveRuleset(stored) === requested;
}
export function durationForRuleset(value) {
  return RULESETS[resolveRuleset(value)]?.roundSeconds ?? RULESETS[DEFAULT_RULESET].roundSeconds;
}

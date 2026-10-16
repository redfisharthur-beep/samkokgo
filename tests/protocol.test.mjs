import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROTOCOL_VERSION, RULESETS, DEFAULT_RULESET, resolveRuleset, sameRuleset, durationForRuleset } from "../shared/protocol.mjs";

test("stable v1 rulesets retain each engine's duration", () => {
  assert.equal(PROTOCOL_VERSION, 1);
  assert.equal(DEFAULT_RULESET, "threejs-alpha");
  assert.equal(RULESETS["threejs-alpha"].engine, "threejs");
  assert.equal(RULESETS["godot-alpha"].engine, "godot");
  assert.equal(durationForRuleset("threejs-alpha"), 720);
  assert.equal(durationForRuleset("godot-alpha"), 360);
});
test("legacy clients default to browser rooms", () => {
  assert.equal(resolveRuleset(undefined), "threejs-alpha");
  assert.equal(sameRuleset(undefined, "threejs-alpha"), true);
  assert.equal(sameRuleset(undefined, "godot-alpha"), false);
});
test("invalid and cross-engine room joins are rejected", () => {
  assert.equal(resolveRuleset("unknown"), null);
  assert.equal(sameRuleset("godot-alpha", "threejs-alpha"), false);
  assert.equal(sameRuleset("threejs-alpha", "godot-alpha"), false);
});
test("both client implementations send their ruleset", () => {
  const js = readFileSync(new URL("../public/main.js", import.meta.url), "utf8");
  const gd = readFileSync(new URL("../godot/scripts/cloudflare_room.gd", import.meta.url), "utf8");
  assert.ok(js.includes('const RULESET = "threejs-alpha"'));
  assert.ok(js.includes('api(protocolPath("/api/rooms")'));
  assert.ok(js.includes('&ruleset=${RULESET}&protocol=${PROTOCOL_VERSION}'));
  assert.ok(gd.includes('const RULESET := "godot-alpha"'));
  assert.ok(gd.includes('_protocol_query("?")'));
  assert.ok(gd.includes('_protocol_query("&")'));
});
test("preview Worker cannot be confused with production", () => {
  const config = readFileSync(new URL("../wrangler.godot-preview.toml", import.meta.url), "utf8");
  assert.ok(config.includes('name = "samkokgo-godot-preview"'));
  assert.ok(!config.includes('name = "samkokgo"'));
});

test("manual branch deploy also cannot overwrite production", () => {
  const config = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.ok(config.includes('name = "samkokgo-browser-preview"'));
  assert.ok(!config.includes('name = "samkokgo"'));
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeScenarioWarnings,
  buildAutoScenario,
  createDefaultWorkspace,
  createEmptyAssignments,
  removePlayersFromWorkspace,
  sanitizePlayers,
  sanitizePublicHomeConfig,
  sanitizeScenario,
  sanitizeWorkspace,
} from "./workspace";

describe("workspace sanitizers", () => {
  it("sanitizes invalid players and keeps valid ones", () => {
    const players = sanitizePlayers([
      { id: "1", name: "A", number: "10", bats: "R", throws: "R", positions: ["P"] },
      { id: "", name: "B", number: "20" },
      { id: "3", name: "C", number: "", positions: ["NOPE"] },
    ]);

    assert.equal(players.length, 1);
    assert.deepEqual(players[0].positions, ["P"]);
    assert.equal(players[0].profile.profileType, "pitcher");
  });

  it("preserves valid player profile extensions", () => {
    const [player] = sanitizePlayers([
      {
        id: "1",
        name: "A",
        number: "10",
        bats: "R",
        throws: "R",
        positions: ["CF"],
        profile: {
          profileType: "fielder",
          age: 19,
          heightCm: 178,
          weightKg: 72,
          armStrengthM: 72,
          thirtyMeterSec: 4.52,
          pitchTypes: ["滑球"],
          scoutingSummary: "中外野覆盖范围大",
          radar: {
            pitcher: { velocity: 45, command: 40, movement: 42, stamina: 38, fielding: 44, mental: 48 },
            fielder: { contact: 55, power: 46, speed: 62, arm: 59, defense: 58, instinct: 57 },
          },
        },
      },
    ]);

    assert.equal(player.profile.profileType, "fielder");
    assert.equal(player.profile.age, 19);
    assert.equal(player.profile.armStrengthM, 72);
    assert.equal(player.profile.thirtyMeterSec, 4.52);
    assert.deepEqual(player.profile.pitchTypes, ["滑球"]);
    assert.equal(player.profile.radar.fielder.speed, 62);
  });

  it("maps legacy armStrengthKmh / sixtyMeterSec to new field names", () => {
    const [player] = sanitizePlayers([
      {
        id: "1",
        name: "A",
        number: "10",
        bats: "R",
        throws: "R",
        positions: ["RF"],
        profile: {
          profileType: "fielder",
          armStrengthKmh: 132,
          sixtyMeterSec: 7.11,
        },
      },
    ]);

    assert.equal(player.profile.armStrengthM, 132);
    assert.equal(player.profile.thirtyMeterSec, 7.11);
  });



  it("builds a fallback workspace when input is malformed", () => {
    const workspace = sanitizeWorkspace({ players: "bad-data" });
    assert.equal(workspace.version, 3);
    assert.equal(workspace.scenarios.length, 1);
    assert.equal(workspace.players.length, 0);
  });

  it("sanitizes public homepage members", () => {
    const config = sanitizePublicHomeConfig({
      training: { schedule: "周五", location: "球场", whatToBring: [], whatWeProvide: [], note: "" },
      contacts: [],
      faq: [],
      history: { foundedYear: 2026, story: "球队故事", awards: [] },
      members: [
        {
          number: "12345",
          name: "测试队员".repeat(20),
          nickname: "NICKNAME".repeat(10),
          role: "超级长角色".repeat(10),
          note: "备注".repeat(100),
          tone: "invalid",
        },
        { number: "", name: "无背号", role: "队员", note: "", tone: "active" },
      ],
      feeds: {
        milestones: { enabled: true, maxCount: 3 },
        games: { enabled: true, maxCount: 3, gameTypes: ["official"] },
      },
    });

    assert.equal(config.members.length, 1);
    assert.equal(config.members[0].number, "1234");
    assert.equal(config.members[0].name.length, 48);
    assert.equal(config.members[0].nickname?.length, 32);
    assert.equal(config.members[0].role.length, 24);
    assert.equal(config.members[0].note.length, 120);
    assert.equal(config.members[0].tone, "active");
  });

  it("sanitizes scenario assignments against valid player ids", () => {
    const scenario = sanitizeScenario(
      {
        id: "s1",
        name: "Test",
        assignments: {
          defense: { P: "keep", C: "drop" },
          lineup: ["keep", "drop"],
        },
      },
      new Set(["keep"]),
    );

    assert.equal(scenario?.assignments.defense.P, "keep");
    assert.equal(scenario?.assignments.defense.C, null);
    assert.equal(scenario?.assignments.lineup[0], "keep");
    assert.equal(scenario?.assignments.lineup[1], null);
  });
});

describe("workspace behaviors", () => {
  it("auto assigns a lineup and defense from available players", () => {
    const workspace = createDefaultWorkspace(false);
    const scenario = buildAutoScenario(workspace, workspace.scenarios[0]);

    assert.equal(
      Object.values(scenario.assignments.defense).filter(Boolean).length > 0,
      true,
    );
    assert.equal(scenario.assignments.lineup.filter(Boolean).length > 0, true);
  });

  it("removes deleted players from defense and lineup", () => {
    const workspace = createDefaultWorkspace(false);
    const firstPlayer = workspace.players[0].id;
    workspace.scenarios[0].assignments = {
      defense: { ...createEmptyAssignments().defense, P: firstPlayer },
      lineup: [firstPlayer, null, null, null, null, null, null, null, null],
    };

    removePlayersFromWorkspace(workspace, [firstPlayer]);

    assert.equal(
      workspace.players.find((player) => player.id === firstPlayer),
      undefined,
    );
    assert.equal(workspace.scenarios[0].assignments.defense.P, null);
    assert.equal(workspace.scenarios[0].assignments.lineup[0], null);
  });

  it("reports lineup warnings for incomplete scenarios", () => {
    const workspace = createDefaultWorkspace(false);
    const warnings = analyzeScenarioWarnings(workspace, workspace.scenarios[0]);

    assert.equal(
      warnings.critical.some((item) => item.includes("守位未满")),
      true,
    );
    assert.equal(
      warnings.critical.some((item) => item.includes("棒次未满")),
      true,
    );
  });
});

import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { strict as assert } from "node:assert";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

import { HallOfFamePageClient } from "@/components/hall-of-fame-page-client";
import type { Workspace } from "@/lib/workspace";
import { createDefaultWorkspace } from "@/lib/workspace";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeWorkspace(): Workspace {
  const ws = createDefaultWorkspace(true);
  ws.players = ws.players.slice(0, 2);
  ws.players[0]!.id = "p-test1";
  ws.players[0]!.name = "老队员A";
  ws.players[0]!.number = "10";
  // Set joinedAt to 200 days ago to qualify for Hall of Fame
  const joinedDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
  ws.players[0]!.joinedAt = joinedDate;
  ws.players[1]!.id = "p-test2";
  ws.players[1]!.name = "新队员B";
  ws.players[1]!.number = "20";
  // No joinedAt → not inducted

  // Add official games for player 1
  ws.games = [
    {
      id: "g-1",
      date: "2026-06-01",
      opponent: "测试对手",
      gameType: "official",
      totalInnings: 9,
      innings: [],
      statLines: [
        {
          playerId: "p-test1",
          pa: 4, ab: 4, h: 2, doubles: 0, triples: 0, hr: 1, rbi: 2, r: 1, sb: 0, bb: 0, hbp: 0, sf: 0, so: 1,
          ip: null, er: null, soPitching: null, bbPitching: null, hPitching: null,
          po: 3, a: 1, e: 0,
          w: 0, l: 0, sv: 0, np: 0,
        },
      ],
    },
  ];
  return ws;
}

describe("HallOfFamePageClient", () => {
  beforeEach(() => {
    mock.module("@/lib/workspace-client", {
      namedExports: {
        loadWorkspaceSnapshot: async () => ({
          workspace: makeWorkspace(),
          version: 1,
          updatedAt: "2026-06-15T10:00:00.000Z",
        }),
        saveWorkspaceSnapshot: async (ws: Workspace, v: number) => ({
          workspace: ws,
          version: v + 1,
          updatedAt: "2026-06-15T10:00:01.000Z",
        }),
        saveWithRetry: async (ws: Workspace, v: number) => ({
          workspace: ws,
          version: v + 1,
          updatedAt: "2026-06-15T10:00:01.000Z",
        }),
        isVersionConflict: () => false,
        VersionConflictError: class extends Error {
          constructor() { super("version_conflict"); }
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    mock.reset();
  });

  it("renders inductee cards for qualifying players", () => {
    const ws = makeWorkspace();
    render(<HallOfFamePageClient initialWorkspace={ws} initialVersion={1} />);

    // Player 1 should appear (inducted) — may appear in both inductee card and all-time kings
    const player1Elements = screen.getAllByText("老队员A");
    assert.strictEqual(player1Elements.length >= 1, true);
    // Player 2 should NOT appear (no joinedAt)
    const player2Elements = screen.queryAllByText("新队员B");
    assert.strictEqual(player2Elements.length, 0);
  });

  it("shows empty state when no players qualify", () => {
    const ws = createDefaultWorkspace(true);
    ws.players = ws.players.slice(0, 1);
    ws.players[0]!.id = "p-test";
    ws.players[0]!.name = "新人";
    // No joinedAt, no games → not inducted

    render(<HallOfFamePageClient initialWorkspace={ws} initialVersion={1} />);
    const emptyText = screen.getByText("暂无名人堂成员");
    assert.notStrictEqual(emptyText, null);
  });

  it("renders milestones timeline when milestones exist", () => {
    const ws = makeWorkspace();
    ws.milestones = [
      {
        id: "m-1",
        date: "2025-11-12",
        title: "夺得XX邀请赛冠军",
        description: "以全胜战绩夺冠",
      },
    ];

    render(<HallOfFamePageClient initialWorkspace={ws} initialVersion={1} />);
    const milestoneTitle = screen.getByText("夺得XX邀请赛冠军");
    assert.notStrictEqual(milestoneTitle, null);
    const timelineTitle = screen.getByText("球队里程碑");
    assert.notStrictEqual(timelineTitle, null);
  });
});

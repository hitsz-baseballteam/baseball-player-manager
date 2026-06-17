# API

This document describes the current HTTP API exposed by the Next.js app.

## Overview

- Auth model: shared-passcode session via signed `httpOnly` cookie
- Read bootstrap endpoint: `GET /api/workspace`
- Write model: resource-specific mutation routes
- Success response for workspace reads and writes: `WorkspaceSnapshot`
- Request size cap for JSON bodies: `512 KB`

## Authentication

The app uses a shared-passcode session backed by a signed `httpOnly` cookie.

- Protected UI: `/panel/*`
- Protected API routes: `/api/workspace/:path*`, `/api/players/:path*`, `/api/scenarios/:path*`, `/api/games/:path*`, `/api/milestones/:path*`

Current code evidence:

- `src/proxy.ts` explicitly matches `/panel/:path*` plus every private workspace API namespace above
- browser clients call mutation routes with `credentials: "same-origin"`

## Shared Response Shape

Successful workspace read and mutation routes return:

```ts
type WorkspaceSnapshot = {
  workspace: Workspace;
  version: number;
  updatedAt: string;
};
```

`workspace` uses the domain model from [`src/lib/workspace/types.ts`](/Users/kennywang/app/baseball-player-manager/src/lib/workspace/types.ts).

## Common Write Contract

All mutation routes except `POST /api/logout` share these rules:

- Request body must include a positive integer `version`
- The server checks `version` against `app_workspace_meta.version`
- On success, the server commits one transaction and returns a fresh `WorkspaceSnapshot`
- On version mismatch, the server returns `409`
- During cutover or operational freeze, `MAINTENANCE_READ_ONLY=1` makes writes return `503`

## Common Errors

| Status | Error | Meaning |
|---|---|---|
| `400` | `invalid_payload` | JSON parse failure or schema validation failure |
| `401` | framework/auth response | Missing or invalid unlock cookie on protected routes |
| `405` | `method_not_allowed` | Legacy whole-workspace write route is intentionally disabled |
| `409` | `version_conflict` | Client version is stale |
| `413` | `payload_too_large` | Body exceeds `512 KB` |
| `429` | `rate_limited` | Route-level rate limit exceeded |
| `503` | `maintenance_read_only` | Writes temporarily frozen |

Validation errors may include a `details` object produced by Zod.

## Rate Limits

| Route group | Limit |
|---|---|
| `GET /api/workspace` | 120 requests / 60 seconds |
| Workspace mutation routes | 30 requests / 60 seconds |
| `POST /api/logout` | 20 requests / 60 seconds |

Workspace limits are keyed by IP plus session id when present.

## Domain Shapes

Important domain enums:

- `PlayerStatus`: `available | rest | injured | graduated`
- `Hand`: `R | L | S`
- `PositionCode`: `P | C | 1B | 2B | 3B | SS | LF | CF | RF`
- `Game.gameType`: `official | training`

Top-level domain objects:

### `Player`

```ts
type Player = {
  id: string;
  name: string;
  number: string;
  throws: "R" | "L" | "S";
  bats: "R" | "L" | "S";
  positions: PositionCode[];
  status: "available" | "rest" | "injured" | "graduated";
  joinedAt?: string;
  profile: PlayerProfile;
};
```

### `PlayerProfile`

```ts
type PlayerProfile = {
  profileType: "pitcher" | "fielder";
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  fastballTopKmh: number | null;
  fastballAvgKmh: number | null;
  armStrengthM: number | null;
  thirtyMeterSec: number | null;
  pitchTypes: string[];
  scoutingSummary: string;
  radar: {
    pitcher: {
      velocity: number | null;
      command: number | null;
      movement: number | null;
      stamina: number | null;
      fielding: number | null;
      mental: number | null;
    };
    fielder: {
      contact: number | null;
      power: number | null;
      speed: number | null;
      arm: number | null;
      defense: number | null;
      instinct: number | null;
    };
  };
};
```

### `Scenario`

```ts
type Scenario = {
  id: string;
  name: string;
  note: string;
  assignments: {
    defense: Record<PositionCode, string | null>;
    lineup: Array<string | null>;
  };
  createdAt: string;
  updatedAt: string;
};
```

### `Game`

```ts
type Game = {
  id: string;
  date: string;
  opponent: string;
  gameType: "official" | "training";
  totalInnings: number;
  innings: Array<{
    inning: number;
    hits: number;
    runs: number;
    batters: string[];
  }>;
  statLines: PlayerGameStatLine[];
  note?: string;
};
```

### `PlayerGameStatLine`

```ts
type PlayerGameStatLine = {
  playerId: string;
  pa: number;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  r: number;
  sb: number;
  bb: number;
  hbp: number;
  sf: number;
  so: number;
  ip: number | null;
  er: number | null;
  soPitching: number | null;
  bbPitching: number | null;
  hPitching: number | null;
  po: number;
  a: number;
  e: number;
  w: number;
  l: number;
  sv: number;
  np: number;
};
```

### `Milestone`

```ts
type Milestone = {
  id: string;
  date: string;
  title: string;
  description: string;
  mediaUrl?: string;
};
```

## Endpoints

### `POST /api/logout`

Clears the unlock cookie.

Request body:

- none

Responses:

- `204 No Content` on success
- `429 { "error": "rate_limited" }`

### `GET /api/workspace`

Bootstrap read endpoint. Returns the current workspace aggregate.

Request body:

- none

Success response:

```json
{
  "workspace": { "...": "..." },
  "version": 114,
  "updatedAt": "2026-06-16T02:06:57.992271+00:00"
}
```

Errors:

- `429 { "error": "rate_limited" }`

### `PUT /api/workspace`

Legacy whole-workspace write endpoint. It is intentionally disabled after the resource-specific write migration.

Request body:

- any body still passes through write preconditions first

Responses:

- `405 { "error": "method_not_allowed" }`
- `429 { "error": "rate_limited" }`
- `503 { "error": "maintenance_read_only" }`

### `POST /api/players`

Create one player.

Request body:

```json
{
  "version": 114,
  "player": {
    "id": "p-01",
    "name": "Player Name",
    "number": "7",
    "throws": "R",
    "bats": "R",
    "positions": ["CF"],
    "status": "available",
    "joinedAt": "2026-03-01",
    "profile": {
      "profileType": "fielder",
      "age": 20,
      "heightCm": 178,
      "weightKg": 72,
      "fastballTopKmh": null,
      "fastballAvgKmh": null,
      "armStrengthM": 85,
      "thirtyMeterSec": 4.2,
      "pitchTypes": [],
      "scoutingSummary": "",
      "radar": {
        "pitcher": {
          "velocity": null,
          "command": null,
          "movement": null,
          "stamina": null,
          "fielding": null,
          "mental": null
        },
        "fielder": {
          "contact": 70,
          "power": 55,
          "speed": 75,
          "arm": 65,
          "defense": 68,
          "instinct": 66
        }
      }
    }
  }
}
```

Success response:

- `200 WorkspaceSnapshot`

### `PATCH /api/players/[playerId]`

Update one player.

Request body:

```json
{
  "version": 114,
  "player": { "...full Player object..." }
}
```

Rules:

- `player.id` must match the route parameter
- The route replaces the stored player object after sanitization

Success response:

- `200 WorkspaceSnapshot`

### `DELETE /api/players/[playerId]`

Delete one player.

Request body:

```json
{
  "version": 114
}
```

Behavior:

- Deletes the player from the roster
- Clears scenario assignments that reference the player
- Preserves historical game stat lines that still reference the deleted `playerId`

Success response:

- `200 WorkspaceSnapshot`

### `POST /api/players/bulk-update`

Apply one bulk edit to multiple players.

Request body:

```json
{
  "version": 114,
  "ids": ["p-01", "p-02"],
  "input": {
    "status": "available",
    "bats": "keep",
    "throws": "keep",
    "positionMode": "append",
    "positions": ["LF", "CF"]
  }
}
```

Allowed values:

- `input.status`: `keep | available | rest | injured | graduated`
- `input.bats`: `keep | R | L | S`
- `input.throws`: `keep | R | L | S`
- `input.positionMode`: `keep | append | replace | remove`

Success response:

- `200 WorkspaceSnapshot`

### `POST /api/players/bulk-delete`

Delete multiple players.

Request body:

```json
{
  "version": 114,
  "ids": ["p-01", "p-02"]
}
```

Success response:

- `200 WorkspaceSnapshot`

### `POST /api/scenarios`

Create one scenario.

Request body:

```json
{
  "version": 114,
  "activate": true,
  "scenario": { "...full Scenario object..." }
}
```

Behavior:

- Scenario assignments are sanitized against current player ids
- `activate: true` also switches `activeScenarioId`

Success response:

- `200 WorkspaceSnapshot`

### `PATCH /api/scenarios/[scenarioId]`

Rename or update the note of one scenario.

Request body:

```json
{
  "version": 114,
  "name": "Weekend Lineup",
  "note": "Focus on defense"
}
```

Success response:

- `200 WorkspaceSnapshot`

### `DELETE /api/scenarios/[scenarioId]`

Delete one scenario.

Request body:

```json
{
  "version": 114
}
```

Success response:

- `200 WorkspaceSnapshot`

### `POST /api/scenarios/[scenarioId]/activate`

Set one scenario as active.

Request body:

```json
{
  "version": 114
}
```

Success response:

- `200 WorkspaceSnapshot`

### `PUT /api/scenarios/[scenarioId]/assignments`

Replace one scenario's assignments.

Request body:

```json
{
  "version": 114,
  "updatedAt": "2026-06-16T10:00:00.000Z",
  "assignments": {
    "defense": {
      "P": "p-01",
      "C": "p-02",
      "1B": null,
      "2B": null,
      "3B": null,
      "SS": null,
      "LF": null,
      "CF": null,
      "RF": null
    },
    "lineup": ["p-01", "p-02", null, null, null, null, null, null, null]
  }
}
```

Behavior:

- Assignments are sanitized against current player ids
- If `updatedAt` is omitted, the server writes a fresh current timestamp

Success response:

- `200 WorkspaceSnapshot`

### `POST /api/games`

Create one game.

Request body:

```json
{
  "version": 114,
  "game": { "...full Game object..." }
}
```

Success response:

- `200 WorkspaceSnapshot`

### `PATCH /api/games/[gameId]`

Update one game.

Request body:

```json
{
  "version": 114,
  "game": { "...full Game object..." }
}
```

Rules:

- `game.id` must match the route parameter

Success response:

- `200 WorkspaceSnapshot`

### `DELETE /api/games/[gameId]`

Delete one game.

Request body:

```json
{
  "version": 114
}
```

Success response:

- `200 WorkspaceSnapshot`

### `POST /api/milestones`

Create one milestone.

Supported request body forms:

Full object form:

```json
{
  "version": 114,
  "milestone": {
    "id": "m-01",
    "date": "2026-06-16",
    "title": "Won opener",
    "description": "Season opener win",
    "mediaUrl": "https://example.com/photo.jpg"
  }
}
```

Shortcut form:

```json
{
  "version": 114,
  "date": "2026-06-16",
  "title": "Won opener",
  "description": "Season opener win",
  "mediaUrl": "https://example.com/photo.jpg"
}
```

Success response:

- `200 WorkspaceSnapshot`

### `PATCH /api/milestones/[milestoneId]`

Update one milestone.

Request body:

```json
{
  "version": 114,
  "milestone": { "...full Milestone object..." }
}
```

Rules:

- `milestone.id` must match the route parameter

Success response:

- `200 WorkspaceSnapshot`

### `DELETE /api/milestones/[milestoneId]`

Delete one milestone.

Request body:

```json
{
  "version": 114
}
```

Success response:

- `200 WorkspaceSnapshot`

### `PATCH /api/workspace/preferences`

Update workspace-level preferences.

Request body:

```json
{
  "version": 114,
  "helpDismissed": true
}
```

Success response:

- `200 WorkspaceSnapshot`

### `POST /api/workspace/import`

Replace the current workspace with an imported full aggregate.

Request body:

```json
{
  "version": 114,
  "workspace": { "...full Workspace object..." }
}
```

Behavior:

- Sanitizes the incoming workspace
- Replaces the full workspace transactionally

Success response:

- `200 WorkspaceSnapshot`

### `POST /api/workspace/reset`

Replace the current workspace with a default empty workspace.

Request body:

```json
{
  "version": 114,
  "helpDismissed": false
}
```

Success response:

- `200 WorkspaceSnapshot`

## Client Usage Notes

The browser client in [`src/lib/workspace-client.ts`](/Users/kennywang/app/baseball-player-manager/src/lib/workspace-client.ts):

- reads via `loadWorkspaceSnapshot()`
- writes through resource-specific helpers such as `createPlayer()`, `updateScenarioAssignments()`, and `importWorkspaceSnapshot()`
- treats `409` as a retryable version conflict
- treats `503` as maintenance-mode freeze

## Related Docs

- [SCHEMA.md](./SCHEMA.md) — normalized table design
- [ARCHITECTURE.md](./ARCHITECTURE.md) — wider system context
- [SECURITY.md](./SECURITY.md) — auth boundary and request protection
- [RELIABILITY.md](./RELIABILITY.md) — optimistic concurrency and failure handling

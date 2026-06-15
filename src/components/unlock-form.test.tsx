import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let UnlockForm: typeof import("@/components/unlock-form").UnlockForm;

describe("UnlockForm", () => {
  const replaces: string[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    replaces.length = 0;

    mock.module("next/navigation", {
      namedExports: {
        useRouter() {
          return {
            replace(path: string) {
              replaces.push(path);
            },
            refresh() {},
          };
        },
      },
    });

    ({ UnlockForm } = await import("@/components/unlock-form"));
  });

  afterEach(() => {
    cleanup();
    mock.reset();
    globalThis.fetch = originalFetch;
    document.body.innerHTML = "";
  });

  it("returns to a valid panel destination after unlock", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
    const user = userEvent.setup();

    render(<UnlockForm nextPath="/panel/stats" />);
    await user.type(screen.getByLabelText("管理员口令"), "passcode");
    await user.click(screen.getByRole("button", { name: "进入比赛日控制台" }));

    assert.deepEqual(replaces, ["/panel/stats"]);
  });

  it("rejects an external return destination", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
    const user = userEvent.setup();

    render(<UnlockForm nextPath="https://example.com" />);
    await user.type(screen.getByLabelText("管理员口令"), "passcode");
    await user.click(screen.getByRole("button", { name: "进入比赛日控制台" }));

    assert.deepEqual(replaces, ["/panel"]);
  });

  it("shows an error for an invalid passcode", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;
    const user = userEvent.setup();

    render(<UnlockForm />);
    await user.type(screen.getByLabelText("管理员口令"), "wrong");
    await user.click(screen.getByRole("button", { name: "进入比赛日控制台" }));

    assert.ok(await screen.findByText("口令不正确"));
    assert.deepEqual(replaces, []);
  });
});

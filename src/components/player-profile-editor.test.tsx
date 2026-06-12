import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { PlayerProfileEditor, polarToCartesian, formatMetric } from "./player-profile-editor";
import type { Player } from "@/lib/workspace";

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "test-player-1",
    name: "测试球员",
    number: "42",
    bats: "R",
    throws: "R",
    positions: ["P"],
    status: "available",
    profile: {
      profileType: "pitcher",
      age: 25,
      heightCm: 185,
      weightKg: 85,
      thirtyMeterSec: null,
      fastballTopKmh: 150,
      fastballAvgKmh: 142,
      armStrengthM: null,
      games: [],
      pitchTypes: ["四缝线", "滑球"],
      scoutingSummary: "快速球有尾劲",
      radar: {
        pitcher: {
          velocity: 65,
          command: 55,
          movement: 50,
          stamina: 45,
          fielding: 40,
          mental: 60,
        },
        fielder: {
          contact: 60,
          power: 50,
          speed: 45,
          arm: 55,
          defense: 30,
          instinct: 25,
        },
      },
    },
    ...overrides,
  };
}

describe("PlayerProfileEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders empty state when player is null", () => {
    const onSave = async () => {};
    render(<PlayerProfileEditor player={null} variant="page" onSave={onSave} />);
    assert.ok(screen.getByText("球员不存在"));
    assert.ok(screen.getByText("当前链接没有对应球员，或该球员已从共享工作区移除。"));
  });

  it("renders player info when player exists", () => {
    const player = createTestPlayer();
    const onSave = async () => {};
    render(<PlayerProfileEditor player={player} variant="page" onSave={onSave} />);
    assert.ok(screen.getByText("测试球员"));
    assert.ok(screen.getByLabelText(/背号 42/));
    const statusElements = screen.getAllByText("可上场");
    assert.ok(statusElements.length >= 1);
  });

  it("updates name field on change", async () => {
    const player = createTestPlayer();
    const onSave = async () => {};
    render(<PlayerProfileEditor player={player} variant="page" onSave={onSave} />);

    const nameInput = screen.getByLabelText("姓名") as HTMLInputElement;
    assert.equal(nameInput.value, "测试球员");

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "新名字" } });
    });

    assert.equal(nameInput.value, "新名字");
  });

  it("toggles position checkboxes", async () => {
    const player = createTestPlayer({ positions: ["P", "SS"] });
    const onSave = async () => {};
    render(<PlayerProfileEditor player={player} variant="page" onSave={onSave} />);

    const cfCheckbox = screen.getByLabelText("CF") as HTMLInputElement;
    assert.equal(cfCheckbox.checked, false);

    await act(async () => {
      fireEvent.click(cfCheckbox);
    });

    assert.equal(cfCheckbox.checked, true);
  });

  it("calls onSave with correct data on form submit", async () => {
    const player = createTestPlayer();
    let savedPlayer: Player | null = null;
    const onSave = async (p: Player) => {
      savedPlayer = p;
    };

    render(<PlayerProfileEditor player={player} variant="page" onSave={onSave} />);

    const nameInput = screen.getByLabelText("姓名") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "更新的球员" } });
    });

    const submitButton = screen.getByText("保存球员档案");
    await act(async () => {
      fireEvent.click(submitButton);
    });

    const result = savedPlayer;
    if (!result) {
      throw new Error("onSave should have been called");
    }
    assert.equal((result as Player).name, "更新的球员");
    assert.equal((result as Player).id, "test-player-1");
  });

  it("shows validation error when name is empty", async () => {
    const player = createTestPlayer();
    const onSave = async () => {};
    render(<PlayerProfileEditor player={player} variant="page" onSave={onSave} />);

    const nameInput = screen.getByLabelText("姓名") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "" } });
    });

    const submitButton = screen.getByText("保存球员档案");
    await act(async () => {
      fireEvent.click(submitButton);
    });

    assert.ok(screen.getByText("姓名和背号不能为空"));
  });

  it("drawer variant: calls onClose on Escape key", async () => {
    const player = createTestPlayer();
    let closeCalled = false;
    const onClose = () => {
      closeCalled = true;
    };
    const onSave = async () => {};

    render(
      <PlayerProfileEditor player={player} variant="drawer" onSave={onSave} onClose={onClose} />,
    );

    const drawer = screen.getByRole("dialog");
    await act(async () => {
      fireEvent.keyDown(drawer, { key: "Escape" });
    });

    assert.equal(closeCalled, true);
  });

  it("drawer variant: calls onClose when backdrop is clicked", async () => {
    const player = createTestPlayer();
    let closeCalled = false;
    const onClose = () => {
      closeCalled = true;
    };
    const onSave = async () => {};

    const { container } = render(
      <PlayerProfileEditor player={player} variant="drawer" onSave={onSave} onClose={onClose} />,
    );

    const backdrop = container.querySelector('[class*="backdrop"]');
    assert.ok(backdrop);

    await act(async () => {
      fireEvent.click(backdrop!);
    });

    assert.equal(closeCalled, true);
  });

  it("page variant: renders back link and games link when backHref provided", () => {
    const player = createTestPlayer();
    const onSave = async () => {};
    render(
      <PlayerProfileEditor
        player={player}
        variant="page"
        onSave={onSave}
        backHref="/workspace"
      />,
    );

    const backLinks = screen.getAllByText("返回工作区");
    assert.ok(backLinks.length > 0);
    const gamesLink = screen.getByRole("link", { name: "查看比赛数据" });
    assert.equal(gamesLink.getAttribute("href"), "/players/test-player-1/games");
  });

  it("calls onOpenPage when '打开完整页面' button is clicked", async () => {
    const player = createTestPlayer();
    let openPageCalled = false;
    const onOpenPage = () => {
      openPageCalled = true;
    };
    const onSave = async () => {};

    render(
      <PlayerProfileEditor
        player={player}
        variant="drawer"
        onSave={onSave}
        onOpenPage={onOpenPage}
        onClose={() => {}}
      />,
    );

    const openPageButton = screen.getByText("打开完整页面");
    await act(async () => {
      fireEvent.click(openPageButton);
    });

    assert.equal(openPageCalled, true);
  });

  it("switches profile type between pitcher and fielder", async () => {
    const player = createTestPlayer();
    const onSave = async () => {};
    render(<PlayerProfileEditor player={player} variant="page" onSave={onSave} />);

    const profileTypeSelect = screen.getByLabelText("当前模型") as HTMLSelectElement;
    assert.equal(profileTypeSelect.value, "pitcher");

    await act(async () => {
      fireEvent.change(profileTypeSelect, { target: { value: "fielder" } });
    });

    assert.equal(profileTypeSelect.value, "fielder");
  });

  describe("polarToCartesian", () => {
    it("returns top-center for index 0 (12 o'clock)", () => {
      const result = polarToCartesian(150, 150, 100, 0, 6);
      assert.ok(Math.abs(result.x - 150) < 0.01, `x=${result.x} should be ~150`);
      assert.ok(result.y < 150, `y=${result.y} should be above center`);
      assert.ok(Math.abs(result.y - 50) < 0.01, `y=${result.y} should be ~50`);
    });

    it("returns rightmost for index at 1/4 total", () => {
      const result = polarToCartesian(150, 150, 100, 1, 4);
      assert.ok(result.x > 150, `x=${result.x} should be right of center`);
      assert.ok(Math.abs(result.y - 150) < 0.01, `y=${result.y} should be ~150`);
    });

    it("returns bottom-center for halfway point", () => {
      const result = polarToCartesian(150, 150, 100, 3, 6);
      assert.ok(Math.abs(result.x - 150) < 0.01, `x=${result.x} should be ~150`);
      assert.ok(result.y > 150, `y=${result.y} should be below center`);
    });

    it("scales radius correctly", () => {
      const r50 = polarToCartesian(0, 0, 50, 0, 6);
      const r100 = polarToCartesian(0, 0, 100, 0, 6);
      assert.ok(Math.abs(r100.y * 2 - r50.y * 4) < 0.01, "doubling radius doubles distance");
    });
  });

  describe("formatMetric", () => {
    it("returns dash-dash for null value", () => {
      assert.equal(formatMetric(null, "cm"), "--");
    });

    it("formats value with suffix", () => {
      assert.equal(formatMetric(185, "cm"), "185 cm");
    });
  });

  describe("RadarChart", () => {
    it("renders an SVG with 6-axis radar for a pitcher profile", () => {
      const player = createTestPlayer();
      render(<PlayerProfileEditor player={player} variant="page" onSave={async () => {}} />);

      const svg = screen.getByRole("img", { name: "球员六维能力图" });
      assert.equal(svg.tagName.toLowerCase(), "svg");
    });
  });
});

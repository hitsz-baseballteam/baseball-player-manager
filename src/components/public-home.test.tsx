import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";

let PublicHome: typeof import("@/components/public-home").PublicHome;

describe("PublicHome", () => {
  beforeEach(async () => {
    mock.module("next/image", {
      defaultExport: function MockImage(
        props: React.ImgHTMLAttributes<HTMLImageElement> & {
          fill?: boolean;
          priority?: boolean;
        },
      ) {
        const { fill, priority, ...imgProps } = props;
        void fill;
        void priority;
        return createElement("img", imgProps);
      },
    });

    ({ PublicHome } = await import("@/components/public-home"));
  });

  afterEach(() => {
    cleanup();
    mock.reset();
    document.body.innerHTML = "";
  });

  it("renders the public recruitment homepage without panel data", () => {
    render(<PublicHome />);

    assert.ok(screen.getByRole("heading", { name: /新生.*开球/ }));
    assert.ok(screen.getByText("下一球，等你上场"));
    assert.ok(screen.getByText("零基础友好"));
    assert.ok(screen.getAllByText("球队经理——陶YF").length >= 2);
    assert.ok(screen.getAllByText("微信 t90507002fyt").length >= 2);
    assert.equal(
      screen
        .getByRole("img", { name: "哈工大深圳棒球队队员赛前围圈" })
        .getAttribute("src"),
      "/team/team-huddle.jpg",
    );
    assert.equal(screen.getByRole("link", { name: "加入球队" }).getAttribute("href"), "#join");
    assert.ok(screen.getByRole("heading", { name: "来看看" }));
    assert.ok(screen.getByRole("heading", { name: "跟练一次" }));
    assert.ok(screen.getByRole("heading", { name: "正式入队" }));
    assert.equal(
      screen.getAllByRole("link", { name: /队员入口|队员控制台/ })[0]
        ?.getAttribute("href"),
      "/panel",
    );
    assert.equal(screen.queryByText("管理员口令"), null);
  });
});

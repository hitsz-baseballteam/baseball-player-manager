import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";

import { PUBLIC_SITE_CONTENT as content } from "@/lib/public-site-content";

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

  it("renders the public display homepage without panel data", () => {
    render(<PublicHome />);

    assert.ok(screen.getByRole("heading", { name: "哈工深小熊猫棒球队" }));
    assert.ok(screen.getByText("HITSZ Red Pandas Baseball Team"));
    assert.ok(screen.getByText("从零起步，向省赛进发。"));
    assert.ok(screen.getAllByText("2026.04").length >= 1);
    assert.ok(screen.getByText("20+"));
    assert.ok(screen.getAllByText("2026.05.30").length >= 1);
    assert.ok(screen.getByRole("heading", { name: "得物王牌棒球赛，第一次站上竞技赛场。" }));
    assert.ok(screen.getByRole("heading", { name: "人是球队最重要的内容。" }));
    assert.equal(screen.queryByText("球队经理——陶YF"), null);
    assert.equal(screen.queryByText("微信 t90507002fyt"), null);
    assert.equal(
      screen
        .getByRole("img", { name: "哈工深小熊猫棒球队队员望向球场" })
        .getAttribute("src"),
      "/team/team-fence.jpg",
    );
    assert.equal(
      screen
        .getByRole("img", { name: "哈工深小熊猫棒球队微信群二维码" })
        .getAttribute("src"),
      "/team/wechat-group-qr.jpg",
    );
    assert.equal(screen.getByRole("link", { name: /了解队史/ }).getAttribute("href"), "#history");
    assert.equal(screen.getByRole("link", { name: "查看首次出征" }).getAttribute("href"), "#match");
    assert.ok(screen.getByRole("button", { name: "比赛" }));
    assert.ok(screen.getByRole("tab", { name: /01.*拉伸/ }));
    assert.equal(
      screen.getAllByRole("link", { name: /队员入口|队员控制台/ })[0]
        ?.getAttribute("href"),
      "/panel",
    );
    assert.equal(screen.queryByText("管理员口令"), null);
  });

  it("renders navigation anchors for every major section", () => {
    render(<PublicHome />);

    for (const item of content.navigation) {
      const link = screen
        .getAllByRole("link", { name: item.label })
        .find((candidate) => candidate.getAttribute("href") === item.href);
      assert.ok(link, `expected navigation link ${item.label}`);
      assert.equal(link.getAttribute("href"), item.href);
    }

    assert.ok(document.getElementById("about"));
    assert.ok(document.getElementById("history"));
    assert.ok(document.getElementById("match"));
    assert.ok(document.getElementById("training"));
    assert.ok(document.getElementById("members"));
    assert.ok(document.getElementById("gallery"));
    assert.ok(document.getElementById("faq"));
    assert.ok(document.getElementById("join"));
  });

  it("renders structured training information", () => {
    render(<PublicHome />);

    assert.ok(screen.getByText(content.training.schedule));
    assert.ok(screen.getByText(content.training.location));
    assert.ok(screen.getByText(content.training.whatToBring.join("、")));
    assert.ok(screen.getByText(content.training.whatWeProvide.join("、")));
    assert.ok(screen.getByText(content.training.note));
  });

  it("renders FAQ entries with accessible disclosure widgets", () => {
    render(<PublicHome />);

    for (const item of content.faq) {
      const details = screen.getByText(item.question).closest("details");
      assert.ok(details, `expected ${item.question} to be inside <details>`);
      assert.ok(details?.querySelector("summary"));
      assert.ok(screen.getByText(item.answer));
    }
  });

  it("renders contact channels without exposing personal info", () => {
    render(<PublicHome />);

    const emailContact = content.contacts.find((c) => c.type === "email");
    assert.ok(emailContact);
    const emailLink = screen.getByRole("link", { name: emailContact.value });
    assert.equal(emailLink.getAttribute("href"), emailContact.href);

    const forbidden = /手机|电话|微信号|微信：|^1[3-9]\d{9}$/;
    for (const contact of content.contacts) {
      assert.equal(
        forbidden.test(contact.value),
        false,
        `contact ${contact.label} may expose personal info`,
      );
    }
  });

  it("renders team history and awards", () => {
    render(<PublicHome />);

    assert.ok(screen.getByText(content.history.story));
    for (const award of content.history.awards) {
      assert.ok(screen.getByText(award));
    }
  });
});

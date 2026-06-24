import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_SITE_CONTENT } from "@/lib/public-site-content";

describe("PUBLIC_SITE_CONTENT", () => {
  it("has the expected navigation anchors", () => {
    const labels = PUBLIC_SITE_CONTENT.navigation.map((item) => item.label);
    assert.deepEqual(labels, [
      "认识球队",
      "训练日常",
      "球队历史",
      "常见问题",
      "加入我们",
    ]);
    assert.equal(
      PUBLIC_SITE_CONTENT.navigation.find((item) => item.label === "常见问题")?.href,
      "#faq",
    );
    assert.equal(
      PUBLIC_SITE_CONTENT.navigation.find((item) => item.label === "球队历史")?.href,
      "#history",
    );
  });

  it("has structured training information", () => {
    const { training } = PUBLIC_SITE_CONTENT;
    assert.ok(training.schedule.length > 0);
    assert.ok(training.location.length > 0);
    assert.ok(training.whatToBring.length > 0);
    assert.ok(training.whatWeProvide.length > 0);
    assert.ok(training.note.length > 0);
  });

  it("has at least one contact channel per type", () => {
    const hasWechat = PUBLIC_SITE_CONTENT.contacts.some((c) => c.type === "wechat-group");
    const hasEmail = PUBLIC_SITE_CONTENT.contacts.some((c) => c.type === "email");
    assert.ok(hasWechat, "expected a wechat-group contact");
    assert.ok(hasEmail, "expected an email contact");
  });

  it("exposes no personal phone or wechat id in contacts", () => {
    const forbidden = /手机|电话|微信号|微信：|^1[3-9]\d{9}$/;
    for (const contact of PUBLIC_SITE_CONTENT.contacts) {
      assert.equal(
        forbidden.test(contact.value),
        false,
        `contact ${contact.label} may expose personal info: ${contact.value}`,
      );
    }
  });

  it("has faq entries with questions and answers", () => {
    assert.ok(PUBLIC_SITE_CONTENT.faq.length >= 6);
    for (const item of PUBLIC_SITE_CONTENT.faq) {
      assert.ok(item.question.length > 0);
      assert.ok(item.answer.length > 0);
    }
  });

  it("has team history with story and awards", () => {
    assert.ok(PUBLIC_SITE_CONTENT.history.story.length > 0);
    assert.ok(PUBLIC_SITE_CONTENT.history.awards.length > 0);
  });
});

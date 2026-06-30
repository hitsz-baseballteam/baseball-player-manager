import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_SITE_CONTENT } from "@/lib/public-site-content";

describe("PUBLIC_SITE_CONTENT", () => {
  it("has the expected navigation anchors", () => {
    const labels = PUBLIC_SITE_CONTENT.navigation.map((item) => item.label);
    assert.deepEqual(labels, [
      "认识球队",
      "队史",
      "首战",
      "训练",
      "成员",
      "相册",
      "加入我们",
    ]);
    assert.equal(
      PUBLIC_SITE_CONTENT.navigation.find((item) => item.label === "相册")?.href,
      "#gallery",
    );
    assert.equal(
      PUBLIC_SITE_CONTENT.navigation.find((item) => item.label === "队史")?.href,
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

  it("publishes the complete homepage jersey-number wall", () => {
    assert.equal(PUBLIC_SITE_CONTENT.members.length, 30);
    assert.deepEqual(
      PUBLIC_SITE_CONTENT.members.map((member) => [member.name, member.number, member.nickname]),
      [
        ["范张晨", "81", "FAN"],
        ["林承业", "27", "AYE"],
        ["王薪源", "32", "YUAN"],
        ["鲍亦青", "2", "BOB"],
        ["陈家辉", "6", "Frank"],
        ["程思远", "42", "Arcsin"],
        ["赵伯豪", "88", "ZHAO"],
        ["陈菲娅", "7", "BanBan"],
        ["李雨杭", "15", "Apostle"],
        ["姚智宇", "44", "HuaLIN"],
        ["周轩", "91", "Jiang"],
        ["刘渝川", "8", "LYC"],
        ["王婵", "3", "Chan"],
        ["王哲鹏", "24", "Jim"],
        ["向子鑫", "11", "Zachary"],
        ["陶怡帆", "59", "MIZUKI"],
        ["贾云博", "10", "Safridi"],
        ["丁舒杰", "31", "D.SHUJIE"],
        ["朱兆磊", "13", "ZZL"],
        ["Jonathan Fenly", "26", "Autumn"],
        ["常悦", "45", "Chang Yue"],
        ["周承臻", "77", "S"],
        ["王翰林", "75", "Tiamo"],
        ["郑海冰", "66", "ZHB"],
        ["韦语丝", "22", "CLAW"],
        ["jorge", "33", "holuhe"],
        ["陈靖韡", "30", "Venokos"],
        ["Thabang Mathaba", "99", "高兴"],
        ["徐玙航", "12", "YUAN"],
        ["Loki", "9", "LOKI"],
      ],
    );
  });
});

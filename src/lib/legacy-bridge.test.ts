import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { createLegacyBridge } from "@/lib/legacy-bridge";

describe("legacy bridge", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("triggers legacy controls and focuses the requested panel", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button id="exportWorkspaceBtn" type="button">导出工作区</button>
      <section id="scenarioPanel">scenario panel</section>
    `;
    document.body.appendChild(root);

    const clicks: string[] = [];
    root.querySelector("#exportWorkspaceBtn")?.addEventListener("click", () => {
      clicks.push("export");
    });

    const bridge = createLegacyBridge({ root });
    const triggered = bridge.trigger("#exportWorkspaceBtn", { focusSelector: "#scenarioPanel" });

    assert.equal(triggered, true);
    assert.deepEqual(clicks, ["export"]);
    assert.ok(root.querySelector("#scenarioPanel")?.classList.contains("bridge-focus"));
  });

  it("changes legacy select values and dispatches change events", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <select id="scenarioSelect">
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
      <section id="scenarioPanel">scenario panel</section>
    `;
    document.body.appendChild(root);

    const values: string[] = [];
    const select = root.querySelector<HTMLSelectElement>("#scenarioSelect");
    assert.ok(select);
    select.addEventListener("change", () => {
      values.push(select.value);
    });

    const bridge = createLegacyBridge({ root });
    const changed = bridge.changeSelect("#scenarioSelect", "b", { focusSelector: "#scenarioPanel" });

    assert.equal(changed, true);
    assert.equal(select.value, "b");
    assert.deepEqual(values, ["b"]);
    assert.ok(root.querySelector("#scenarioPanel")?.classList.contains("bridge-focus"));
  });
});

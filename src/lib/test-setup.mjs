import { JSDOM } from "jsdom";
import { register } from "node:module";

// Register CSS module mock loader before component tests import CSS modules.
register("./test-css-loader.mjs", import.meta.url);

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost",
});

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

defineGlobal("window", dom.window);
defineGlobal("document", dom.window.document);
defineGlobal("navigator", dom.window.navigator);
defineGlobal("HTMLElement", dom.window.HTMLElement);
defineGlobal("HTMLButtonElement", dom.window.HTMLButtonElement);
defineGlobal("HTMLSelectElement", dom.window.HTMLSelectElement);
defineGlobal("HTMLInputElement", dom.window.HTMLInputElement);
defineGlobal("HTMLTextAreaElement", dom.window.HTMLTextAreaElement);
defineGlobal("HTMLOptionElement", dom.window.HTMLOptionElement);
defineGlobal("HTMLDialogElement", dom.window.HTMLDialogElement);
defineGlobal("Event", dom.window.Event);
defineGlobal("MouseEvent", dom.window.MouseEvent);
defineGlobal("KeyboardEvent", dom.window.KeyboardEvent);
defineGlobal("CustomEvent", dom.window.CustomEvent);
defineGlobal("Storage", dom.window.Storage);
defineGlobal("localStorage", dom.window.localStorage);
defineGlobal("getComputedStyle", dom.window.getComputedStyle);
defineGlobal("requestAnimationFrame", (cb) => setTimeout(cb, 0));
defineGlobal("cancelAnimationFrame", (id) => clearTimeout(id));
defineGlobal("self", dom.window);
defineGlobal("ResizeObserver", class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});
defineGlobal("matchMedia", () => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

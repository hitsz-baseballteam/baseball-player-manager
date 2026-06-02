const { JSDOM } = require("jsdom");
const { register } = require("node:module");
const { pathToFileURL } = require("node:url");

// Register CSS module mock loader
register("./test-css-loader.mjs", pathToFileURL(__filename));

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost",
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLButtonElement = dom.window.HTMLButtonElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLOptionElement = dom.window.HTMLOptionElement;
global.HTMLDialogElement = dom.window.HTMLDialogElement;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.CustomEvent = dom.window.CustomEvent;
global.Storage = dom.window.Storage;
global.localStorage = dom.window.localStorage;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.self = dom.window;
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
global.matchMedia = () => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

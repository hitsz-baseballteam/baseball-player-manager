import { readFileSync } from "node:fs";
import path from "node:path";

type LegacyTemplate = {
  markup: string;
  styles: string;
};

let cachedTemplate: LegacyTemplate | null = null;

export function getLegacyTemplate(): LegacyTemplate {
  if (cachedTemplate) {
    return cachedTemplate;
  }

  const source = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const styleMatch = source.match(/<style>([\s\S]*?)<\/style>/i);
  const bodyMatch = source.match(/<body>([\s\S]*?)<script>/i);

  if (!styleMatch || !bodyMatch) {
    throw new Error("Unable to extract legacy template from index.html");
  }

  cachedTemplate = {
    styles: styleMatch[1].trim(),
    markup: bodyMatch[1].trim(),
  };

  return cachedTemplate;
}

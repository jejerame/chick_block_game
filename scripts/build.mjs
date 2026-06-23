import { transformFileAsync } from "@babel/core";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "dist");

const FILES = [
  "ios-frame.jsx",
  "tweaks-panel.jsx",
  "game-data.jsx",
  "block-sfx.jsx",
  "components.jsx",
  "screens.jsx",
  "app.jsx",
];

await mkdir(OUT, { recursive: true });

const parts = [];
for (const file of FILES) {
  const result = await transformFileAsync(path.join(ROOT, file), {
    presets: ["@babel/preset-react"],
    filename: file,
  });
  const outName = file.replace(/\.jsx$/, ".js");
  await writeFile(path.join(OUT, outName), result.code, "utf8");
  parts.push(result.code);
  console.log("built", outName);
}

const bundle = parts.join("\n;\n");
await writeFile(path.join(OUT, "chick.bundle.js"), bundle, "utf8");
console.log("built chick.bundle.js");
console.log("done:", FILES.length, "files → dist/");

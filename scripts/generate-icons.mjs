import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "icons");
const sourceIcon = join(iconsDir, "grokipedia-redirect.png");

mkdirSync(iconsDir, { recursive: true });

if (!existsSync(sourceIcon)) {
  console.error(`Source icon not found: ${sourceIcon}`);
  process.exit(1);
}

for (const size of [16, 48, 128]) {
  const output = join(iconsDir, `icon${size}.png`);
  const result = spawnSync(
    "sips",
    ["-z", String(size), String(size), sourceIcon, "--out", output],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Icons generated from icons/grokipedia-redirect.png");
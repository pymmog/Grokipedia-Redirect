import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const iconsDir = join(root, "icons");
const sourceIcon = join(iconsDir, "grokipedia-redirect.png");
const artSource = join(iconsDir, ".source-backup.png");
const processor = join(__dirname, "process-toolbar-icons.swift");

mkdirSync(iconsDir, { recursive: true });

if (!existsSync(artSource)) {
  if (!existsSync(sourceIcon)) {
    console.error(`Source icon not found: ${sourceIcon}`);
    process.exit(1);
  }
  copyFileSync(sourceIcon, artSource);
}

const result = spawnSync("swift", [processor, artSource, iconsDir], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Icons generated (active + muted -off variants)");

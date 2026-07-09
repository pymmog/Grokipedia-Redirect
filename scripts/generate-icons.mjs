import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "icons");
const sourceIcon = join(iconsDir, "grokipedia-redirect.png");
const sizes = [16, 48, 128];

mkdirSync(iconsDir, { recursive: true });

if (!existsSync(sourceIcon)) {
  console.error(`Source icon not found: ${sourceIcon}`);
  process.exit(1);
}

function trySips(size, output) {
  const result = spawnSync(
    "sips",
    ["-z", String(size), String(size), sourceIcon, "--out", output],
    { stdio: "ignore" }
  );
  return result.status === 0 && existsSync(output);
}

function tryMagick(size, output) {
  for (const bin of ["magick", "convert"]) {
    const result = spawnSync(
      bin,
      [sourceIcon, "-resize", `${size}x${size}`, output],
      { stdio: "ignore" }
    );
    if (result.status === 0 && existsSync(output)) {
      return true;
    }
  }
  return false;
}

let usedFallback = false;

for (const size of sizes) {
  const output = join(iconsDir, `icon${size}.png`);
  if (trySips(size, output) || tryMagick(size, output)) {
    continue;
  }

  writeFileSync(output, readFileSync(sourceIcon));
  usedFallback = true;
  console.warn(
    `No image resizer found (sips/ImageMagick). Copied source to ${output}.`
  );
}

if (usedFallback) {
  console.warn("Install ImageMagick (`magick`) for properly sized toolbar icons.");
}

console.log("Icons generated from icons/grokipedia-redirect.png");

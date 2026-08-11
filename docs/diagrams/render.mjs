import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mmd"));
const mmdc = path.join(process.cwd(), "frontend", "node_modules", ".bin", "mmdc.cmd");

for (const f of files) {
  const input = path.join(dir, f);
  const output = path.join(dir, f.replace(/\.mmd$/, ".png"));
  console.log("render", f);
  execFileSync(
    "npx",
    ["-y", "@mermaid-js/mermaid-cli@11", "-i", input, "-o", output, "-b", "white", "-s", "2"],
    { stdio: "inherit", shell: true },
  );
}

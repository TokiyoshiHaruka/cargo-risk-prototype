import { readFile, stat, readdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];
const forbidden = new Set(["node_modules", "dist", "test-results", "playwright-report"]);
const secret = /BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}/;
const absolutePath = /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]/;

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (forbidden.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && (await stat(path)).size < 1_000_000) {
      if ([".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".md"].includes(extname(path))) {
        const relativePath = relative(root, path);
        const text = await readFile(path, "utf8");
        if (secret.test(text)) failures.push(`secret:${relativePath}`);
        if (absolutePath.test(text) && !path.endsWith("check_repo.mjs")) failures.push(`absolute-path:${relativePath}`);
        if (relativePath.startsWith("src\\") && text.includes("innerHTML")) failures.push(`unsafe-html:${relativePath}`);
      }
    }
  }
}

await walk(root);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("repository hygiene: OK");

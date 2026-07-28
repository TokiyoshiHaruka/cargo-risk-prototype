import { execFile } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";


const modulePath = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const execFileAsync = promisify(execFile);
const textLimitBytes = 1_000_000;
const requiredFiles = [
  ".gitignore",
  "AI_USAGE.md",
  "LICENSE",
  "NOTICE.md",
  "README.md",
  "package-lock.json",
  "package.json",
];
const generatedDirectories = new Map([
  ["node_modules", "node_modules/"],
  ["dist", "dist/"],
  ["test-results", "test-results/"],
  ["playwright-report", "playwright-report/"],
  ["evidence", "evidence/"],
]);
const requiredIgnores = [...generatedDirectories.values(), ".tmp/"];
const webSourceSuffixes = new Set([".cjs", ".html", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const generatedDataSuffixes = new Set([".csv", ".json", ".ndjson"]);
const secret = /BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/;
const windowsAbsolutePath = /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]/m;
const posixHomePath = /(?:^|[\s'"`=:(\[{])\/(?:Users|home)\//im;
const unsafeHtml = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/;


export function normalizeRelativePath(path) {
  return path.replaceAll("\\", "/");
}


export function containsUnsafeHtml(relativePath, text) {
  const normalized = normalizeRelativePath(relativePath);
  return (
    normalized.startsWith("src/") &&
    webSourceSuffixes.has(extname(normalized).toLowerCase()) &&
    unsafeHtml.test(text)
  );
}


async function readText(path) {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch {
    return { error: "unreadable" };
  }
  if (!metadata.isFile()) return { error: "unsupported-file-type" };
  if (metadata.size > textLimitBytes) return { error: "oversized-file" };
  try {
    const bytes = await readFile(path);
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch (error) {
    if (error instanceof TypeError) return { error: "non-utf8" };
    return { error: "unreadable" };
  }
}


async function trackedGeneratedFiles(repositoryRoot) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repositoryRoot, "ls-files", "-z"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return stdout
      .split("\0")
      .filter(Boolean)
      .map(normalizeRelativePath)
      .filter((path) => path.split("/").some((part) => generatedDirectories.has(part.toLowerCase())));
  } catch {
    return null;
  }
}


export async function scanRepository(repositoryRoot, { checkGitIndex = false } = {}) {
  const resolvedRoot = resolve(repositoryRoot);
  const failures = [];

  for (const required of requiredFiles) {
    try {
      const metadata = await lstat(join(resolvedRoot, required));
      if (!metadata.isFile() || metadata.isSymbolicLink()) failures.push(`invalid-required-file:${required}`);
    } catch {
      failures.push(`missing:${required}`);
    }
  }

  let ignored = new Set();
  try {
    const ignoreText = await readFile(join(resolvedRoot, ".gitignore"), "utf8");
    ignored = new Set(
      ignoreText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")),
    );
  } catch {
    // The required-file failure above carries the missing boundary.
  }
  for (const required of requiredIgnores) {
    if (!ignored.has(required)) failures.push(`missing-ignore:${required}`);
  }

  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      failures.push(`unreadable:${normalizeRelativePath(relative(resolvedRoot, directory)) || "."}`);
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const relativePath = normalizeRelativePath(relative(resolvedRoot, path));
      const firstPart = relativePath.split("/", 1)[0].toLowerCase();
      if (firstPart === ".git") continue;

      let metadata;
      try {
        metadata = await lstat(path);
      } catch {
        failures.push(`unreadable:${relativePath}`);
        continue;
      }
      if (metadata.isSymbolicLink()) {
        failures.push(`reparse-point:${relativePath}`);
        continue;
      }
      if (metadata.isDirectory()) {
        if (relativePath.toLowerCase() === ".tmp") {
          try {
            if ((await readdir(path)).length > 0) failures.push(`temporary-output:${relativePath}`);
          } catch {
            failures.push(`unreadable:${relativePath}`);
          }
          continue;
        }
        if (generatedDirectories.has(entry.name.toLowerCase())) continue;
        await walk(path);
        continue;
      }
      if (!metadata.isFile()) {
        failures.push(`unsupported-file-type:${relativePath}`);
        continue;
      }

      const lowerName = entry.name.toLowerCase();
      if (lowerName === ".env" || (lowerName.startsWith(".env.") && lowerName !== ".env.example")) {
        failures.push(`forbidden-env:${relativePath}`);
      }

      const result = await readText(path);
      if (result.error) {
        failures.push(`${result.error}:${relativePath}`);
        continue;
      }
      const text = result.text ?? "";
      if (secret.test(text)) failures.push(`secret:${relativePath}`);
      if (windowsAbsolutePath.test(text) || posixHomePath.test(text)) {
        failures.push(`absolute-path:${relativePath}`);
      }
      if (containsUnsafeHtml(relativePath, text)) failures.push(`unsafe-html:${relativePath}`);
      if (
        relativePath.startsWith("src/") &&
        generatedDataSuffixes.has(extname(relativePath).toLowerCase())
      ) {
        failures.push(`generated-report:${relativePath}`);
      }
    }
  }

  await walk(resolvedRoot);

  if (checkGitIndex) {
    const tracked = await trackedGeneratedFiles(resolvedRoot);
    if (tracked === null) failures.push("git-index-unavailable");
    else for (const path of tracked) failures.push(`tracked-generated:${path}`);
  }

  return [...new Set(failures)].sort();
}


function samePath(left, right) {
  const normalize = (path) => (process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path));
  return normalize(left) === normalize(right);
}


if (process.argv[1] && samePath(process.argv[1], modulePath)) {
  const failures = await scanRepository(root, { checkGitIndex: true });
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("repository hygiene: OK");
  }
}

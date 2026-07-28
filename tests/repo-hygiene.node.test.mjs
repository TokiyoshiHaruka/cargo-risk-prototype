import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { containsUnsafeHtml, scanRepository } from "../scripts/check_repo.mjs";


const requiredIgnores = [
  "node_modules/",
  "dist/",
  "test-results/",
  "playwright-report/",
  "evidence/",
  ".tmp/",
];
const execFileAsync = promisify(execFile);


async function createValidRepository(root) {
  const files = {
    ".gitignore": `${requiredIgnores.join("\n")}\n`,
    "AI_USAGE.md": "# AI usage\n\nHuman reviewed.\n",
    "LICENSE": "MIT\n",
    "NOTICE.md": "# Notices\n\nOriginal prototype.\n",
    "README.md": "# Cargo Risk\n\n## Run\n\nCommand.\n",
    "package-lock.json": '{"lockfileVersion":3}\n',
    "package.json": '{"name":"fixture","private":true}\n',
    "src/main.ts": "document.body.textContent = 'safe';\n",
  };
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
}


async function withRepository(run) {
  const base = process.platform === "win32" ? join(process.cwd(), ".tmp") : tmpdir();
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "cargo-hygiene-"));
  try {
    await createValidRepository(root);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}


test("unsafe HTML detection accepts both path separators", () => {
  const source = "node.innerHTML = value;";
  assert.equal(containsUnsafeHtml("src/ui.ts", source), true);
  assert.equal(containsUnsafeHtml("src\\ui.ts", source), true);
  assert.equal(containsUnsafeHtml("tests/ui.ts", source), false);
});


test("scanner reads JSON and rejects environment files", async () => {
  await withRepository(async (root) => {
    const token = "ghp_" + "A".repeat(24);
    await writeFile(join(root, "config.json"), `{"token":"${token}"}\n`, "utf8");
    await writeFile(join(root, ".env"), "PRIVATE_VALUE=present\n", "utf8");
    const failures = await scanRepository(root);
    assert.ok(failures.includes("secret:config.json"));
    assert.ok(failures.includes("forbidden-env:.env"));
  });
});


test("scanner distinguishes HTTPS URLs from local paths", async () => {
  await withRepository(async (root) => {
    await writeFile(join(root, "NOTICE.md"), "Terms: https://example.test/home/index\n", "utf8");
    assert.deepEqual(await scanRepository(root), []);

    const localPath = String.fromCharCode(67) + ":" + "/" + "Users" + "/private";
    await writeFile(join(root, "local-path.txt"), localPath, "utf8");
    assert.ok((await scanRepository(root)).includes("absolute-path:local-path.txt"));
  });
});


test("generated directories require explicit ignore boundaries", async () => {
  await withRepository(async (root) => {
    await mkdir(join(root, "dist"));
    assert.deepEqual(await scanRepository(root), []);
    const incomplete = requiredIgnores.filter((entry) => entry !== "dist/");
    await writeFile(join(root, ".gitignore"), `${incomplete.join("\n")}\n`, "utf8");
    assert.ok((await scanRepository(root)).includes("missing-ignore:dist/"));
  });
});


test("Git index check rejects force-added generated output", async () => {
  await withRepository(async (root) => {
    await mkdir(join(root, "dist"));
    await writeFile(join(root, "dist/leak.json"), "{}\n", "utf8");
    await execFileAsync("git", ["-C", root, "init", "--quiet"]);
    await execFileAsync("git", ["-C", root, "add", "-f", "dist/leak.json"]);
    const failures = await scanRepository(root, { checkGitIndex: true });
    assert.ok(failures.includes("tracked-generated:dist/leak.json"));
  });
});

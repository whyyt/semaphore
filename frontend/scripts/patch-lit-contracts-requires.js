import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "node_modules");
const TARGET_BASENAME = "mappers.js";
const TARGET_SEGMENT = path.join("@lit-protocol", "constants", "src", "lib", "constants", TARGET_BASENAME);

const ORIGINAL_SNIPPET = `const datil_js_1 = require("@lit-protocol/contracts/prod/datil.js");
// @ts-ignore -- see note above.
const datil_dev_js_1 = require("@lit-protocol/contracts/prod/datil-dev.js");
// @ts-ignore -- see note above.
const datil_test_js_1 = require("@lit-protocol/contracts/prod/datil-test.js");
const datil = datil_js_1.datil;
const datilDev = datil_dev_js_1.datilDev;
const datilTest = datil_test_js_1.datilTest;`;

const INTERMEDIATE_SNIPPET = `const datil = require("@lit-protocol/contracts/prod/datil");
// @ts-ignore -- see note above.
const datilDev = require("@lit-protocol/contracts/prod/datil-dev");
// @ts-ignore -- see note above.
const datilTest = require("@lit-protocol/contracts/prod/datil-test");`;

const PATCHED_SNIPPET = `const { datil, datilDev, datilTest } = require("@lit-protocol/contracts");`;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath)));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

async function patchFile(filePath) {
  const source = await readFile(filePath, "utf8");

  if (source.includes(PATCHED_SNIPPET)) {
    return false;
  }

  let nextSource = source;

  if (nextSource.includes(ORIGINAL_SNIPPET)) {
    nextSource = nextSource.replace(ORIGINAL_SNIPPET, PATCHED_SNIPPET);
  }

  if (nextSource.includes(INTERMEDIATE_SNIPPET)) {
    nextSource = nextSource.replace(INTERMEDIATE_SNIPPET, PATCHED_SNIPPET);
  }

  if (nextSource === source) {
    return false;
  }

  await writeFile(filePath, nextSource, "utf8");
  return true;
}

async function main() {
  const files = await walk(ROOT);
  const targets = files.filter((filePath) => filePath.endsWith(TARGET_SEGMENT));
  let patchedCount = 0;

  for (const filePath of targets) {
    if (await patchFile(filePath)) {
      patchedCount += 1;
    }
  }

  console.log(`[patch-lit-contracts-requires] patched ${patchedCount} file(s)`);
}

main().catch((error) => {
  console.error("[patch-lit-contracts-requires] failed", error);
  process.exitCode = 1;
});

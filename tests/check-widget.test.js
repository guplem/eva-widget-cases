// The contract check of scripts/check-widget.js, on a copy of this widget with one change.
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { checkWidget } from "../scripts/check-widget.js";

const widget = fileURLToPath(new URL("..", import.meta.url));
const copies = [];

after(async () => {
  await Promise.all(copies.map((folder) => rm(folder, { recursive: true, force: true })));
});

/** A copy of the widget files that the check reads, with `change` applied to the manifest. */
async function copyWith(change) {
  const folder = await mkdtemp(join(tmpdir(), "widget-"));
  copies.push(folder);
  for (const path of ["eva-widget.json", "config.json"]) await cp(join(widget, path), join(folder, path));
  const path = join(folder, "eva-widget.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  change(manifest);
  await writeFile(path, JSON.stringify(manifest));
  return folder;
}

test("the widget follows the contract", async () => {
  assert.deepEqual(await checkWidget(widget), []);
});

test("an unknown size fails", async () => {
  const folder = await copyWith((manifest) => {
    manifest.size = "huge";
  });
  assert.match((await checkWidget(folder))[0], /\/size/);
});

test("the cases input takes no access: it only reads", async () => {
  const folder = await copyWith((manifest) => {
    manifest.inputs[0].access = "write";
  });
  assert.notDeepEqual(await checkWidget(folder), []);
});

test("the cases input takes no default", async () => {
  const folder = await copyWith((manifest) => {
    manifest.inputs[0].default = "Life/Cases";
  });
  assert.notDeepEqual(await checkWidget(folder), []);
});

test("a key of config.json that is no input fails", async () => {
  const folder = await copyWith(() => {});
  await writeFile(join(folder, "config.json"), JSON.stringify({ title: "Cases" }));
  assert.deepEqual(await checkWidget(folder), ['config.json: "title" is not an input.']);
});

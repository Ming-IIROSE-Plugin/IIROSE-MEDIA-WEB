import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluate, LIMITS } from "./check-bundle-size.mjs";

test("正好等于上限时通过", () => {
  const result = evaluate({ size: LIMITS.size, gzip: LIMITS.gzip });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test("体积超出 1 字节即失败，并指出是哪一项", () => {
  const result = evaluate({ size: LIMITS.size + 1, gzip: LIMITS.gzip - 1 });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /bundle/);
  assert.doesNotMatch(result.problems.join(" "), /gzip/);
});

test("gzip 超限同样失败", () => {
  const result = evaluate({ size: 1, gzip: LIMITS.gzip + 1 });
  assert.equal(result.ok, false);
  assert.match(result.problems.join(" "), /gzip/);
});

test("两项都超时两条都报", () => {
  const result = evaluate({ size: LIMITS.size + 1, gzip: LIMITS.gzip + 1 });
  assert.equal(result.problems.length, 2);
});

test("命令行：超限文件返回非零退出码并打印实测值", () => {
  const dir = mkdtempSync(join(tmpdir(), "imw-size-"));
  const file = join(dir, "bundle.js");
  writeFileSync(file, "x".repeat(LIMITS.size + 1));
  assert.throws(
    () =>
      execFileSync(process.execPath, ["scripts/check-bundle-size.mjs", file], {
        encoding: "utf8",
      }),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(String(error.stderr), /超限/);
      assert.match(String(error.stderr), /450/);
      return true;
    },
  );
});

test("命令行：达标文件正常退出", () => {
  const dir = mkdtempSync(join(tmpdir(), "imw-size-"));
  const file = join(dir, "bundle.js");
  writeFileSync(file, "x".repeat(1024));
  const output = execFileSync(
    process.execPath,
    ["scripts/check-bundle-size.mjs", file],
    { encoding: "utf8" },
  );
  assert.match(output, /bundle 1\.02kB/);
});

const assert = require("node:assert/strict");
const { mkdtemp, mkdir, readFile, rm, unlink, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  applyConfigDemoChange,
  applyUserServiceDemoChange,
  createDemoController,
} = require("./demo-flow");

const REPO_ROOT = path.resolve(__dirname, "..");

test("runDemo applies deterministic demo state from canonical fixtures", async (t) => {
  const fixture = await createFixtureRepo();
  t.after(() => rm(fixture.rootDir, { force: true, recursive: true }));

  await writeFile(
    path.join(fixture.rootDir, "db/config.yaml"),
    fixture.cleanConfig.replaceAll("scip-code.org", "example.com"),
    "utf8",
  );
  await writeFile(
    path.join(fixture.rootDir, "src/services/userService.ts"),
    `${fixture.cleanUserService}\n// local dirty change\n`,
    "utf8",
  );

  await fixture.controller.runDemo();

  assert.equal(
    await readFile(path.join(fixture.rootDir, "db/config.yaml"), "utf8"),
    fixture.demoConfig,
  );
  assert.equal(
    await readFile(path.join(fixture.rootDir, "src/services/userService.ts"), "utf8"),
    fixture.demoUserService,
  );
  assert.equal(
    await readFile(path.join(fixture.rootDir, "src/utils/debug.ts"), "utf8"),
    fixture.debugUtil,
  );
  assert.deepEqual(await fixture.controller.getStatus(), {
    configState: "demo",
    userServiceState: "demo",
    debugUtilState: "demo",
    overallState: "demo",
  });
});

test("resetDemo restores canonical clean state and removes debug util", async (t) => {
  const fixture = await createFixtureRepo();
  t.after(() => rm(fixture.rootDir, { force: true, recursive: true }));

  await fixture.controller.runDemo();
  await fixture.controller.resetDemo();

  assert.equal(
    await readFile(path.join(fixture.rootDir, "db/config.yaml"), "utf8"),
    fixture.cleanConfig,
  );
  assert.equal(
    await readFile(path.join(fixture.rootDir, "src/services/userService.ts"), "utf8"),
    fixture.cleanUserService,
  );
  await assert.rejects(readFile(path.join(fixture.rootDir, "src/utils/debug.ts"), "utf8"), {
    code: "ENOENT",
  });
  assert.deepEqual(await fixture.controller.getStatus(), {
    configState: "clean",
    userServiceState: "clean",
    debugUtilState: "clean",
    overallState: "clean",
  });
});

test("run reset run stays byte-for-byte stable", async (t) => {
  const fixture = await createFixtureRepo();
  t.after(() => rm(fixture.rootDir, { force: true, recursive: true }));

  await fixture.controller.runDemo();
  const firstRun = await readTrackedState(fixture.rootDir);

  await fixture.controller.resetDemo();
  await fixture.controller.runDemo();
  const secondRun = await readTrackedState(fixture.rootDir);

  assert.deepEqual(secondRun, firstRun);
});

test("runDemo fails fast when canonical config contains example values", async (t) => {
  const fixture = await createFixtureRepo();
  t.after(() => rm(fixture.rootDir, { force: true, recursive: true }));

  await writeFile(
    path.join(fixture.rootDir, "demo-changes/clean/config.yaml"),
    fixture.cleanConfig.replaceAll("scip-code.org", "example.com"),
    "utf8",
  );

  await assert.rejects(fixture.controller.runDemo(), /must not contain example\.com/);
});

test("status reports invalid for mixed workspace state", async (t) => {
  const fixture = await createFixtureRepo();
  t.after(() => rm(fixture.rootDir, { force: true, recursive: true }));

  await writeFile(path.join(fixture.rootDir, "db/config.yaml"), fixture.demoConfig, "utf8");
  await writeFile(path.join(fixture.rootDir, "src/services/userService.ts"), fixture.cleanUserService, "utf8");
  await unlink(path.join(fixture.rootDir, "src/utils/debug.ts")).catch(() => {});

  assert.deepEqual(await fixture.controller.getStatus(), {
    configState: "demo",
    userServiceState: "clean",
    debugUtilState: "clean",
    overallState: "invalid",
  });
});

async function createFixtureRepo() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "code-monitors-demo-"));
  const cleanConfig = await readRepoFile("demo-changes/clean/config.yaml");
  const cleanUserService = await readRepoFile("demo-changes/clean/userService.ts");
  const debugUtil = await readRepoFile("demo-changes/02-debug-util.ts");
  const demoConfig = applyConfigDemoChange(cleanConfig);
  const demoUserService = applyUserServiceDemoChange(cleanUserService);

  await Promise.all([
    mkdir(path.join(rootDir, "db"), { recursive: true }),
    mkdir(path.join(rootDir, "src/services"), { recursive: true }),
    mkdir(path.join(rootDir, "demo-changes/clean"), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(path.join(rootDir, "db/config.yaml"), cleanConfig, "utf8"),
    writeFile(path.join(rootDir, "src/services/userService.ts"), cleanUserService, "utf8"),
    writeFile(path.join(rootDir, "demo-changes/clean/config.yaml"), cleanConfig, "utf8"),
    writeFile(path.join(rootDir, "demo-changes/clean/userService.ts"), cleanUserService, "utf8"),
    writeFile(path.join(rootDir, "demo-changes/02-debug-util.ts"), debugUtil, "utf8"),
  ]);

  const controller = createDemoController(rootDir, { log() {} });
  return { cleanConfig, cleanUserService, controller, debugUtil, demoConfig, demoUserService, rootDir };
}

async function readTrackedState(rootDir) {
  return Promise.all([
    readFile(path.join(rootDir, "db/config.yaml"), "utf8"),
    readFile(path.join(rootDir, "src/services/userService.ts"), "utf8"),
    readFile(path.join(rootDir, "src/utils/debug.ts"), "utf8"),
  ]);
}

async function readRepoFile(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}

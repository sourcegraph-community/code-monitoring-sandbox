const { mkdir, readFile, stat, unlink, writeFile } = require("node:fs/promises");
const path = require("node:path");
const YAML = require("yaml");

const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG_PATH = "db/config.yaml";
const USER_SERVICE_PATH = "src/services/userService.ts";
const DEBUG_UTIL_PATH = "src/utils/debug.ts";
const CLEAN_CONFIG_SOURCE_PATH = "demo-changes/clean/config.yaml";
const CLEAN_USER_SERVICE_SOURCE_PATH = "demo-changes/clean/userService.ts";
const DEBUG_SOURCE_PATH = "demo-changes/02-debug-util.ts";

const CLEAN_PRIMARY_HOST = "db-primary.internal.scip-code.org";
const DEMO_PRIMARY_HOST = "db-staging.internal.scip-code.org";
const CLEAN_MAX_CONNECTIONS = 25;
const DEMO_MAX_CONNECTIONS = 100;
const FORBIDDEN_BASELINE_TOKENS = ["example.com", "example-backups"];
const DEBUG_IMPORT_LINE = 'import { logSensitiveData } from "../utils/debug";';
const QUERY_LINE = '  const user = await db.query("SELECT * FROM users WHERE id = $1", [id]);';
const LOG_LINE = "  logSensitiveData(user.rows[0]);";

async function main() {
  const controller = createDemoController(ROOT_DIR);
  const command = process.argv[2];

  switch (command) {
    case "run":
      await controller.runDemo();
      return;
    case "reset":
      await controller.resetDemo();
      return;
    case "status":
      await controller.printStatus();
      return;
    default:
      console.error("Usage: npm run demo -- <run|reset|status>");
      process.exitCode = 1;
  }
}

function createDemoController(rootDir, io = console) {
  async function runDemo() {
    const cleanState = await loadCleanState(rootDir);
    const demoState = createDemoState(cleanState);

    await Promise.all([
      writeWorkspaceFile(rootDir, CONFIG_PATH, demoState.config),
      writeWorkspaceFile(rootDir, USER_SERVICE_PATH, demoState.userService),
      writeWorkspaceFile(rootDir, DEBUG_UTIL_PATH, demoState.debugUtil),
    ]);

    io.log("Demo flow applied deterministically.");
    io.log(`- Updated \`${CONFIG_PATH}\``);
    io.log(`- Updated \`${USER_SERVICE_PATH}\``);
    io.log(`- Created \`${DEBUG_UTIL_PATH}\``);
  }

  async function resetDemo() {
    const cleanState = await loadCleanState(rootDir);

    await Promise.all([
      writeWorkspaceFile(rootDir, CONFIG_PATH, cleanState.config),
      writeWorkspaceFile(rootDir, USER_SERVICE_PATH, cleanState.userService),
      deleteWorkspaceFile(rootDir, DEBUG_UTIL_PATH),
    ]);

    io.log("Demo files restored to the canonical clean state.");
  }

  async function getStatus() {
    const cleanState = await loadCleanState(rootDir);
    const demoState = createDemoState(cleanState);
    const [config, userService, debugUtilExists, debugUtil] = await Promise.all([
      readWorkspaceFile(rootDir, CONFIG_PATH),
      readWorkspaceFile(rootDir, USER_SERVICE_PATH),
      pathExists(workspacePath(rootDir, DEBUG_UTIL_PATH)),
      readOptionalWorkspaceFile(rootDir, DEBUG_UTIL_PATH),
    ]);

    const configState = classifyState(config, cleanState.config, demoState.config);
    const userServiceState = classifyState(userService, cleanState.userService, demoState.userService);
    const debugUtilState = classifyDebugUtilState(debugUtilExists, debugUtil, cleanState, demoState);
    const overallState = classifyOverallState(configState, userServiceState, debugUtilState);

    return { configState, userServiceState, debugUtilState, overallState };
  }

  async function printStatus() {
    const status = await getStatus();

    io.log(`Config state: ${status.configState}`);
    io.log(`User service state: ${status.userServiceState}`);
    io.log(`Debug util state: ${status.debugUtilState}`);
    io.log(`Overall demo state: ${status.overallState}`);
  }

  return { getStatus, printStatus, resetDemo, runDemo };
}

function applyConfigDemoChange(content) {
  const document = YAML.parseDocument(content);
  const database = getRequiredMap(document, "database", "clean config");
  const pool = getRequiredMap(database, "pool", "clean config database");

  database.set("host", DEMO_PRIMARY_HOST);
  pool.set("max_connections", DEMO_MAX_CONNECTIONS);

  const updated = String(document);
  validateDemoConfig(updated);
  return updated;
}

function applyUserServiceDemoChange(content) {
  validateCleanUserService(content);
  let updated = content;

  if (!updated.includes(DEBUG_IMPORT_LINE)) {
    if (!updated.includes('import { logger } from "../utils/logger";')) {
      throw new Error("Clean user service is missing the logger import anchor.");
    }

    updated = updated.replace(
      'import { logger } from "../utils/logger";',
      `import { logger } from "../utils/logger";\n${DEBUG_IMPORT_LINE}`,
    );
  }

  if (!updated.includes(LOG_LINE)) {
    if (!updated.includes(QUERY_LINE)) {
      throw new Error("Clean user service is missing the query line anchor.");
    }

    updated = updated.replace(QUERY_LINE, `${QUERY_LINE}\n${LOG_LINE}`);
  }

  validateDemoUserService(updated);
  return updated;
}

async function loadCleanState(rootDir) {
  const [config, userService, debugUtil] = await Promise.all([
    readWorkspaceFile(rootDir, CLEAN_CONFIG_SOURCE_PATH),
    readWorkspaceFile(rootDir, CLEAN_USER_SERVICE_SOURCE_PATH),
    readWorkspaceFile(rootDir, DEBUG_SOURCE_PATH),
  ]);

  validateCleanConfigBaseline(config);
  validateCleanUserService(userService);

  return { config, userService, debugUtil };
}

function createDemoState(cleanState) {
  return {
    config: applyConfigDemoChange(cleanState.config),
    userService: applyUserServiceDemoChange(cleanState.userService),
    debugUtil: cleanState.debugUtil,
  };
}

function validateCleanConfigBaseline(content) {
  assertNoForbiddenBaselineTokens(content);

  const parsed = parseConfig(content, "canonical clean config");
  assert(
    parsed.host === CLEAN_PRIMARY_HOST,
    `Canonical clean config must use host ${CLEAN_PRIMARY_HOST}, found ${parsed.host}.`,
  );
  assert(
    parsed.pool?.max_connections === CLEAN_MAX_CONNECTIONS,
    `Canonical clean config must use max_connections ${CLEAN_MAX_CONNECTIONS}, found ${parsed.pool?.max_connections}.`,
  );
}

function validateDemoConfig(content) {
  assertNoForbiddenBaselineTokens(content);

  const parsed = parseConfig(content, "demo config");
  assert(
    parsed.host === DEMO_PRIMARY_HOST,
    `Demo config must use host ${DEMO_PRIMARY_HOST}, found ${parsed.host}.`,
  );
  assert(
    parsed.pool?.max_connections === DEMO_MAX_CONNECTIONS,
    `Demo config must use max_connections ${DEMO_MAX_CONNECTIONS}, found ${parsed.pool?.max_connections}.`,
  );
}

function validateCleanUserService(content) {
  assert(
    !content.includes(DEBUG_IMPORT_LINE),
    "Canonical clean user service must not import logSensitiveData.",
  );
  assert(
    !content.includes(LOG_LINE),
    "Canonical clean user service must not log sensitive data.",
  );
}

function validateDemoUserService(content) {
  assert(content.includes(DEBUG_IMPORT_LINE), "Demo user service must import logSensitiveData.");
  assert(content.includes(LOG_LINE), "Demo user service must call logSensitiveData(user.rows[0]).");
}

function assertNoForbiddenBaselineTokens(content) {
  for (const token of FORBIDDEN_BASELINE_TOKENS) {
    assert(!content.includes(token), `Canonical demo sources must not contain ${token}.`);
  }
}

function parseConfig(content, label) {
  const parsed = YAML.parse(content);
  assert(parsed?.database, `${label} is missing a database section.`);
  return parsed.database;
}

function getRequiredMap(parent, key, label) {
  const value = parent.get(key, true);
  assert(value && typeof value.set === "function", `${label} is missing the ${key} map.`);
  return value;
}

function classifyState(current, clean, demo) {
  if (current === clean) {
    return "clean";
  }

  if (current === demo) {
    return "demo";
  }

  return "invalid";
}

function classifyDebugUtilState(exists, content, cleanState, demoState) {
  if (!exists) {
    return "clean";
  }

  if (content === demoState.debugUtil) {
    return "demo";
  }

  if (content === cleanState.debugUtil) {
    return "unexpected-clean-file";
  }

  return "invalid";
}

function classifyOverallState(configState, userServiceState, debugUtilState) {
  if (configState === "clean" && userServiceState === "clean" && debugUtilState === "clean") {
    return "clean";
  }

  if (configState === "demo" && userServiceState === "demo" && debugUtilState === "demo") {
    return "demo";
  }

  return "invalid";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readOptionalWorkspaceFile(rootDir, relativePath) {
  try {
    return await readWorkspaceFile(rootDir, relativePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function readWorkspaceFile(rootDir, relativePath) {
  return readFile(workspacePath(rootDir, relativePath), "utf8");
}

async function writeWorkspaceFile(rootDir, relativePath, content) {
  const destination = workspacePath(rootDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

async function deleteWorkspaceFile(rootDir, relativePath) {
  const destination = workspacePath(rootDir, relativePath);

  if (await pathExists(destination)) {
    await unlink(destination);
  }
}

function workspacePath(rootDir, relativePath) {
  return path.join(rootDir, relativePath);
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  applyConfigDemoChange,
  applyUserServiceDemoChange,
  classifyDebugUtilState,
  classifyOverallState,
  classifyState,
  createDemoController,
  loadCleanState,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

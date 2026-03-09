const { copyFile, mkdir, readFile, stat, unlink, writeFile } = require("node:fs/promises");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BACKUP_DIR = path.join(ROOT_DIR, ".demo-state");
const MANIFEST_PATH = path.join(BACKUP_DIR, "manifest.json");

const CONFIG_PATH = "db/config.yaml";
const USER_SERVICE_PATH = "src/services/userService.ts";
const DEBUG_UTIL_PATH = "src/utils/debug.ts";
const DEBUG_SOURCE_PATH = "demo-changes/02-debug-util.ts";

const TRACKED_PATHS = [CONFIG_PATH, USER_SERVICE_PATH, DEBUG_UTIL_PATH];

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "run":
      await runDemo();
      return;
    case "reset":
      await resetDemo();
      return;
    case "status":
      await printStatus();
      return;
    default:
      console.error("Usage: npm run demo -- <run|reset|status>");
      process.exitCode = 1;
  }
}

async function runDemo() {
  const manifest = await ensureBackup();
  const [baselineConfig, baselineUserService, debugUtil] = await Promise.all([
    readBackupFile(CONFIG_PATH, manifest),
    readBackupFile(USER_SERVICE_PATH, manifest),
    readWorkspaceFile(DEBUG_SOURCE_PATH),
  ]);

  await Promise.all([
    writeWorkspaceFile(CONFIG_PATH, applyConfigDemoChange(baselineConfig)),
    writeWorkspaceFile(USER_SERVICE_PATH, applyUserServiceDemoChange(baselineUserService)),
    writeWorkspaceFile(DEBUG_UTIL_PATH, debugUtil),
  ]);

  console.log("Demo flow applied.");
  console.log(`- Updated \`${CONFIG_PATH}\``);
  console.log(`- Updated \`${USER_SERVICE_PATH}\``);
  console.log(`- Created \`${DEBUG_UTIL_PATH}\``);
}

async function resetDemo() {
  if (!(await pathExists(MANIFEST_PATH))) {
    console.log("Nothing to reset yet. Run the demo once to capture a baseline snapshot.");
    return;
  }

  const manifest = await readManifest();

  await Promise.all(
    TRACKED_PATHS.map(async (relativePath) => {
      const livePath = workspacePath(relativePath);
      const entry = manifest[relativePath];

      if (!entry) {
        return;
      }

      if (entry.existed) {
        await copyFile(backupPath(relativePath), livePath);
        return;
      }

      if (await pathExists(livePath)) {
        await unlink(livePath);
      }
    }),
  );

  console.log("Demo files restored to the captured baseline state.");
}

async function printStatus() {
  const [config, userService, debugUtilExists, backupExists] = await Promise.all([
    readWorkspaceFile(CONFIG_PATH),
    readWorkspaceFile(USER_SERVICE_PATH),
    pathExists(workspacePath(DEBUG_UTIL_PATH)),
    pathExists(MANIFEST_PATH),
  ]);

  const hasConfigChange =
    config.includes("host: db-staging.internal.scip-code.org") &&
    config.includes("max_connections: 100");
  const hasUserServiceChange =
    userService.includes('import { logSensitiveData } from "../utils/debug";') &&
    userService.includes("  logSensitiveData(user.rows[0]);");

  console.log(`Baseline captured: ${backupExists ? "yes" : "no"}`);
  console.log(`Config change applied: ${hasConfigChange ? "yes" : "no"}`);
  console.log(`Sensitive logging change applied: ${hasUserServiceChange ? "yes" : "no"}`);
  console.log(`Debug util present: ${debugUtilExists ? "yes" : "no"}`);
}

async function ensureBackup() {
  if (await pathExists(MANIFEST_PATH)) {
    return readManifest();
  }

  await mkdir(BACKUP_DIR, { recursive: true });

  const manifest = {};

  await Promise.all(
    TRACKED_PATHS.map(async (relativePath) => {
      const livePath = workspacePath(relativePath);
      const existed = await pathExists(livePath);
      manifest[relativePath] = { existed };

      if (!existed) {
        return;
      }

      const destination = backupPath(relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(livePath, destination);
    }),
  );

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function applyConfigDemoChange(content) {
  return content
    .replace("host: db-primary.internal.scip-code.org", "host: db-staging.internal.scip-code.org")
    .replace("max_connections: 25", "max_connections: 100");
}

function applyUserServiceDemoChange(content) {
  let updated = content;
  const importLine = 'import { logSensitiveData } from "../utils/debug";';
  const queryLine = '  const user = await db.query("SELECT * FROM users WHERE id = $1", [id]);';
  const logLine = "  logSensitiveData(user.rows[0]);";

  if (!updated.includes(importLine)) {
    updated = updated.replace(
      'import { logger } from "../utils/logger";',
      `import { logger } from "../utils/logger";\n${importLine}`,
    );
  }

  if (!updated.includes(logLine)) {
    updated = updated.replace(queryLine, `${queryLine}\n${logLine}`);
  }

  return updated;
}

async function readManifest() {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

async function readBackupFile(relativePath, manifest) {
  if (!manifest[relativePath] || !manifest[relativePath].existed) {
    throw new Error(`No captured baseline exists for ${relativePath}.`);
  }

  return readFile(backupPath(relativePath), "utf8");
}

async function readWorkspaceFile(relativePath) {
  return readFile(workspacePath(relativePath), "utf8");
}

async function writeWorkspaceFile(relativePath, content) {
  const destination = workspacePath(relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

function workspacePath(relativePath) {
  return path.join(ROOT_DIR, relativePath);
}

function backupPath(relativePath) {
  return path.join(BACKUP_DIR, relativePath);
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

void main();

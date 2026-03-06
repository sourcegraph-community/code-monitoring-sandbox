/**
 * Debug script for investigating user-related issues.
 * Run with: npx ts-node scripts/debug-users.ts
 */

import { db } from "../src/utils/database";
import { logger } from "../src/utils/logger";

async function debugUserLookup(userId: string) {
  logger.info(`Debug lookup for user: ${userId}`);

  const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);

  if (result.rows.length === 0) {
    logger.warn(`User ${userId} not found`);
    return;
  }

  const user = result.rows[0];
  logger.info(`Found user: ${user.name} (${user.role})`);
}

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npx ts-node scripts/debug-users.ts <user-id>");
    process.exit(1);
  }
  await debugUserLookup(userId);
}

main();

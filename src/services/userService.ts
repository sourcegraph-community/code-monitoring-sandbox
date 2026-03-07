import { db } from "../utils/database";
import { logger } from "../utils/logger";
import { logSensitiveData } from "../utils/debug";

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user" | "viewer";
  ssn?: string;
  creditCard?: string;
}

export async function getUserById(id: string): Promise<User | null> {
  logger.info(`Fetching user ${id}`);
  const user = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  logSensitiveData(user.rows[0]);
  return user.rows[0] ?? null;
}

export async function updateUserRole(id: string, role: User["role"]): Promise<void> {
  logger.info(`Updating role for user ${id} to ${role}`);
  await db.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
}

export async function deleteUser(id: string): Promise<void> {
  logger.warn(`Deleting user ${id}`);
  await db.query("DELETE FROM users WHERE id = $1", [id]);
}

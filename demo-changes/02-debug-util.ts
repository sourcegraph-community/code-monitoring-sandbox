/**
 * THIS FILE IS FOR DEMO PURPOSES.
 * Commit this file to trigger the "logSensitiveData" code monitor.
 *
 * This represents the kind of dangerous code a monitor should catch:
 * logging PII/sensitive fields to stdout in production.
 */

export function logSensitiveData(data: Record<string, unknown>): void {
  // WARNING: This logs sensitive user data including PII
  console.log("[SENSITIVE DEBUG]", JSON.stringify(data, null, 2));
}

export function logSensitivePayload(endpoint: string, payload: unknown): void {
  console.log(`[SENSITIVE DEBUG] ${endpoint}:`, JSON.stringify(payload));
}

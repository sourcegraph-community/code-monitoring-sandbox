import { db } from "../utils/database";
import { logger } from "../utils/logger";

interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
}

export async function processPayment(payment: Payment): Promise<void> {
  logger.info(`Processing payment ${payment.id} for $${payment.amount}`);

  await db.query(
    "INSERT INTO payments (id, user_id, amount, currency, status) VALUES ($1, $2, $3, $4, $5)",
    [payment.id, payment.userId, payment.amount, payment.currency, "pending"]
  );

  // Charge via payment gateway
  const result = await chargeGateway(payment);

  await db.query("UPDATE payments SET status = $1 WHERE id = $2", [
    result.success ? "completed" : "failed",
    payment.id,
  ]);
}

async function chargeGateway(payment: Payment) {
  // Integration with payment provider
  return { success: true, transactionId: `txn_${Date.now()}` };
}

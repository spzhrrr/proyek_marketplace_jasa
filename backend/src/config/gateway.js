/**
 * Kredensial mock payment gateway.
 * HARUS sama dengan baris pg_merchants.api_key / webhook_secret di database.
 */
export const MERCHANT_API_KEY = process.env.MERCHANT_API_KEY || "tolongin-pg-api-key-dev";
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "tolongin-webhook-secret-dev";
export const GATEWAY_FRONTEND_URL =
  process.env.GATEWAY_FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";
export const MAIN_APP_URL =
  process.env.MAIN_APP_URL || process.env.RENDER_EXTERNAL_URL || process.env.GATEWAY_FRONTEND_URL || "http://localhost:5173";

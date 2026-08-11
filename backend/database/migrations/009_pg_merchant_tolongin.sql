-- Kredensial mock gateway (proyek kuliah: string mudah dibaca).
-- Harus sama dengan MERCHANT_API_KEY / WEBHOOK_SECRET di backend/.env

UPDATE pg_merchants
SET
  code = 'TOLONGIN',
  name = 'Tolongin Payment',
  api_key = 'tolongin-pg-api-key-dev',
  webhook_secret = 'tolongin-webhook-secret-dev',
  webhook_url = 'http://localhost:3000/api/webhooks/payment-gateway'
WHERE code IN ('COURSENET', 'TOLONGIN');

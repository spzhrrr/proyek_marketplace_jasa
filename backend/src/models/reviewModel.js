import { pool } from "../config/db.js";

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, comment)
     VALUES (?, ?, ?, ?, ?)`,
    [data.order_id, data.reviewer_id, data.reviewee_id, data.rating, data.comment],
  );
  return result.insertId;
}

async function findByOrder(orderId) {
  const [rows] = await pool.query(
    `SELECT r.*,
            CONCAT(u.first_name, ' ', u.last_name) AS reviewer_name
     FROM reviews r
     JOIN users u ON r.reviewer_id = u.id
     WHERE r.order_id = ?`,
    [orderId],
  );
  return rows;
}

async function hasReviewed(orderId, reviewerId) {
  const [rows] = await pool.query(
    "SELECT id FROM reviews WHERE order_id = ? AND reviewer_id = ? LIMIT 1",
    [orderId, reviewerId],
  );
  return rows.length > 0;
}

async function findByReviewee(userId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT r.*,
            CONCAT(u.first_name, ' ', u.last_name) AS reviewer_name,
            o.title AS order_title,
            o.source AS order_source,
            o.seller_id AS order_seller_id,
            o.buyer_id AS order_buyer_id
     FROM reviews r
     JOIN users u ON r.reviewer_id = u.id
     JOIN orders o ON r.order_id = o.id
     WHERE r.reviewee_id = ?
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [userId, limit],
  );
  return rows;
}

/** Ulasan untuk listing jasa (order SERVICE + service_id). */
async function findByService(serviceId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT r.*,
            CONCAT(u.first_name, ' ', u.last_name) AS reviewer_name,
            o.title AS order_title
     FROM reviews r
     JOIN users u ON r.reviewer_id = u.id
     JOIN orders o ON r.order_id = o.id
     WHERE o.service_id = ? AND o.source = 'SERVICE' AND r.reviewee_id = o.seller_id
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [serviceId, limit],
  );
  return rows;
}

async function getStatsForUser(userId) {
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       ROUND(AVG(rating), 1) AS avg_rating,
       SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS star5,
       SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS star4,
       SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS star3,
       SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS star2,
       SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS star1
     FROM reviews WHERE reviewee_id = ?`,
    [userId],
  );
  const s = rows[0];
  return {
    total: Number(s.total) || 0,
    avg_rating: s.avg_rating ? Number(s.avg_rating) : 0,
    breakdown: {
      5: Number(s.star5) || 0,
      4: Number(s.star4) || 0,
      3: Number(s.star3) || 0,
      2: Number(s.star2) || 0,
      1: Number(s.star1) || 0,
    },
  };
}

export default { create, findByOrder, hasReviewed, findByReviewee, findByService, getStatsForUser };

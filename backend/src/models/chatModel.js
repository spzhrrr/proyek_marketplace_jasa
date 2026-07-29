import { pool } from "../config/db.js";

async function findAll(room) {
  const [rows] = await pool.query(
    "SELECT * FROM chat_messages WHERE room = ? ORDER BY id",
    [room]
  );
  return rows;
}

async function create(room, pesan, senderId = null) {
  await pool.query(
    "INSERT INTO chat_messages (room, pesan, sender_id) VALUES (?, ?, ?)",
    [room, pesan, senderId],
  );
}

export default { findAll, create };

import { pool } from "../../config/db.js";

let readsReady = false;

async function ensureReadsTable() {
  if (readsReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_reads (
      user_id BIGINT UNSIGNED NOT NULL,
      room VARCHAR(120) NOT NULL,
      last_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, room)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  readsReady = true;
}

export function parseRoom(room) {
  const m = String(room || "").match(/^(jasa|lowongan)-(\d+)-u-(\d+)$/);
  if (!m) return null;
  return {
    room,
    listingKind: m[1],
    listingType: m[1] === "jasa" ? "SERVICE" : "JOB",
    listingId: Number(m[2]),
    peerId: Number(m[3]),
  };
}

async function findAll(room) {
  const [rows] = await pool.query(
    `SELECT c.*, CONCAT(u.first_name, ' ', u.last_name) AS sender_name
     FROM chat_messages c
     LEFT JOIN users u ON c.sender_id = u.id
     WHERE c.room = ?
     ORDER BY c.id`,
    [room],
  );
  return rows;
}

async function create(room, pesan, senderId = null) {
  await pool.query(
    "INSERT INTO chat_messages (room, pesan, sender_id) VALUES (?, ?, ?)",
    [room, pesan, senderId],
  );
}

/** Peers from pair rooms like `jasa-12-u-34` / `lowongan-12-u-34`. */
async function findPeersByRoomPrefix(roomPrefix) {
  const [rows] = await pool.query(
    `SELECT CAST(SUBSTRING_INDEX(c.room, '-u-', -1) AS UNSIGNED) AS user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS name,
            MAX(c.created_at) AS last_at
     FROM chat_messages c
     LEFT JOIN users u ON u.id = CAST(SUBSTRING_INDEX(c.room, '-u-', -1) AS UNSIGNED)
     WHERE c.room LIKE ?
     GROUP BY user_id, name
     ORDER BY last_at DESC`,
    [roomPrefix + "%"],
  );
  return rows;
}

async function roomHasMessages(room) {
  const [rows] = await pool.query(
    "SELECT id FROM chat_messages WHERE room = ? LIMIT 1",
    [room],
  );
  return rows.length > 0;
}

async function markRead(userId, room, lastId) {
  await ensureReadsTable();
  await pool.query(
    `INSERT INTO chat_reads (user_id, room, last_read_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))`,
    [userId, room, Number(lastId) || 0],
  );
}

async function findInboxForUser(userId) {
  await ensureReadsTable();
  const uid = Number(userId);
  const [rows] = await pool.query(
    `SELECT c.room,
            MAX(c.id) AS last_id,
            MAX(c.created_at) AS last_at,
            SUBSTRING_INDEX(GROUP_CONCAT(c.pesan ORDER BY c.id DESC SEPARATOR '|||'), '|||', 1) AS last_message,
            CAST(SUBSTRING_INDEX(GROUP_CONCAT(c.sender_id ORDER BY c.id DESC), ',', 1) AS UNSIGNED) AS last_sender_id
     FROM chat_messages c
     WHERE c.room LIKE 'jasa-%-u-%' OR c.room LIKE 'lowongan-%-u-%'
     GROUP BY c.room
     ORDER BY last_at DESC
     LIMIT 200`,
  );

  const parsed = [];
  const serviceIds = new Set();
  const jobIds = new Set();
  for (const row of rows) {
    const info = parseRoom(row.room);
    if (!info) continue;
    if (info.listingKind === "jasa") serviceIds.add(info.listingId);
    else jobIds.add(info.listingId);
    parsed.push({ ...info, ...row });
  }

  const services = new Map();
  const jobs = new Map();
  if (serviceIds.size) {
    const [srows] = await pool.query(
      `SELECT s.id, s.title, s.seller_id,
              CONCAT(u.first_name, ' ', u.last_name) AS owner_name
       FROM services s JOIN users u ON u.id = s.seller_id
       WHERE s.id IN (${[...serviceIds].map(() => "?").join(",")})`,
      [...serviceIds],
    );
    for (const s of srows) services.set(Number(s.id), s);
  }
  if (jobIds.size) {
    const [jrows] = await pool.query(
      `SELECT j.id, j.title, j.buyer_id AS owner_id,
              CONCAT(u.first_name, ' ', u.last_name) AS owner_name
       FROM jobs j JOIN users u ON u.id = j.buyer_id
       WHERE j.id IN (${[...jobIds].map(() => "?").join(",")})`,
      [...jobIds],
    );
    for (const j of jrows) jobs.set(Number(j.id), j);
  }

  const otherIds = new Set();
  const mine = [];
  for (const t of parsed) {
    const listing = t.listingKind === "jasa" ? services.get(t.listingId) : jobs.get(t.listingId);
    if (!listing) continue;
    const ownerId = Number(t.listingKind === "jasa" ? listing.seller_id : listing.owner_id);
    const isOwner = ownerId === uid;
    const isPeer = t.peerId === uid;
    if (!isOwner && !isPeer) continue;
    const counterpartId = isOwner ? t.peerId : ownerId;
    otherIds.add(counterpartId);
    mine.push({
      room: t.room,
      listingKind: t.listingKind,
      listingType: t.listingType,
      listingId: t.listingId,
      listingTitle: listing.title,
      ownerId,
      peerId: t.peerId,
      counterpartId,
      last_message: t.last_message || "",
      last_at: t.last_at,
      last_id: Number(t.last_id),
      last_sender_id: Number(t.last_sender_id) || null,
    });
  }

  const people = new Map();
  if (otherIds.size) {
    const [prows] = await pool.query(
      `SELECT id, CONCAT(first_name, ' ', last_name) AS name, profilepic_url
       FROM users WHERE id IN (${[...otherIds].map(() => "?").join(",")})`,
      [...otherIds],
    );
    for (const p of prows) people.set(Number(p.id), p);
  }

  const [reads] = await pool.query(
    "SELECT room, last_read_id FROM chat_reads WHERE user_id = ?",
    [uid],
  );
  const readMap = new Map(reads.map((r) => [r.room, Number(r.last_read_id)]));

  const jasaKeys = mine.filter((t) => t.listingKind === "jasa");
  const jobKeys = mine.filter((t) => t.listingKind === "lowongan");
  const orderMap = new Map();
  const appMap = new Map();

  if (jasaKeys.length) {
    const ids = [...new Set(jasaKeys.map((t) => t.listingId))];
    const [orows] = await pool.query(
      `SELECT service_id, buyer_id, status
       FROM orders
       WHERE source = 'SERVICE' AND service_id IN (${ids.map(() => "?").join(",")})
       ORDER BY id DESC`,
      ids,
    );
    for (const o of orows) {
      const key = `jasa-${o.service_id}-${o.buyer_id}`;
      if (!orderMap.has(key)) orderMap.set(key, o.status);
    }
  }
  if (jobKeys.length) {
    const ids = [...new Set(jobKeys.map((t) => t.listingId))];
    const [orows] = await pool.query(
      `SELECT job_id, seller_id, status
       FROM orders
       WHERE source = 'JOB' AND job_id IN (${ids.map(() => "?").join(",")})
       ORDER BY id DESC`,
      ids,
    );
    for (const o of orows) {
      const key = `job-${o.job_id}-${o.seller_id}`;
      if (!orderMap.has(key)) orderMap.set(key, o.status);
    }
    const [arows] = await pool.query(
      `SELECT job_id, seller_id, status
       FROM applications
       WHERE job_id IN (${ids.map(() => "?").join(",")})
       ORDER BY id DESC`,
      ids,
    );
    for (const a of arows) {
      const key = `job-${a.job_id}-${a.seller_id}`;
      if (!appMap.has(key)) appMap.set(key, a.status);
    }
  }

  return mine.map((t) => {
    const person = people.get(t.counterpartId);
    const lastRead = readMap.get(t.room) || 0;
    const rel = relationForThread(t, orderMap, appMap);
    return {
      ...t,
      counterpartName: person?.name || "Pengguna",
      counterpartAvatar: person?.profilepic_url || null,
      unread: t.last_id > lastRead && Number(t.last_sender_id) !== uid ? 1 : 0,
      relationKind: rel.kind,
      relationStatus: rel.status,
      relationLabel: rel.label,
    };
  });
}

function relationForThread(t, orderMap, appMap) {
  if (t.listingKind === "jasa") {
    const status = orderMap.get(`jasa-${t.listingId}-${t.peerId}`);
    if (status) {
      const label =
        status === "PENDING" ? "Permintaan" :
        status === "COMPLETED" ? "Selesai" :
        status === "CANCELLED" || status === "REJECTED" ? "Ditutup" :
        "Pesanan";
      return { kind: "order", status, label };
    }
    return { kind: "inquiry", status: null, label: "Inquiry" };
  }
  const orderStatus = orderMap.get(`job-${t.listingId}-${t.peerId}`);
  if (orderStatus) {
    const label =
      orderStatus === "COMPLETED" ? "Proyek selesai" :
      orderStatus === "PENDING" || orderStatus === "ACCEPTED" ? "Direkrut" :
      "Proyek";
    return { kind: "order", status: orderStatus, label };
  }
  const appStatus = appMap.get(`job-${t.listingId}-${t.peerId}`);
  if (appStatus) {
    const label =
      appStatus === "PENDING" ? "Lamaran" :
      appStatus === "ACCEPTED" ? "Diterima" :
      "Ditolak";
    return { kind: "application", status: appStatus, label };
  }
  return { kind: "inquiry", status: null, label: "Inquiry" };
}

export async function findRelationForRoom(info) {
  const orderMap = new Map();
  const appMap = new Map();
  if (info.listingKind === "jasa") {
    const [rows] = await pool.query(
      `SELECT status FROM orders
       WHERE source = 'SERVICE' AND service_id = ? AND buyer_id = ?
       ORDER BY id DESC LIMIT 1`,
      [info.listingId, info.peerId],
    );
    if (rows[0]) orderMap.set(`jasa-${info.listingId}-${info.peerId}`, rows[0].status);
  } else {
    const [orows] = await pool.query(
      `SELECT status FROM orders
       WHERE source = 'JOB' AND job_id = ? AND seller_id = ?
       ORDER BY id DESC LIMIT 1`,
      [info.listingId, info.peerId],
    );
    if (orows[0]) orderMap.set(`job-${info.listingId}-${info.peerId}`, orows[0].status);
    const [arows] = await pool.query(
      `SELECT status FROM applications
       WHERE job_id = ? AND seller_id = ?
       ORDER BY id DESC LIMIT 1`,
      [info.listingId, info.peerId],
    );
    if (arows[0]) appMap.set(`job-${info.listingId}-${info.peerId}`, arows[0].status);
  }
  return relationForThread(
    { listingKind: info.listingKind, listingId: info.listingId, peerId: info.peerId },
    orderMap,
    appMap,
  );
}

async function countUnread(userId) {
  const inbox = await findInboxForUser(userId);
  return inbox.reduce((n, t) => n + (t.unread ? 1 : 0), 0);
}

export default {
  findAll,
  create,
  findPeersByRoomPrefix,
  roomHasMessages,
  markRead,
  findInboxForUser,
  countUnread,
  parseRoom,
  findRelationForRoom,
};

import { pool } from "../../config/db.js";
import chatModel from "../../models/communication/chatModel.js";
import serviceModel from "../../models/marketplace/serviceModel.js";
import jobModel from "../../models/marketplace/jobModel.js";

async function mergeJasaChatPeers(serviceId) {
  const fromChat = await chatModel.findPeersByRoomPrefix(`jasa-${serviceId}-u-`);
  const map = new Map(fromChat.map((p) => [Number(p.user_id), p]));
  const [orderPeers] = await pool.query(
    `SELECT DISTINCT o.buyer_id AS user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS name
     FROM orders o
     JOIN users u ON u.id = o.buyer_id
     WHERE o.service_id = ? AND o.source = 'SERVICE'`,
    [serviceId],
  );
  for (const p of orderPeers) {
    const id = Number(p.user_id);
    if (!map.has(id)) map.set(id, { user_id: id, name: p.name, last_at: null });
  }
  return [...map.values()];
}

async function ownerCanMessageJasaPeer(serviceId, peerUserId) {
  const room = `jasa-${serviceId}-u-${peerUserId}`;
  if (await chatModel.roomHasMessages(room)) return true;
  const [rows] = await pool.query(
    `SELECT id FROM orders
     WHERE service_id = ? AND buyer_id = ? AND source = 'SERVICE' LIMIT 1`,
    [serviceId, peerUserId],
  );
  return rows.length > 0;
}

async function mergeLowonganChatPeers(jobId) {
  const fromChat = await chatModel.findPeersByRoomPrefix(`lowongan-${jobId}-u-`);
  const map = new Map(fromChat.map((p) => [Number(p.user_id), p]));
  const [appPeers] = await pool.query(
    `SELECT DISTINCT a.seller_id AS user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS name
     FROM applications a
     JOIN users u ON u.id = a.seller_id
     WHERE a.job_id = ?`,
    [jobId],
  );
  for (const p of appPeers) {
    const id = Number(p.user_id);
    if (!map.has(id)) map.set(id, { user_id: id, name: p.name, last_at: null });
  }
  const [orderPeers] = await pool.query(
    `SELECT DISTINCT o.seller_id AS user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS name
     FROM orders o
     JOIN users u ON u.id = o.seller_id
     WHERE o.job_id = ? AND o.source = 'JOB'`,
    [jobId],
  );
  for (const p of orderPeers) {
    const id = Number(p.user_id);
    if (!map.has(id)) map.set(id, { user_id: id, name: p.name, last_at: null });
  }
  return [...map.values()];
}

async function ownerCanMessageLowonganPeer(jobId, peerUserId) {
  const room = `lowongan-${jobId}-u-${peerUserId}`;
  if (await chatModel.roomHasMessages(room)) return true;
  const [apps] = await pool.query(
    `SELECT id FROM applications WHERE job_id = ? AND seller_id = ? LIMIT 1`,
    [jobId, peerUserId],
  );
  if (apps.length) return true;
  const [orders] = await pool.query(
    `SELECT id FROM orders
     WHERE job_id = ? AND seller_id = ? AND source = 'JOB' LIMIT 1`,
    [jobId, peerUserId],
  );
  return orders.length > 0;
}

async function resolveChatAccess(userId, room) {
  const info = chatModel.parseRoom(room);
  if (!info) return null;
  const uidNum = Number(userId);

  if (info.listingKind === "jasa") {
    const listing = await serviceModel.findByIdAny(info.listingId);
    if (!listing) return null;
    const ownerId = Number(listing.seller_id);
    const isOwner = ownerId === uidNum;
    const isPeer = info.peerId === uidNum;
    if (!isOwner && !isPeer) return null;
    if (isOwner && !(await ownerCanMessageJasaPeer(info.listingId, info.peerId))) return null;
    return {
      info,
      listing,
      listingTitle: listing.title,
      ownerId,
      isOwner,
      counterpartId: isOwner ? info.peerId : ownerId,
    };
  }

  const listing = await jobModel.findById(info.listingId);
  if (!listing) return null;
  const ownerId = Number(listing.buyer_id);
  const isOwner = ownerId === uidNum;
  const isPeer = info.peerId === uidNum;
  if (!isOwner && !isPeer) return null;
  if (isOwner && !(await ownerCanMessageLowonganPeer(info.listingId, info.peerId))) return null;
  return {
    info,
    listing,
    listingTitle: listing.title,
    ownerId,
    isOwner,
    counterpartId: isOwner ? info.peerId : ownerId,
  };
}

export {
  mergeJasaChatPeers,
  ownerCanMessageJasaPeer,
  mergeLowonganChatPeers,
  ownerCanMessageLowonganPeer,
  resolveChatAccess,
};

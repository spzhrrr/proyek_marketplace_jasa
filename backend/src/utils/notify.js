import notificationModel from "../models/communication/notificationModel.js";

export default async function notify(data) {
  return notificationModel.create({
    user_id: data.userId,
    actor_id: data.actorId || null,
    type: data.type,
    title: data.title,
    message: data.message,
    link_url: data.linkUrl || null,
    reference_type: data.referenceType || null,
    reference_id: data.referenceId || null,
  });
}

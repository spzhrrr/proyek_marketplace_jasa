import auth from "./auth.controller.js";
import category from "./category.controller.js";
import service from "./service.controller.js";
import job from "./job.controller.js";
import chat from "./chat.controller.js";
import dashboard from "./dashboard.controller.js";
import notification from "./notification.controller.js";
import order from "./order.controller.js";
import application from "./application.controller.js";
import verify from "./verify.controller.js";
import profile from "./profile.controller.js";
import admin from "./admin.controller.js";

export default {
  ...auth,
  ...category,
  ...service,
  ...job,
  ...chat,
  ...dashboard,
  ...notification,
  ...order,
  ...application,
  ...verify,
  ...profile,
  ...admin,
};

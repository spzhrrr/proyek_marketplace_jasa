import { capitalizeName } from "./formatName.js";

function fullName(user) {
  if (!user) return "";
  if (user.first_name) {
    const first = capitalizeName(user.first_name);
    const last = capitalizeName(user.last_name || "");
    return `${first} ${last}`.trim();
  }
  return user.name || "";
}

export { fullName };

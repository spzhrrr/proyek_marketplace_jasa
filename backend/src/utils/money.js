export function parseMoneyInput(value) {
  if (value === null || value === undefined) return null;

  let digits = "";
  const raw = String(value);
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code >= 48 && code <= 57) digits += raw[i];
  }

  if (digits.length === 0) return null;
  return parseInt(digits, 10);
}

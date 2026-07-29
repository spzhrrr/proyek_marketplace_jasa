function padNum(n, len) {
  let s = String(n);
  while (s.length < len) s = "0" + s;
  return s;
}

function generateOrderNumber(sequenceId) {
  const year = new Date().getFullYear();
  return `ORD-${year}-${padNum(sequenceId, 4)}`;
}

export { generateOrderNumber };

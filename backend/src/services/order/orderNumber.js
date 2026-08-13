function generateOrderNumber(sequenceId) {
  const year = new Date().getFullYear();
  return `ORD-${year}-${String(sequenceId).padStart(4, "0")}`;
}

export { generateOrderNumber };

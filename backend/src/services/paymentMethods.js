const PAYMENT_METHODS = {
  qris: "QRIS",
  gopay: "GoPay",
  bank_va: "Virtual Account (BCA)",
};

function getMethodLabel(method) {
  return PAYMENT_METHODS[method] || method;
}

export { PAYMENT_METHODS, getMethodLabel };

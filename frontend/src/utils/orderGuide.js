const FLOW_STEPS = [
  { key: "sent", label: "Kirim pesanan" },
  { key: "accept", label: "Penjual setuju" },
  { key: "pay", label: "Bayar" },
  { key: "work", label: "Dikerjakan" },
  { key: "done", label: "Selesai" },
];

function flowIndex(order) {
  if (order.status === "COMPLETED") return 4;
  if (order.status === "IN_PROGRESS") return 3;
  if (order.status === "ACCEPTED") return order.escrow === "UNPAID" ? 2 : 3;
  if (order.status === "PENDING") return 1;
  if (order.status === "REJECTED" || order.status === "CANCELLED") return -1;
  return 0;
}

export function getOrderFlowSteps(order) {
  const current = flowIndex(order);
  return FLOW_STEPS.map((step, i) => ({
    ...step,
    done: current >= 0 && i < current,
    current: current >= 0 && i === current,
  }));
}

export function getOrderNextHint(order, ctx) {
  const { isBuyer, isSeller, canPay, canSubmitWork, pendingSubmission } = ctx;

  if (order.status === "REJECTED") {
    return { tone: "warn", text: "Penjual menolak pesanan ini. Kamu bisa cari jasa lain." };
  }
  if (order.status === "CANCELLED") {
    return { tone: "warn", text: "Pesanan ini sudah dibatalkan." };
  }
  if (order.status === "COMPLETED") {
    return { tone: "success", text: "Pesanan selesai. Jangan lupa beri ulasan jika belum." };
  }
  if (order.status === "PENDING") {
    if (isBuyer) {
      return {
        tone: "info",
        text: "Pesananmu sudah terkirim. Tunggu penjual menerima. Setelah diterima, kamu akan diminta bayar.",
      };
    }
    if (isSeller) {
      return {
        tone: "info",
        text: "Ada permintaan baru. Terima jika bisa mengerjakan, atau tolak dengan alasan jelas.",
      };
    }
  }
  if (canPay && isBuyer) {
    return {
      tone: "info",
      text: "Penjual sudah menerima. Bayar sekarang — uang ditahan aman sampai kamu setujui hasil pekerjaan.",
    };
  }
  if (order.status === "IN_PROGRESS" && order.escrow === "HELD") {
    if (canSubmitWork && isSeller) {
      return { tone: "info", text: "Pembayaran sudah masuk. Kerjakan pesanan lalu unggah bukti pengerjaan." };
    }
    if (pendingSubmission && isBuyer) {
      return {
        tone: "info",
        text: "Penjual mengirim bukti. Periksa — jika sesuai klik Setujui. Jika belum, minta revisi.",
      };
    }
    if (isBuyer) return { tone: "info", text: "Uang aman ditahan. Tunggu penjual menyelesaikan pekerjaan." };
    if (isSeller) return { tone: "info", text: "Pembayaran diterima. Selesaikan pekerjaan lalu kirim bukti." };
  }
  if (order.status === "ACCEPTED" && order.escrow === "UNPAID") {
    if (isBuyer) {
      return { tone: "info", text: "Silakan bayar agar penjual bisa mulai bekerja." };
    }
    if (isSeller) {
      const waitingBuyer = order.source === "JOB"
        ? "Menunggu pemberi kerja membayar. Setelah bayar, kamu bisa mulai mengerjakan."
        : "Menunggu pembeli membayar. Setelah bayar, kamu bisa mulai mengerjakan.";
      return { tone: "info", text: waitingBuyer };
    }
  }
  return null;
}

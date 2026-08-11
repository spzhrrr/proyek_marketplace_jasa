const FLOW_STEPS_SERVICE = [
  { key: "sent", label: "Kirim pesanan" },
  { key: "accept", label: "Penjual setuju" },
  { key: "pay", label: "Bayar" },
  { key: "work", label: "Dikerjakan" },
  { key: "done", label: "Selesai" },
];

const FLOW_STEPS_JOB = [
  { key: "sent", label: "Lamaran diterima" },
  { key: "accept", label: "Order dibuat" },
  { key: "pay", label: "Bayar" },
  { key: "work", label: "Dikerjakan" },
  { key: "done", label: "Selesai" },
];

function flowIndex(order) {
  if (order.status === "COMPLETED") return 4;
  if (order.status === "DISPUTED") return 3;
  if (order.status === "IN_PROGRESS") return 3;
  if (order.status === "ACCEPTED") return order.escrow === "UNPAID" ? 2 : 3;
  if (order.status === "PENDING") return 1;
  if (order.status === "REJECTED" || order.status === "CANCELLED") return -1;
  return 0;
}

export function getOrderFlowSteps(order) {
  const current = flowIndex(order);
  const isCompleted = order.status === "COMPLETED";
  const isDisputed = order.status === "DISPUTED";
  const isJob = order.source === "JOB";
  const labels = isJob ? FLOW_STEPS_JOB : FLOW_STEPS_SERVICE;

  // JOB starts at ACCEPTED — mark "lamaran diterima" + "order dibuat" as done when unpaid/pay stage
  return labels.map((step, i) => {
    let done = isCompleted ? true : (current >= 0 && i < current);
    let currentStep = isCompleted || isDisputed ? false : (current >= 0 && i === current);

    if (isJob && order.status === "ACCEPTED" && order.escrow === "UNPAID") {
      done = i < 2;
      currentStep = i === 2;
    }
    if (isJob && (order.status === "IN_PROGRESS" || order.status === "DISPUTED" || order.status === "COMPLETED")) {
      if (i < 3) done = true;
    }

    return {
      ...step,
      done,
      current: currentStep,
      warned: isDisputed && i === 3,
    };
  });
}

export function getOrderNextHint(order, ctx) {
  const { isBuyer, isSeller, canPay, canSubmitWork, pendingSubmission, canDispute, revisionsExhausted } = ctx;

  if (order.status === "DISPUTED") {
    return {
      tone: "warn",
      text: "Pesanan dalam sengketa. Dana tetap ditahan sampai admin memutuskan REFUND ke pembeli atau RELEASE ke penjual.",
    };
  }
  if (order.status === "REJECTED") {
    return { tone: "warn", text: "Penjual menolak pesanan ini. Kamu bisa cari jasa lain." };
  }
  if (order.status === "CANCELLED") {
    if (order.escrow === "REFUNDED") {
      return { tone: "warn", text: "Pesanan dibatalkan. Jika ada pembayaran, dana dikembalikan ke saldo wallet." };
    }
    return { tone: "warn", text: "Pesanan ini sudah dibatalkan." };
  }
  if (order.status === "COMPLETED") {
    return { tone: "success", text: "Pesanan selesai. Jangan lupa beri ulasan jika belum." };
  }
  if (order.status === "PENDING") {
    if (isBuyer) {
      return {
        tone: "info",
        text: "Pesananmu sudah terkirim. Tunggu penjual menerima (otomatis batal jika tidak direspons dalam 72 jam).",
      };
    }
    if (isSeller) {
      return {
        tone: "info",
        text: "Ada permintaan baru. Terima atau tolak — jika diabaikan >72 jam, pesanan dibatalkan otomatis.",
      };
    }
  }
  if (canPay && isBuyer) {
    return {
      tone: "info",
      text: "Penjual sudah menerima. Bayar dalam 48 jam — uang ditahan aman sampai kamu setujui hasil. Lewat batas = batal otomatis.",
    };
  }
  if (order.status === "IN_PROGRESS" && order.escrow === "HELD") {
    if (revisionsExhausted && isBuyer) {
      return {
        tone: "warn",
        text: "Batas revisi sudah habis. Setujui hasil kerja atau ajukan sengketa agar admin meninjau.",
      };
    }
    if (canSubmitWork && isSeller) {
      return { tone: "info", text: "Pembayaran sudah masuk. Kerjakan pesanan lalu unggah bukti pengerjaan." };
    }
    if (pendingSubmission && isBuyer) {
      return {
        tone: "info",
        text: "Penjual mengirim bukti. Periksa — jika sesuai klik Setujui. Jika belum, minta revisi.",
      };
    }
    if (canDispute && isBuyer) {
      return { tone: "info", text: "Uang aman ditahan. Tunggu penjual menyelesaikan pekerjaan. Jika bermasalah, ajukan sengketa." };
    }
    if (isBuyer) return { tone: "info", text: "Uang aman ditahan. Tunggu penjual menyelesaikan pekerjaan." };
    if (isSeller) return { tone: "info", text: "Pembayaran diterima. Selesaikan pekerjaan lalu kirim bukti." };
  }
  if (order.status === "ACCEPTED" && order.escrow === "UNPAID") {
    if (isBuyer) {
      return { tone: "info", text: "Silakan bayar agar penjual bisa mulai bekerja. Batas 48 jam sebelum dibatalkan otomatis." };
    }
    if (isSeller) {
      const waitingBuyer = order.source === "JOB"
        ? "Menunggu pemberi kerja membayar (batas 48 jam). Setelah bayar, kamu bisa mulai mengerjakan."
        : "Menunggu pembeli membayar (batas 48 jam). Setelah bayar, kamu bisa mulai mengerjakan.";
      return { tone: "info", text: waitingBuyer };
    }
  }
  return null;
}

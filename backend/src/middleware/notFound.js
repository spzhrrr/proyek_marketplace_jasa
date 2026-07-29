function notFound(req, res) {
  if (req.path.startsWith("/api") || req.path.startsWith("/gateway/api")) {
    return res.status(404).json({ ok: false, error: "Endpoint tidak ditemukan" });
  }
  res.status(404).type("text").send("Halaman tidak ditemukan");
}

export default notFound;

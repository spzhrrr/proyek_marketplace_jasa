function wantsJson(req) {
  return (
    req.path.startsWith("/api") ||
    req.path.startsWith("/gateway/api") ||
    req.headers.accept?.includes("application/json")
  );
}

function errorHandler(err, req, res, next) {
  console.error(err);
  const message = err.message || "Internal Server Error";
  if (wantsJson(req)) {
    return res.status(500).json({ ok: false, error: message });
  }
  res.status(500).type("text").send(message);
}

export default errorHandler;

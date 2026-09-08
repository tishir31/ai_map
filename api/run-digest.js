// The public digest is assembled from the approved market projection.
// No mailbox access or external agent routine is needed for this public feature.
const dailyBrief = require("./daily-brief");
export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Use GET or POST." });
  return dailyBrief({ ...req, method: "GET", url: "/api/daily-brief?days=7", query: { days: "7" } }, res);
}

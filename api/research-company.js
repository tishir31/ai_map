// Vercel Serverless Function — Physical AI company researcher.
// POST /api/research-company  { name: string }
// Returns: { ok: true, candidate: { ...Company-like, suggestedActivity, sources } }
//
// Uses Gemini (already configured for the parent ai_map_repo). Keeps the API
// key server-side. Returns structured JSON the frontend modal can preview.

const ALLOWED_SUBSECTORS = [
    "robotics",
    "humanoids",
    "autonomous vehicles",
    "drones",
    "defense autonomy",
    "industrial automation",
    "embodied AI",
    "edge AI hardware",
    "other"
];
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

const PROMPT = (companyName) => `You are a Physical AI investment research assistant. Research the company named "${companyName}".

Return a strict JSON object (no markdown, no preamble, no trailing text) with this exact shape:

{
  "name": "Official company name",
  "overview": "1-2 sentence factual summary of what the company does. No hype.",
  "subsector": "ONE of: ${ALLOWED_SUBSECTORS.join(" | ")}",
  "geography": "Country of headquarters (e.g. 'United States', 'Germany', 'China')",
  "website": "https://...",
  "suggestedActivity": {
    "dateAnnounced": "YYYY-MM-DD of the most recent funding round, M&A, or significant commercial milestone you are confident about",
    "activityType": "ONE of: financing | m&a | partnership | customer contract | product launch | infrastructure | other",
    "dealValueUsd": null OR a number in USD,
    "counterparty": "Investors / acquirer / partner (comma-separated names). 'N/A' if none.",
    "description": "1-2 sentence factual description of the activity",
    "sourceUrl": "Best primary source URL (press release > SEC filing > major outlet article)",
    "sourceType": "ONE of: press release | SEC filing | article | company blog | other",
    "confidence": "confirmed if company-disclosed, reported if press-cited, estimated if you are inferring"
  },
  "additionalSources": ["url1", "url2"],
  "notes": "Optional: caveats about uncertainty, what you'd want a human to verify"
}

CRITICAL rules:
- If you are not confident the company exists or is a real Physical AI company, return {"error": "not found", "notes": "..."}
- Never fabricate URLs. If you can't recall a specific source URL, use the company's domain root.
- Use "estimated" confidence whenever you are inferring details rather than citing them.
- Output ONLY the JSON. No code fences, no explanation.`;

function parseModelJson(text) {
    const raw = String(text || "").trim();
    if (!raw) throw new Error("empty model response");

    const unfenced = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    try {
        return JSON.parse(unfenced);
    } catch {
        const start = unfenced.indexOf("{");
        const end = unfenced.lastIndexOf("}");
        if (start >= 0 && end > start) {
            return JSON.parse(unfenced.slice(start, end + 1));
        }
        throw new Error("model response was not parseable JSON");
    }
}

function normalizeActivity(activity) {
    if (!activity || typeof activity !== "object") return null;
    const allowedActivityTypes = ["financing", "m&a", "partnership", "customer contract", "product launch", "infrastructure", "other"];
    const allowedSourceTypes = ["press release", "SEC filing", "article", "company blog", "other"];
    const allowedConfidence = ["confirmed", "reported", "estimated"];
    return {
        dateAnnounced: typeof activity.dateAnnounced === "string" ? activity.dateAnnounced : "",
        activityType: allowedActivityTypes.includes(activity.activityType) ? activity.activityType : "other",
        dealValueUsd: typeof activity.dealValueUsd === "number" && Number.isFinite(activity.dealValueUsd) ? activity.dealValueUsd : null,
        counterparty: String(activity.counterparty || "N/A"),
        description: String(activity.description || ""),
        sourceUrl: typeof activity.sourceUrl === "string" && /^https?:\/\//.test(activity.sourceUrl) ? activity.sourceUrl : "",
        sourceType: allowedSourceTypes.includes(activity.sourceType) ? activity.sourceType : "other",
        confidence: allowedConfidence.includes(activity.confidence) ? activity.confidence : "estimated"
    };
}

async function generateWithFallback(apiKey, prompt) {
    let lastError = null;
    for (const model of MODEL_CANDIDATES) {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 4096,
                        responseMimeType: "application/json"
                    }
                })
            }
        );
        const data = await response.json();
        if (response.ok) return { model, data };
        lastError = { status: response.status, data, model };
        if (![429, 500, 502, 503, 504].includes(response.status)) break;
    }
    return { error: lastError };
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured in Vercel environment" });
    }

    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            body = {};
        }
    }
    const name = (body && body.name) ? String(body.name).trim() : "";
    if (!name) {
        return res.status(400).json({ error: "Missing 'name' in request body" });
    }
    if (name.length > 120) {
        return res.status(400).json({ error: "Name too long" });
    }

    try {
        const generated = await generateWithFallback(apiKey, PROMPT(name));
        if (generated.error) {
            return res.status(generated.error.status || 502).json({
                error: "Gemini error",
                model: generated.error.model,
                detail: generated.error.data
            });
        }
        const { data, model } = generated;

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        let parsed;
        try {
            parsed = parseModelJson(text);
        } catch (err) {
            return res.status(502).json({ error: "Model did not return valid JSON", raw: text });
        }

        if (parsed.error) {
            return res.status(404).json({ error: parsed.error, notes: parsed.notes });
        }

        // Normalise / validate the shape so the frontend can rely on it.
        const subsector = ALLOWED_SUBSECTORS.includes(parsed.subsector) ? parsed.subsector : "other";
        const candidate = {
            name: String(parsed.name || name),
            overview: String(parsed.overview || ""),
            subsector,
            geography: String(parsed.geography || ""),
            website: typeof parsed.website === "string" && /^https?:\/\//.test(parsed.website) ? parsed.website : undefined,
            suggestedActivity: normalizeActivity(parsed.suggestedActivity),
            additionalSources: Array.isArray(parsed.additionalSources)
                ? parsed.additionalSources.filter((url) => typeof url === "string" && /^https?:\/\//.test(url)).slice(0, 6)
                : [],
            notes: parsed.notes ? String(parsed.notes) : null,
            generatedAt: new Date().toISOString(),
            model
        };

        return res.status(200).json({ ok: true, candidate });
    } catch (error) {
        return res.status(500).json({ error: "Unexpected server error", detail: String(error) });
    }
}

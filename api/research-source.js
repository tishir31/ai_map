// Vercel Serverless Function — Physical AI source-link extractor.
// POST /api/research-source { url: string, sourceText?: string }
// Returns a Review Queue candidate shape. The frontend stages it for manual
// approval; this function never writes directly to the tracker.

const ALLOWED_ACTIVITY_TYPES = ["financing", "m&a", "partnership", "customer contract", "product launch", "infrastructure", "other"];
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
const ALLOWED_SOURCE_TYPES = ["press release", "SEC filing", "article", "company blog", "other"];
const ALLOWED_CONFIDENCE = ["confirmed", "reported", "estimated"];

function stripHtml(html) {
    return String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function fetchSourceText(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
        const response = await fetch(url, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "user-agent": "physical-ai-market-tracker-link-analyzer/1.0"
            }
        });
        const contentType = response.headers.get("content-type") || "";
        const raw = await response.text();
        const text = contentType.includes("text/html") ? stripHtml(raw) : raw.replace(/\s+/g, " ").trim();
        return {
            ok: response.ok,
            status: response.status,
            finalUrl: response.url,
            text: text.slice(0, 18000)
        };
    } catch (error) {
        return {
            ok: false,
            status: null,
            finalUrl: url,
            text: "",
            error: String(error)
        };
    } finally {
        clearTimeout(timer);
    }
}

const PROMPT = ({ url, fetched, sourceText }) => `You are a Physical AI investment banking research assistant extracting ONE candidate activity from a source.

Source URL: ${url}
Fetch status: ${fetched.status ?? "unavailable"}
Fetched URL: ${fetched.finalUrl || url}

User-provided source text:
${sourceText || "(none)"}

Fetched page text:
${fetched.text || "(none)"}

Return strict JSON only, no markdown, with this shape:
{
  "candidateCompany": "Company primarily involved, or N/A if unknown",
  "candidateCounterparty": "Investor/acquirer/customer/partner, or N/A",
  "candidateDate": "YYYY-MM-DD date announced or source publication date; if truly unknown use today's date",
  "activityType": "ONE of: ${ALLOWED_ACTIVITY_TYPES.join(" | ")}",
  "subsector": "ONE of: ${ALLOWED_SUBSECTORS.join(" | ")}",
  "dealValueUsd": null OR number in USD",
  "geography": "Country/region, or N/A",
  "description": "One factual sentence. No hype. Say when financial terms are undisclosed.",
  "sourceType": "ONE of: ${ALLOWED_SOURCE_TYPES.join(" | ")}",
  "confidence": "confirmed | reported | estimated",
  "snippet": "Short source-backed snippet, no more than 200 characters",
  "extractedText": "Short source excerpt or summary for analyst review, no more than 500 characters",
  "notes": "Caveats, especially if the source text is thin/paywalled"
}

Rules:
- Never invent a company, amount, counterparty, or date. Use N/A/null and explain caveats in notes.
- Use confirmed only for company press releases, SEC filings, or direct company blogs.
- Use reported for credible articles/newsletters.
- Use estimated for inference or thin/paywalled text.
- Keep the candidate focused on robotics, humanoids, AVs, drones, defense autonomy, industrial automation, embodied AI, edge AI hardware, sensors, autonomy infrastructure, or adjacent Physical AI supply chain.
- Output JSON only.`;

function normalized(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(204).end();
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured in Vercel environment" });

    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            body = {};
        }
    }

    const url = body?.url ? String(body.url).trim() : "";
    const sourceText = body?.sourceText ? String(body.sourceText).trim().slice(0, 18000) : "";
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: "Missing valid http(s) URL" });
    if (url.length > 2000) return res.status(400).json({ error: "URL too long" });

    try {
        const fetched = await fetchSourceText(url);
        if (!sourceText && !fetched.text) {
            return res.status(422).json({ error: "Could not read source text. Paste the relevant excerpt and try again.", fetchStatus: fetched.status, detail: fetched.error });
        }

        const model = "gemini-2.5-flash";
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: PROMPT({ url, fetched, sourceText }) }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 1200,
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: "Gemini error", detail: data });
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            return res.status(502).json({ error: "Model did not return valid JSON", raw: text });
        }

        const today = new Date().toISOString().slice(0, 10);
        const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.candidateDate) ? parsed.candidateDate : today;
        const candidate = {
            candidateCompany: String(parsed.candidateCompany || "N/A"),
            candidateCounterparty: String(parsed.candidateCounterparty || "N/A"),
            candidateDate: date,
            activityType: normalized(parsed.activityType, ALLOWED_ACTIVITY_TYPES, "other"),
            subsector: normalized(parsed.subsector, ALLOWED_SUBSECTORS, "other"),
            dealValueUsd: typeof parsed.dealValueUsd === "number" && Number.isFinite(parsed.dealValueUsd) ? parsed.dealValueUsd : null,
            geography: String(parsed.geography || "N/A"),
            description: String(parsed.description || "N/A"),
            sourceType: normalized(parsed.sourceType, ALLOWED_SOURCE_TYPES, "article"),
            confidence: normalized(parsed.confidence, ALLOWED_CONFIDENCE, "estimated"),
            snippet: String(parsed.snippet || "").slice(0, 240),
            extractedText: String(parsed.extractedText || parsed.description || "").slice(0, 650),
            notes: parsed.notes ? String(parsed.notes) : null,
            generatedAt: new Date().toISOString(),
            model
        };

        return res.status(200).json({ ok: true, candidate, fetchStatus: fetched.status, finalUrl: fetched.finalUrl });
    } catch (error) {
        return res.status(500).json({ error: "Unexpected server error", detail: String(error) });
    }
}

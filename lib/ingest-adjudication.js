"use strict";

const MAX_REASONABLE_DEAL_VALUE_USD = 1_000_000_000_000_000;

function normalizedConfidence(value) {
  return String(value || "").trim().toLowerCase();
}

function compactEvidenceText(parts) {
  return (Array.isArray(parts) ? parts : [parts])
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\bus\s*\$/g, "$")
    .replace(/\busd\s*/g, "$")
    .replace(/\s+/g, " ")
    .trim();
}

function escapedDecimal(value) {
  return String(value).replace(/\.0+$/, "").replace(".", "\\.");
}

function usdValuePatternSources(value) {
  const rounded = String(Math.round(value));
  const patterns = [`(?:^|[^\\d])(?:\\$\\s*)?${rounded}(?!\\d)`];
  const units = [
    [1_000_000_000_000, "(?:t|tn|trillion)"],
    [1_000_000_000, "(?:b|bn|billion)"],
    [1_000_000, "(?:m|mm|million)"],
    [1_000, "(?:k|thousand)"]
  ];
  for (const [divisor, label] of units) {
    if (value < divisor) continue;
    const scaled = value / divisor;
    if (!Number.isFinite(scaled) || Math.abs(scaled - Number(scaled.toFixed(3))) > 0.000001) continue;
    const amount = escapedDecimal(Number(scaled.toFixed(3)));
    patterns.push(`(?:^|[^\\d])(?:\\$\\s*)?${amount}\\s*${label}\\b`);
  }
  return patterns;
}

function exactValueMentions(value, text) {
  const mentions = [];
  const seen = new Set();
  for (const source of usdValuePatternSources(value)) {
    const matcher = new RegExp(source, "g");
    let match;
    while ((match = matcher.exec(text)) !== null) {
      const leadingContext = match[0].match(/^[^\d$]+/u)?.[0]?.length || 0;
      const start = match.index + leadingContext;
      const end = match.index + match[0].length;
      const key = `${start}:${end}`;
      if (!seen.has(key)) {
        mentions.push({ start, end });
        seen.add(key);
      }
      if (match[0].length === 0) matcher.lastIndex += 1;
    }
  }
  return mentions.sort((a, b) => a.start - b.start || a.end - b.end);
}

function evidenceSupportsUsdValue(value, evidenceParts) {
  const text = compactEvidenceText(evidenceParts);
  return text ? exactValueMentions(value, text).length > 0 : false;
}

function allMoneyMentions(text) {
  const matcher = /(?:\$\s*)?\d+(?:\.\d+)?\s*(?:t|tn|trillion|b|bn|billion|m|mm|million|k|thousand)\b|\$\s*\d+(?:\.\d+)?|\b\d{5,}\b/g;
  const mentions = [];
  let match;
  while ((match = matcher.exec(text)) !== null) mentions.push({ start: match.index, end: match.index + match[0].length });
  return mentions;
}

function sentenceBoundaryBefore(text, index) {
  const boundary = Math.max(text.lastIndexOf(".", index - 1), text.lastIndexOf(";", index - 1), text.lastIndexOf("\n", index - 1));
  return boundary < 0 ? 0 : boundary + 1;
}

function sentenceBoundaryAfter(text, index) {
  const candidates = [text.indexOf(".", index), text.indexOf(";", index), text.indexOf("\n", index)].filter((value) => value >= 0);
  return candidates.length === 0 ? text.length : Math.min(...candidates);
}

function sourceSupportsFinancingProceeds(value, sourceEvidenceParts) {
  const text = compactEvidenceText(sourceEvidenceParts);
  if (!text) return false;
  const exactMentions = exactValueMentions(value, text);
  if (exactMentions.length === 0) return false;
  const moneyMentions = allMoneyMentions(text);
  const positive = /\b(rais(?:e|es|ed|ing)|funding|financing|financed|round|proceeds|investment|invested|backed|secured|closed|capital|equity|seed|series\s+[a-h]|extension)\b/i;
  const disqualifying = /\b(valuation|valued|values?|post[-\s]?money|pre[-\s]?money|guarantee(?:d)?|target(?:ing|ed)?|seeking|sought|contract|award(?:ed)?|facility\s+size)\b/i;

  return exactMentions.some((mention) => {
    const previousAmount = [...moneyMentions].reverse().find((other) => other.end <= mention.start);
    const nextAmount = moneyMentions.find((other) => other.start >= mention.end);
    const left = Math.max(
      sentenceBoundaryBefore(text, mention.start),
      previousAmount?.end || 0,
      mention.start - 120
    );
    const right = Math.min(
      sentenceBoundaryAfter(text, mention.end),
      nextAmount?.start ?? text.length,
      mention.end + 120
    );
    const context = text.slice(left, right);
    return positive.test(context) && !disqualifying.test(context);
  });
}

function sourceBackedDealValueUsd(value, confidence, modelEvidenceParts, sourceEvidenceParts = modelEvidenceParts) {
  if (normalizedConfidence(confidence) !== "reported") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value > MAX_REASONABLE_DEAL_VALUE_USD) return null;
  if (!evidenceSupportsUsdValue(value, modelEvidenceParts)) return null;
  return sourceSupportsFinancingProceeds(value, sourceEvidenceParts) ? value : null;
}

function deterministicDuplicateAgreement({ action, requestedId, candidate, context, findExistingActivity }) {
  if (action !== "update_existing" || !requestedId || typeof findExistingActivity !== "function") return null;
  const deterministicMatch = findExistingActivity(candidate, context);
  if (!deterministicMatch?.activity?.id) return null;
  return String(deterministicMatch.activity.id) === String(requestedId)
    ? deterministicMatch.activity.id
    : null;
}

module.exports = {
  deterministicDuplicateAgreement,
  evidenceSupportsUsdValue,
  sourceSupportsFinancingProceeds,
  sourceBackedDealValueUsd
};

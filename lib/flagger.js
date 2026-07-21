// Pure rules-engine functions — no AI involved. Deterministic, testable, explainable.
// This is intentionally boring and readable: every output should be traceable
// back to a specific row in data/interactions.json.

import supplements from "../data/supplements.json";
import interactions from "../data/interactions.json";

/**
 * @param {{id: string, period: "AM"|"PM", amount?: number}[]} stack
 * @returns {object[]} matched interaction/timing flags
 */
export function getFlags(stack) {
  const idsPresent = new Set(stack.map((s) => s.id));
  return interactions.filter(
    (rule) => idsPresent.has(rule.pair[0]) && idsPresent.has(rule.pair[1])
  );
}

/**
 * @param {{id: string, period: "AM"|"PM", amount?: number}[]} stack
 * @returns {object[]} reference-limit rows for items currently in the stack
 */
export function getReferenceLimits(stack) {
  const idsPresent = new Set(stack.map((s) => s.id));
  return supplements.filter((s) => idsPresent.has(s.id));
}

/**
 * Sums each supplement's amount across AM+PM (upper limits are daily totals,
 * regardless of how the dose is split across the day) and flags any
 * supplement whose total exceeds its reference upperLimitValue.
 * @param {{id: string, period: "AM"|"PM", amount?: number}[]} stack
 * @returns {object[]} dose flags, one per supplement whose daily total exceeds its upper limit
 */
export function getDoseFlags(stack) {
  const totals = new Map();
  for (const item of stack) {
    if (typeof item.amount !== "number" || !(item.amount > 0)) continue;
    totals.set(item.id, (totals.get(item.id) || 0) + item.amount);
  }

  const flags = [];
  for (const [id, total] of totals) {
    const supplement = getSupplement(id);
    if (!supplement || supplement.upperLimitValue == null) continue;
    if (total > supplement.upperLimitValue) {
      flags.push({
        id,
        name: supplement.name,
        total,
        unit: supplement.unit,
        upperLimitValue: supplement.upperLimitValue,
        severity: "over-limit",
        text: `${total} ${supplement.unit}/day exceeds the reference upper limit of ${supplement.upperLimitValue} ${supplement.unit}/day (${supplement.upperLimit}).`,
        overLimitRisk: supplement.overLimitRisk ?? null,
      });
    }
  }
  return flags;
}

/**
 * Flags supplements in the stack that are likely redundant with a
 * combination product also in the stack (e.g. a standalone B12 supplement
 * alongside a multivitamin that typically already contains B12).
 * @param {{id: string, period: "AM"|"PM", amount?: number}[]} stack
 * @returns {object[]} redundancy flags, one per (container, ingredient) overlap present in the stack
 */
export function getRedundancyFlags(stack) {
  const idsPresent = new Set(stack.map((s) => s.id));
  const flags = [];
  for (const container of supplements) {
    if (!container.typicallyContains || !idsPresent.has(container.id)) continue;
    for (const ingredientId of container.typicallyContains) {
      if (!idsPresent.has(ingredientId)) continue;
      const ingredient = getSupplement(ingredientId);
      flags.push({
        id: ingredientId,
        name: ingredient?.name ?? ingredientId,
        containerId: container.id,
        containerName: container.name,
        severity: "redundant",
        text: `${ingredient?.name ?? ingredientId} is commonly already included in ${container.name}; check the label to avoid an unintentionally doubled dose.`,
      });
    }
  }
  return flags;
}

/**
 * Lookup a single supplement's full reference row by id.
 * @param {string} id
 */
export function getSupplement(id) {
  return supplements.find((s) => s.id === id) || null;
}

export { supplements, interactions };

"use client";

import { useMemo, useState } from "react";
import {
  getDoseFlags,
  getFlags,
  getReferenceLimits,
  getRedundancyFlags,
  supplements,
} from "@/lib/flagger";

type Period = "AM" | "PM";
type StackItem = { id: string; period: Period; amount?: number };
type SupplementRow = (typeof supplements)[number];
type InteractionFlag = { pair: [string, string]; severity: string; text: string };
type DoseFlag = {
  id: string;
  name: string;
  total: number;
  unit: string;
  upperLimitValue: number;
  severity: string;
  text: string;
  overLimitRisk: string | null;
};
type RedundancyFlag = {
  id: string;
  name: string;
  containerId: string;
  containerName: string;
  severity: string;
  text: string;
};

const SEVERITY_STYLES: Record<string, string> = {
  "over-limit":
    "border-red-300 bg-red-100 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  redundant:
    "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  good: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  note: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  warn: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
};

const sortedSupplements = [...supplements].sort((a, b) =>
  a.name.localeCompare(b.name)
);

function nameFor(id: string) {
  return supplements.find((s) => s.id === id)?.name ?? id;
}

function isValidAmount(raw: string | undefined) {
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}

export default function Home() {
  const [stack, setStack] = useState<StackItem[]>([]);
  const [draftId, setDraftId] = useState<Record<Period, string>>({
    AM: "",
    PM: "",
  });
  const [draftAmount, setDraftAmount] = useState<Record<Period, string>>({
    AM: "",
    PM: "",
  });

  const flags = useMemo(() => getFlags(stack) as InteractionFlag[], [stack]);
  const doseFlags = useMemo(
    () => getDoseFlags(stack) as DoseFlag[],
    [stack]
  );
  const redundancyFlags = useMemo(
    () => getRedundancyFlags(stack) as RedundancyFlag[],
    [stack]
  );
  const referenceRows = useMemo(
    () => getReferenceLimits(stack) as SupplementRow[],
    [stack]
  );

  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of stack) {
      if (typeof item.amount !== "number") continue;
      totals.set(item.id, (totals.get(item.id) ?? 0) + item.amount);
    }
    return totals;
  }, [stack]);

  function addToPeriod(period: Period) {
    const id = draftId[period];
    if (!id) return;
    const supplement = supplements.find((s) => s.id === id);
    if (supplement?.unit && !isValidAmount(draftAmount[period])) return;
    const amount = supplement?.unit ? Number(draftAmount[period]) : undefined;

    setStack((prev) => [
      ...prev.filter((item) => !(item.id === id && item.period === period)),
      { id, period, amount },
    ]);
    setDraftId((prev) => ({ ...prev, [period]: "" }));
    setDraftAmount((prev) => ({ ...prev, [period]: "" }));
  }

  function removeFrom(id: string, period: Period) {
    setStack((prev) =>
      prev.filter((item) => !(item.id === id && item.period === period))
    );
  }

  const am = stack.filter((s) => s.period === "AM");
  const pm = stack.filter((s) => s.period === "PM");

  return (
    <div className="min-h-full">
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-12">
        <header>
          <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            VitaCalc
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Enter the dose you actually take for each supplement and add it to
            a morning or evening list to check it against reference upper
            limits and timing/interaction flags. Informational only — not
            medical advice.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <PeriodSection
            title="Morning"
            dotColorClass="bg-amber-500"
            items={am}
            draftId={draftId.AM}
            draftAmount={draftAmount.AM}
            onDraftIdChange={(id) =>
              setDraftId((prev) => ({ ...prev, AM: id }))
            }
            onDraftAmountChange={(amount) =>
              setDraftAmount((prev) => ({ ...prev, AM: amount }))
            }
            onAdd={() => addToPeriod("AM")}
            onRemove={(id) => removeFrom(id, "AM")}
          />
          <PeriodSection
            title="Evening"
            dotColorClass="bg-blue-900"
            items={pm}
            draftId={draftId.PM}
            draftAmount={draftAmount.PM}
            onDraftIdChange={(id) =>
              setDraftId((prev) => ({ ...prev, PM: id }))
            }
            onDraftAmountChange={(amount) =>
              setDraftAmount((prev) => ({ ...prev, PM: amount }))
            }
            onAdd={() => addToPeriod("PM")}
            onRemove={(id) => removeFrom(id, "PM")}
          />
        </section>

        <section>
          <SectionHeader title="Dose Safety Flags" dotColorClass="bg-red-500" />
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-500">
            General information only — not a substitute for medical advice.
          </p>
          {doseFlags.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              No supplement in your stack currently exceeds its daily
              reference upper limit.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {doseFlags.map((flag) => (
                <li
                  key={flag.id}
                  className={`rounded-md border px-3 py-2 text-sm ${SEVERITY_STYLES["over-limit"]}`}
                >
                  <p className="font-medium">⚠ {flag.name} — over daily limit</p>
                  <p className="mt-0.5">{flag.text}</p>
                  <p className="mt-1 italic opacity-90">
                    {flag.overLimitRisk ??
                      "Specific risk details aren't in our data yet for this supplement — check the NIH ODS fact sheet or a healthcare provider before continuing at this dose."}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader title="Redundancy Flags" dotColorClass="bg-indigo-500" />
          {redundancyFlags.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              No likely duplicate ingredients across your combination
              products and standalone supplements.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {redundancyFlags.map((flag) => (
                <li
                  key={`${flag.containerId}-${flag.id}`}
                  className={`rounded-md border px-3 py-2 text-sm ${SEVERITY_STYLES.redundant}`}
                >
                  <p className="font-medium">
                    {flag.name} + {flag.containerName}
                  </p>
                  <p className="mt-0.5">{flag.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader
            title="Timing & Interaction Flags"
            dotColorClass="bg-sky-600"
          />
          {flags.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              No timing or interaction flags for the current stack.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {flags.map((flag) => (
                <li
                  key={`${flag.pair[0]}-${flag.pair[1]}`}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    SEVERITY_STYLES[flag.severity] ?? SEVERITY_STYLES.note
                  }`}
                >
                  <p className="font-medium">
                    {nameFor(flag.pair[0])} + {nameFor(flag.pair[1])}
                  </p>
                  <p className="mt-0.5">{flag.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {referenceRows.length > 0 && (
          <section>
            <SectionHeader title="Reference Limits" dotColorClass="bg-zinc-400" />
            <div className="overflow-x-auto rounded-lg border border-paper-border bg-paper p-4 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                    <th className="pb-2 pr-4">Supplement</th>
                    <th className="pb-2 pr-4">Your dose</th>
                    <th className="pb-2 pr-4">Upper limit</th>
                    <th className="pb-2 pr-4">RDA</th>
                    <th className="pb-2">Timing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {referenceRows.map((row) => {
                    const total = dailyTotals.get(row.id);
                    const over =
                      row.upperLimitValue != null &&
                      total != null &&
                      total > row.upperLimitValue;
                    return (
                      <tr key={row.id} className="align-top">
                        <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {row.name}
                        </td>
                        <td
                          className={`py-2 pr-4 ${
                            over
                              ? "font-semibold text-red-700 dark:text-red-400"
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {total != null ? `${total} ${row.unit}/day` : "—"}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                          {row.upperLimit}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                          {row.rda}
                        </td>
                        <td className="py-2 text-zinc-700 dark:text-zinc-300">
                          {row.timing}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function SectionHeader({
  title,
  dotColorClass,
}: {
  title: string;
  dotColorClass: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColorClass}`} />
      <h2 className="font-serif text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <span className="h-px flex-1 bg-paper-border" />
    </div>
  );
}

function FatSolubleBadge() {
  return (
    <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      fat-soluble
    </span>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeriodSection({
  title,
  dotColorClass,
  items,
  draftId,
  draftAmount,
  onDraftIdChange,
  onDraftAmountChange,
  onAdd,
  onRemove,
}: {
  title: string;
  dotColorClass: string;
  items: StackItem[];
  draftId: string;
  draftAmount: string;
  onDraftIdChange: (id: string) => void;
  onDraftAmountChange: (amount: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const availableSupplements = sortedSupplements.filter(
    (s) => !items.some((item) => item.id === s.id)
  );
  const draftSupplement = supplements.find((s) => s.id === draftId);
  const trackable = Boolean(draftSupplement?.unit);
  const canAdd = Boolean(draftId) && (!trackable || isValidAmount(draftAmount));

  return (
    <div>
      <SectionHeader title={title} dotColorClass={dotColorClass} />
      <div className="mb-3 flex items-center gap-2">
        <select
          value={draftId}
          onChange={(e) => onDraftIdChange(e.target.value)}
          aria-label={`Add a supplement to ${title}`}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Add a supplement…</option>
          {availableSupplements.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {trackable && (
          <div className="flex shrink-0 items-center gap-1">
            <input
              type="number"
              min="0"
              step="any"
              value={draftAmount}
              onChange={(e) => onDraftAmountChange(e.target.value)}
              placeholder="0"
              aria-label={`Dose amount for ${draftSupplement?.name}`}
              className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              {draftSupplement?.unit}
            </span>
          </div>
        )}
        <button
          type="button"
          disabled={!canAdd}
          onClick={onAdd}
          className="shrink-0 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-500">Empty</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const supplement = supplements.find((s) => s.id === item.id);
            return (
              <li
                key={item.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-paper-border bg-paper px-3 py-2.5 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {nameFor(item.id)}
                    </span>
                    {supplement?.fatSoluble && <FatSolubleBadge />}
                  </div>
                  {(item.amount != null || supplement?.timing) && (
                    <p className="mt-1 flex items-center gap-1 font-mono text-xs text-zinc-500 dark:text-zinc-500">
                      <ClockIcon />
                      {item.amount != null
                        ? `${item.amount} ${supplement?.unit} · `
                        : ""}
                      {supplement?.timing}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${nameFor(item.id)}`}
                  className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

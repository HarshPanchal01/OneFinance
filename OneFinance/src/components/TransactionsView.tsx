import { useEffect, useMemo, useState } from "react";
import type {
  Category,
  LedgerPeriod,
  Transaction,
  TransactionType,
} from "../types";
import { monthName } from "../lib/date";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function defaultDateForPeriod(period: LedgerPeriod) {
  // Pick a deterministic default inside the selected month.
  return `${period.year}-${pad2(period.month)}-01`;
}

export function TransactionsView(props: {
  period: LedgerPeriod | null;
  categories: Category[];
  transactions: Transaction[];
  onCreate: (input: {
    ledgerPeriodId: number;
    title: string;
    amount: number;
    date: string;
    type: TransactionType;
    notes?: string | null;
    categoryId?: number | null;
  }) => Promise<void>;
  onUpdate: (input: {
    id: number;
    ledgerPeriodId: number;
    title: string;
    amount: number;
    date: string;
    type: TransactionType;
    notes?: string | null;
    categoryId?: number | null;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const period = props.period;

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("2000-01-01");
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const defaultDate = useMemo(() => {
    if (!period) return "2000-01-01";
    return defaultDateForPeriod(period);
  }, [period]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of props.transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [props.transactions]);

  useEffect(() => {
    if (!period) return;
    setEditingId(null);
    setShowEditor(false);
    setTitle("");
    setAmount("");
    setDate(defaultDate);
    setType("expense");
    setCategoryId("");
    setNotes("");
    setError(null);
  }, [period, defaultDate]);

  const resetEditor = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setDate(defaultDate);
    setType("expense");
    setCategoryId("");
    setNotes("");
    setError(null);
    setShowEditor(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setDate(defaultDate);
    setType("expense");
    setCategoryId("");
    setNotes("");
    setError(null);
    setShowEditor(true);
  };

  if (!period) {
    return (
      <section className="p-5">
        <div className="of-title">Pick a Month</div>
        <div className="text-sm text-zinc-400">
          Select a month from the left sidebar to view and edit transactions.
        </div>
      </section>
    );
  }

  const periodId = period.id;

  const periodTitle = `${monthName(period.month)} ${period.year}`;

  const onSubmit = async () => {
    setError(null);
    try {
      const a = Number(amount);
      if (!title.trim()) throw new Error("Title is required");
      if (!Number.isFinite(a)) throw new Error("Amount must be a number");
      if (!date.trim()) throw new Error("Date is required");

      const parsedCategoryId = categoryId ? Number(categoryId) : null;
      if (categoryId && !Number.isInteger(parsedCategoryId))
        throw new Error("Invalid category");

      if (editingId) {
        await props.onUpdate({
          id: editingId,
          ledgerPeriodId: periodId,
          title: title.trim(),
          amount: a,
          date,
          type,
          notes: notes.trim() ? notes.trim() : null,
          categoryId: parsedCategoryId,
        });
      } else {
        await props.onCreate({
          ledgerPeriodId: periodId,
          title: title.trim(),
          amount: a,
          date,
          type,
          notes: notes.trim() ? notes.trim() : null,
          categoryId: parsedCategoryId,
        });
      }

      resetEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save transaction");
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="of-panel p-3">
        <div className="of-panelHeader">
          <div>
            <div className="of-title">{periodTitle}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="of-pill bg-zinc-950/40">
                <span className="text-xs text-zinc-400">Net</span>{" "}
                <span className="font-mono text-sm">{summary.net.toFixed(2)}</span>
              </span>
              <span className="of-pill bg-zinc-950/40">
                <span className="text-xs text-zinc-400">Income</span>{" "}
                <span className="font-mono text-sm text-emerald-400">
                  {summary.income.toFixed(2)}
                </span>
              </span>
              <span className="of-pill bg-zinc-950/40">
                <span className="text-xs text-zinc-400">Expense</span>{" "}
                <span className="font-mono text-sm text-rose-400">
                  {summary.expense.toFixed(2)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="of-btn"
              onClick={() => {
                if (showEditor) resetEditor();
                else openCreate();
              }}
              title={showEditor ? "Close" : "Add transaction"}
              aria-label={showEditor ? "Close" : "Add transaction"}
            >
              <span className="text-base leading-none">{showEditor ? "×" : "＋"}</span>
              <span>{showEditor ? "Close" : "Add"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="of-error mb-3">{error}</div>
        )}

        {showEditor && (
          <div className="of-panel bg-zinc-950/40 p-3">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <label className="mb-1.5 block text-xs text-zinc-400">
                  Type
                </label>
                <select
                  className="of-input"
                  value={type}
                  onChange={(e) => setType(e.target.value as TransactionType)}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div className="col-span-5">
                <label className="mb-1.5 block text-xs text-zinc-400">
                  Title
                </label>
                <input
                  className="of-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Groceries"
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1.5 block text-xs text-zinc-400">
                  Amount
                </label>
                <input
                  className="of-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 45.50"
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1.5 block text-xs text-zinc-400">
                  Date
                </label>
                <input
                  className="of-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="col-span-4">
                <label className="mb-1.5 block text-xs text-zinc-400">
                  Category
                </label>
                <select
                  className="of-input"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">(none)</option>
                  {props.categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-8">
                <label className="mb-1.5 block text-xs text-zinc-400">
                  Notes
                </label>
                <input
                  className="of-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="col-span-full">
                <div className="flex items-center gap-2">
                  <button
                    className="of-btn"
                    onClick={onSubmit}
                  >
                    {editingId ? "Update" : "Add"}
                  </button>
                  <button
                    className="of-btn"
                    onClick={resetEditor}
                  >
                    Cancel
                  </button>
                  <div className="text-xs text-zinc-400">
                    This transaction will appear in the month matching its date.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="of-panel p-3">
        <div className="of-panelHeader">
          <div>
            <div className="of-title">Transactions</div>
            <div className="of-subtitle">{props.transactions.length} record(s)</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-[920px] flex-col gap-2">
            <div className="of-tableHeader grid-cols-[140px_1.3fr_1fr_140px_220px] max-[900px]:grid-cols-[120px_1.3fr_1fr_110px_180px]">
              <div>Date</div>
              <div>Title</div>
              <div>Category</div>
              <div className="text-right">Amount</div>
              <div></div>
            </div>

            {props.transactions.map((t) => (
              <div
                key={t.id}
                className="of-tableRow grid-cols-[140px_1.3fr_1fr_140px_220px] max-[900px]:grid-cols-[120px_1.3fr_1fr_110px_180px]"
              >
                <div className="font-mono">{t.date}</div>
                <div>
                  <div>{t.title}</div>
                  {t.notes && (
                    <div className="text-xs text-zinc-400">{t.notes}</div>
                  )}
                </div>
                <div className="text-sm text-zinc-400">
                  {t.categoryName ?? "(none)"}
                </div>
                <div
                  className={
                    t.type === "income"
                      ? "text-right font-mono text-emerald-400"
                      : "text-right font-mono text-rose-400"
                  }
                >
                  {t.type === "income" ? "+" : "-"}
                  {t.amount.toFixed(2)}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    className="of-iconBtn"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => {
                      setEditingId(t.id);
                      setTitle(t.title);
                      setAmount(String(t.amount));
                      setDate(t.date);
                      setType(t.type);
                      setCategoryId(t.categoryId ? String(t.categoryId) : "");
                      setNotes(t.notes ?? "");
                      setError(null);
                      setShowEditor(true);
                    }}
                  >
                    <span className="text-base leading-none">✎</span>
                  </button>
                  <button
                    className="of-iconBtn of-iconBtnDanger"
                    title="Delete"
                    aria-label="Delete"
                    onClick={async () => {
                      const ok = window.confirm(
                        `Delete transaction "${t.title}"?`
                      );
                      if (!ok) return;
                      await props.onDelete(t.id);
                    }}
                  >
                    <span className="text-base leading-none">🗑</span>
                  </button>
                </div>
              </div>
            ))}

            {props.transactions.length === 0 && (
              <div className="of-panel border-dashed bg-zinc-950/40 p-4 text-center">
                <div className="text-sm text-zinc-400">No transactions yet.</div>
                <div className="text-xs text-zinc-400">Click “Add” to create one.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

import type { RecentTransaction, Summary } from "../types";

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function DashboardView(props: {
  summary: Summary | null;
  recent: RecentTransaction[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="of-panel p-3">
        <div className="of-panelHeader">
          <div>
            <div className="of-title">Dashboard</div>
            <div className="of-subtitle">Totals and recent activity</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="of-panel bg-zinc-950/40 p-3">
            <div className="of-subtitle">Balance</div>
            <div className="font-mono">
              {props.summary ? formatMoney(props.summary.balance) : "…"}
            </div>
          </div>
          <div className="of-panel bg-zinc-950/40 p-3">
            <div className="of-subtitle">Income</div>
            <div className="font-mono text-emerald-400">
              {props.summary ? formatMoney(props.summary.incomeTotal) : "…"}
            </div>
          </div>
          <div className="of-panel bg-zinc-950/40 p-3">
            <div className="of-subtitle">Expense</div>
            <div className="font-mono text-rose-400">
              {props.summary ? formatMoney(props.summary.expenseTotal) : "…"}
            </div>
          </div>
        </div>
      </div>

      <div className="of-panel p-3">
        <div className="of-panelHeader">
          <div>
            <div className="of-title">Recent transactions</div>
            <div className="of-subtitle">Most recent entries across months</div>
          </div>
        </div>

        {props.recent.length === 0 ? (
          <div className="text-sm text-zinc-400">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-[720px] flex-col gap-2">
              <div className="of-tableHeader grid-cols-[120px_1.5fr_1fr_120px]">
                <div>Date</div>
                <div>Title</div>
                <div>Category</div>
                <div className="text-right">Amount</div>
              </div>

              {props.recent.map((t) => (
                <div
                  key={t.id}
                  className="of-tableRow grid-cols-[120px_1.5fr_1fr_120px]"
                >
                  <div className="font-mono">{t.date}</div>
                  <div>{t.title}</div>
                  <div className="text-sm text-zinc-400">
                    {t.categoryName ?? "—"}
                  </div>
                  <div
                    className={
                      t.type === "income"
                        ? "text-right font-mono text-emerald-400"
                        : "text-right font-mono text-rose-400"
                    }
                  >
                    {t.type === "income" ? "+" : "-"}
                    {formatMoney(Math.abs(t.amount))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { LedgerPeriod, LedgerYearNode } from "../types";
import { monthName } from "../lib/date";

export function Sidebar(props: {
  tree: LedgerYearNode[];
  selectedPeriodId: number | null;
  expandedYears: Record<number, boolean>;
  onToggleYear: (year: number) => void;
  onSelectPeriod: (period: LedgerPeriod) => void;
  onCreateYear: (year: number) => Promise<void>;
  onDeleteYear: (year: number) => Promise<void>;
  view: "dashboard" | "ledger" | "settings";
  onNavigate: (view: "dashboard" | "ledger" | "settings") => void;
}) {
  const [mode, setMode] = useState<"none" | "year">("none");
  const [yearText, setYearText] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<
    { open: false } | { open: true; x: number; y: number; year: number }
  >({ open: false });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedYear = useMemo(() => {
    const found = props.tree
      .flatMap((y) => y.months)
      .find((m) => m.id === props.selectedPeriodId);
    return found?.year ?? new Date().getFullYear();
  }, [props.tree, props.selectedPeriodId]);

  useEffect(() => {
    if (!menu.open) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setMenu({ open: false });
    };
    const onScroll = () => setMenu({ open: false });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu({ open: false });
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu.open]);

  return (
    <aside className="flex min-h-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 p-3">
        <div className="mb-2.5 flex items-center justify-between gap-2.5">
          <div className="text-sm font-semibold tracking-wide">One Finance</div>
          <div className="flex items-center gap-2">
            <button
              className="of-iconBtn h-8 w-8 border-transparent bg-transparent hover:border-zinc-700 hover:bg-zinc-900"
              onClick={() => {
                setError(null);
                setYearText(String(selectedYear));
                setMode(mode === "year" ? "none" : "year");
              }}
              title="New Year"
              aria-label="New Year"
            >
              <span className="text-base leading-none">📁＋</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="of-error mb-3">{error}</div>
        )}

        {mode === "year" && (
          <div className="flex items-center gap-2">
            <input
              className="of-input"
              value={yearText}
              onChange={(e) => setYearText(e.target.value)}
              placeholder="Year (e.g. 2025)"
            />
            <button
              className="of-btn"
              onClick={async () => {
                setError(null);
                const year = Number(yearText);
                if (!Number.isInteger(year)) {
                  setError("Invalid year");
                  return;
                }
                try {
                  await props.onCreateYear(year);
                  setMode("none");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Failed to create year"
                  );
                }
              }}
            >
              Create
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <button
          className={
            props.view === "dashboard"
              ? "of-navItem of-navItemActive mb-2.5"
              : "of-navItem mb-2.5"
          }
          onClick={() => props.onNavigate("dashboard")}
          title="Dashboard"
        >
          <span className="inline-block w-[18px]">🏠</span>
          <span>Home</span>
        </button>

        {props.tree.length === 0 ? (
          <div className="text-sm text-zinc-400">No years yet. Create one.</div>
        ) : (
          props.tree.map((node) => {
            const expanded = props.expandedYears[node.year] ?? true;
            return (
              <div key={node.year} className="mb-1.5">
                <button
                  className="of-navItem"
                  onClick={() => props.onToggleYear(node.year)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenu({
                      open: true,
                      x: e.clientX,
                      y: e.clientY,
                      year: node.year,
                    });
                  }}
                >
                  <span className="inline-block w-4">{expanded ? "▾" : "▸"}</span>
                  <span className="font-medium">{node.year}</span>
                </button>

                {expanded && (
                  <div className="flex flex-col gap-1 pl-4">
                    {node.months.length === 0 ? (
                      <div className="text-xs text-zinc-400">No months</div>
                    ) : (
                      node.months.map((m) => {
                        const active = m.id === props.selectedPeriodId;
                        return (
                          <button
                            key={m.id}
                            className={
                              active
                                ? "of-navItem of-navItemActive"
                                : "of-navItem"
                            }
                            onClick={() => {
                              if (props.view !== "ledger")
                                props.onNavigate("ledger");
                              props.onSelectPeriod(m);
                            }}
                          >
                            {monthName(m.month)}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-start border-t border-zinc-800 p-3">
        <button
          className={
            props.view === "settings"
              ? "of-iconBtn border-zinc-700 bg-zinc-900"
              : "of-iconBtn border-transparent bg-transparent hover:border-zinc-700 hover:bg-zinc-900"
          }
          onClick={() =>
            props.onNavigate(props.view === "settings" ? "ledger" : "settings")
          }
          title="Settings"
          aria-label="Settings"
        >
          <span className="text-base leading-none">⚙</span>
        </button>
      </div>

      {menu.open && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-xl border border-zinc-800 bg-zinc-950 p-1"
          style={{ top: menu.y, left: menu.x }}
        >
          <button
            className="of-btn of-btnDanger w-full justify-start border-transparent bg-transparent text-rose-200 hover:bg-zinc-900"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ open: false });
              setError(null);
              try {
                await props.onDeleteYear(menu.year);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to delete year"
                );
              }
            }}
          >
            Delete year
          </button>
        </div>
      )}
    </aside>
  );
}

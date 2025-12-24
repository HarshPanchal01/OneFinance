import { useMemo, useState } from "react";
import type { Category } from "../types";

export function CategoriesManager(props: {
  categories: Category[];
  onCreate: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...props.categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [props.categories]);

  return (
    <section className="of-panel p-3">
      <div className="of-panelHeader">
        <div>
          <div className="of-title">Categories</div>
          <div className="of-subtitle">Used to tag transactions</div>
        </div>
      </div>

      {error && (
        <div className="of-error mb-3">{error}</div>
      )}

      <div className="flex items-center gap-2">
        <input
          className="of-input"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          className="of-btn"
          onClick={async () => {
            setError(null);
            try {
              const name = newName.trim();
              if (!name) return;
              await props.onCreate(name);
              setNewName("");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Failed to create category"
              );
            }
          }}
        >
          Add
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {sorted.map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            onRename={props.onRename}
            onDelete={props.onDelete}
          />
        ))}

        {sorted.length === 0 && (
          <div className="text-sm text-zinc-400">No categories yet</div>
        )}
      </div>
    </section>
  );
}

function CategoryRow(props: {
  category: Category;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState(props.category.name);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[1fr_90px_90px] items-center gap-2">
      <input
        className="of-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        className="of-btn"
        onClick={async () => {
          setError(null);
          try {
            await props.onRename(props.category.id, name.trim());
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Failed to rename category"
            );
          }
        }}
      >
        Save
      </button>
      <button
        className="of-btn of-btnDanger"
        onClick={async () => {
          setError(null);
          const ok = window.confirm(
            `Delete category "${props.category.name}"? Transactions will keep but lose this category.`
          );
          if (!ok) return;
          try {
            await props.onDelete(props.category.id);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Failed to delete category"
            );
          }
        }}
      >
        Delete
      </button>
      {error && (
        <div className="of-error col-span-full mb-0 mt-2">{error}</div>
      )}
    </div>
  );
}

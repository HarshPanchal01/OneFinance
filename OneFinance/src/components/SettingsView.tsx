import type { Category } from "../types";
import { CategoriesManager } from "./CategoriesManager";

export type AppInfo = {
  name: string;
  version: string;
  userDataPath: string;
  dbFilePath: string;
};

export function SettingsView(props: {
  info: AppInfo | null;
  onOpenDbFolder: () => Promise<void>;
  onDeleteDb: () => Promise<void>;
  categories: Category[];
  onCreateCategory: (name: string) => Promise<void>;
  onRenameCategory: (id: number, name: string) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="of-panel p-3">
        <div className="of-panelHeader">
          <div>
            <div className="of-title">Settings</div>
            <div className="of-subtitle">App info and storage location</div>
          </div>
        </div>

        {!props.info ? (
          <div className="text-sm text-zinc-400">Loading…</div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <div className="text-xs text-zinc-400">App name</div>
              <div className="break-all font-mono">{props.info.name}</div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <div className="text-xs text-zinc-400">Version</div>
              <div className="break-all font-mono">{props.info.version}</div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <div className="text-xs text-zinc-400">DB file</div>
              <div className="break-all font-mono">{props.info.dbFilePath}</div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <div className="text-xs text-zinc-400">User data</div>
              <div className="break-all font-mono">{props.info.userDataPath}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="of-btn"
                onClick={props.onOpenDbFolder}
              >
                Open DB folder
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="of-panel p-3">
        <div className="of-panelHeader">
          <div>
            <div className="of-title">Developer</div>
            <div className="of-subtitle">Unsafe actions for development</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="of-btn of-btnDanger"
            onClick={async () => {
              const ok = window.confirm(
                "Delete the local database? The app will restart."
              );
              if (!ok) return;
              await props.onDeleteDb();
            }}
          >
            Delete DB (dev)
          </button>
          <div className="text-xs text-zinc-400">
            Deletes the SQLite file and relaunches the app.
          </div>
        </div>
      </div>

      <CategoriesManager
        categories={props.categories}
        onCreate={props.onCreateCategory}
        onRename={props.onRenameCategory}
        onDelete={props.onDeleteCategory}
      />
    </section>
  );
}

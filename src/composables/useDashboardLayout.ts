import { computed, ref } from "vue";
import {
  DASHBOARD_WIDGETS,
  DEFAULT_DETAIL_ORDER,
  type DashboardWidgetId,
} from "@/views/dashboard/widgets";

const STORAGE_KEY = "dashboardLayout";

export interface DashboardLayout {
  hidden: DashboardWidgetId[];
  detailOrder: DashboardWidgetId[];
}

const ALL_IDS = new Set(DASHBOARD_WIDGETS.map((w) => w.id));
const DEFAULT_DETAIL_SET = new Set(DEFAULT_DETAIL_ORDER);

// Module-singleton state so every consumer shares one reactive layout.
const hidden = ref<Set<DashboardWidgetId>>(new Set());
const detailOrder = ref<DashboardWidgetId[]>([...DEFAULT_DETAIL_ORDER]);
let loaded = false;

// Keep a saved order usable as the registry evolves: drop unknown ids and append
// any newly-added detail widget (so future widgets show up by default).
function normalizeDetailOrder(order: DashboardWidgetId[]): DashboardWidgetId[] {
  const seen = new Set<DashboardWidgetId>();
  const result: DashboardWidgetId[] = [];
  for (const id of order) {
    if (DEFAULT_DETAIL_SET.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  for (const id of DEFAULT_DETAIL_ORDER) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}

function persist() {
  const layout: DashboardLayout = {
    hidden: [...hidden.value],
    detailOrder: detailOrder.value,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.error("Failed to persist dashboard layout", e);
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Partial<DashboardLayout>;
    const savedHidden = Array.isArray(parsed.hidden) ? parsed.hidden : [];
    hidden.value = new Set(savedHidden.filter((id) => ALL_IDS.has(id)));
    detailOrder.value = normalizeDetailOrder(
      Array.isArray(parsed.detailOrder) ? parsed.detailOrder : DEFAULT_DETAIL_ORDER
    );
  } catch (e) {
    console.error("Failed to load dashboard layout", e);
  }
}

export function useDashboardLayout() {
  load();

  const isVisible = (id: DashboardWidgetId) => !hidden.value.has(id);

  const orderedVisibleDetailIds = computed(() =>
    detailOrder.value.filter((id) => isVisible(id))
  );

  const allHidden = computed(() =>
    DASHBOARD_WIDGETS.every((w) => hidden.value.has(w.id))
  );

  function applyLayout(layout: DashboardLayout) {
    hidden.value = new Set(layout.hidden.filter((id) => ALL_IDS.has(id)));
    detailOrder.value = normalizeDetailOrder(layout.detailOrder);
    persist();
  }

  function resetToDefault() {
    hidden.value = new Set();
    detailOrder.value = [...DEFAULT_DETAIL_ORDER];
    persist();
  }

  const currentLayout = computed<DashboardLayout>(() => ({
    hidden: [...hidden.value],
    detailOrder: [...detailOrder.value],
  }));

  return {
    isVisible,
    orderedVisibleDetailIds,
    allHidden,
    currentLayout,
    applyLayout,
    resetToDefault,
  };
}

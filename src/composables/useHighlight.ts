import { ref, onScopeDispose, type Ref } from "vue";

// Briefly flag a value (an account id, a holding symbol, …) so a row can blink
// (the global .highlight-blink class) when navigated-to from elsewhere, then
// auto-clear after `durationMs`.
export function useHighlight<T>(durationMs = 3000): {
  highlighted: Ref<T | null>;
  highlight: (value?: T | null) => void;
} {
  const highlighted = ref<T | null>(null) as Ref<T | null>;
  let timer: number | undefined;

  function highlight(value?: T | null) {
    if (value == null) return;
    highlighted.value = value;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      highlighted.value = null;
    }, durationMs);
  }

  onScopeDispose(() => {
    if (timer) window.clearTimeout(timer);
  });

  return { highlighted, highlight };
}

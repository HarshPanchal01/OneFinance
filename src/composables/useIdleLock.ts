import { watch, onUnmounted, type Ref } from "vue";

// User activity that resets the idle countdown. Listeners are passive so they
// never interfere with scrolling.
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"] as const;

// Calls `onIdle` after `timeoutMs` of no user activity. Active only while
// `enabled` is true and `timeoutMs` > 0; any tracked activity restarts the timer.
// Re-evaluates whenever `enabled` or `timeoutMs` changes (e.g. lock/unlock, or the
// user changing the auto-lock setting).
export function useIdleLock(opts: {
  enabled: Ref<boolean>;
  timeoutMs: Ref<number>;
  onIdle: () => void;
}): void {
  let timer: number | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    clearTimer();
    if (!opts.enabled.value || opts.timeoutMs.value <= 0) return;
    timer = window.setTimeout(() => opts.onIdle(), opts.timeoutMs.value);
  };

  const attach = () => ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, schedule, { passive: true }));
  const detach = () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, schedule));

  watch(
    [opts.enabled, opts.timeoutMs],
    ([enabled]) => {
      detach();
      clearTimer();
      if (enabled) {
        attach();
        schedule();
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    detach();
    clearTimer();
  });
}

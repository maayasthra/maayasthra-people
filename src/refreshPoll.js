// Realtime delivers changes immediately. A slower reconciliation still catches
// missed events. Keep the original interval whenever the connection is uncertain.
export function refreshPoll(refresh, fallbackMs) {
  let connected = false, stopped = false;
  let timer = setInterval(refresh, fallbackMs);
  return {
    status(value) {
      const next = value === 'SUBSCRIBED';
      if (stopped || next === connected) return;
      connected = next;
      clearInterval(timer);
      timer = setInterval(refresh, connected ? 300000 : fallbackMs);
      if (connected) refresh(); // catch changes missed while joining or reconnecting
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    }
  };
}

export async function checkRealtimeProcess(): Promise<"up" | "down"> {
  const port = process.env.REALTIME_PORT || "3231";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 800);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    return response.ok ? "up" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

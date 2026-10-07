import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";

describe("سلامت پروسه realtime", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  });

  it("پورت خاموش را down و پاسخ سالم را up گزارش می‌کند", async () => {
    const { checkRealtimeProcess } = await import("@/lib/health/processes");
    process.env.REALTIME_PORT = "1";
    expect(await checkRealtimeProcess()).toBe("down");

    const server = http.createServer((_req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("port");
    process.env.REALTIME_PORT = String(address.port);
    expect(await checkRealtimeProcess()).toBe("up");
  });
});
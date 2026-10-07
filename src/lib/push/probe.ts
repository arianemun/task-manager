import dns from "node:dns/promises";
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { PUSH_PROBE_HOSTS } from "./hosts";

export type ProbeVia = "direct" | "proxy";

export type ProbeResult = {
  host: string;
  via: ProbeVia;
  dns: "ok" | "fail";
  addresses: string[];
  tls: "ok" | "fail" | "skipped";
  httpStatus: number | null;
  error: string | null;
  elapsedMs: number;
};

const TIMEOUT_MS = 8000;

async function resolveHost(host: string): Promise<{ ok: true; addresses: string[] } | { ok: false; error: string }> {
  try {
    const records = await dns.lookup(host, { all: true, family: 4 });
    const addresses = records.map((row) => row.address);
    if (addresses.length === 0) return { ok: false, error: "no-address" };
    return { ok: true, addresses };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "dns";
    return { ok: false, error: code };
  }
}

function requestHost(host: string, proxyUrl?: string): Promise<{ status: number | null; error: string | null; tls: "ok" | "fail" }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host,
        method: "GET",
        path: "/",
        timeout: TIMEOUT_MS,
        servername: host,
        family: proxyUrl ? undefined : 4,
        agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? null, error: null, tls: "ok" });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: null, error: "timeout", tls: "fail" });
    });
    req.on("error", (error) => {
      resolve({ status: null, error: error.message, tls: "fail" });
    });
    req.end();
  });
}

export async function probePushHost(host: string, proxyUrl?: string): Promise<ProbeResult> {
  const started = Date.now();
  const via: ProbeVia = proxyUrl ? "proxy" : "direct";
  const looked = await resolveHost(host);
  if (!looked.ok && !proxyUrl) {
    return {
      host,
      via,
      dns: "fail",
      addresses: [],
      tls: "skipped",
      httpStatus: null,
      error: looked.error,
      elapsedMs: Date.now() - started,
    };
  }
  const response = await requestHost(host, proxyUrl);
  return {
    host,
    via,
    dns: looked.ok ? "ok" : "fail",
    addresses: looked.ok ? looked.addresses : [],
    tls: response.tls,
    httpStatus: response.status,
    error: response.error,
    elapsedMs: Date.now() - started,
  };
}

export async function probePushServices(proxyUrl?: string): Promise<ProbeResult[]> {
  const direct = await Promise.all(PUSH_PROBE_HOSTS.map((host) => probePushHost(host)));
  if (!proxyUrl) return direct;
  const proxied = await Promise.all(
    PUSH_PROBE_HOSTS.map((host) => probePushHost(host, proxyUrl)),
  );
  return [...direct, ...proxied];
}

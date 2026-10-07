"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fa } from "@/lib/i18n/fa";
import type { ProbeResult } from "@/lib/push/probe";
import { toFaDigits } from "@/lib/utils";

type SendResult = {
  ok: boolean;
  statusCode: number | null;
  via: "direct" | "proxy";
  endpointHost: string;
  elapsedMs: number;
  error: string | null;
};

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function deviceKind(): string {
  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const ios = /iPhone|iPad|iPod/.test(ua);
  if (ios && standalone) return fa.pushLab.deviceIphonePwa;
  if (ios) return fa.pushLab.deviceIphoneBrowser;
  if (/Firefox\//.test(ua) && /Android/.test(ua)) return fa.pushLab.deviceFirefoxAndroid;
  if (/Firefox\//.test(ua)) return fa.pushLab.deviceFirefoxDesktop;
  if (/Edg\//.test(ua)) return fa.pushLab.deviceEdge;
  if (/Android/.test(ua) && standalone) return fa.pushLab.deviceAndroidPwa;
  if (/Android/.test(ua)) return fa.pushLab.deviceAndroidBrowser;
  if (/Chrome\//.test(ua)) return fa.pushLab.deviceChrome;
  return fa.pushLab.deviceOther;
}

export function PushLab({ publicKey }: { publicKey: string }) {
  const [device, setDevice] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [proxyConfigured, setProxyConfigured] = useState(false);
  const [probes, setProbes] = useState<ProbeResult[] | null>(null);
  const [probeError, setProbeError] = useState("");
  const [subscription, setSubscription] = useState<PushSubscriptionJSON | null>(null);
  const [status, setStatus] = useState("");
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDevice(deviceKind());
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    void fetch("/api/admin/push-lab/probe")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ proxyConfigured: boolean; results: ProbeResult[] }>;
      })
      .then((data) => {
        setProxyConfigured(data.proxyConfigured);
        setProbes(data.results);
      })
      .catch(() => setProbeError(fa.pushLab.probeFailed));
  }, []);

  async function subscribe() {
    setBusy(true);
    setStatus("");
    try {
      if (!publicKey) throw new Error(fa.pushLab.missingKey);
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error(fa.pushLab.unsupported);
      }
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") throw new Error(fa.pushLab.denied);
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const next =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      setSubscription(next.toJSON());
      setStatus(fa.pushLab.subscribed);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : fa.pushLab.failed);
    } finally {
      setBusy(false);
    }
  }

  async function send(mode: "direct" | "proxy") {
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
      setStatus(fa.pushLab.needSubscribe);
      return;
    }
    setBusy(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/push-lab/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        }),
      });
      const data = (await res.json()) as SendResult;
      setSendResult(data);
      setStatus(data.ok ? fa.pushLab.sent : data.error || fa.pushLab.failed);
    } catch {
      setStatus(fa.pushLab.failed);
    } finally {
      setBusy(false);
    }
  }

  const iosBrowser = device === fa.pushLab.deviceIphoneBrowser;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{fa.pushLab.thisDevice}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-[1.7]">
          <p>{device || fa.common.loading}</p>
          <p>
            {fa.pushLab.permission}: {permission}
          </p>
          {iosBrowser ? <p>{fa.pushLab.iphoneHint}</p> : null}
          <Button type="button" disabled={busy || !publicKey} onClick={() => void subscribe()}>
            {fa.pushLab.subscribe}
          </Button>
          {subscription?.endpoint ? (
            <p className="text-muted-foreground break-all text-xs" dir="ltr">
              {new URL(subscription.endpoint).host}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{fa.pushLab.sendTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void send("direct")}>
              {fa.pushLab.sendDirect}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !proxyConfigured}
              onClick={() => void send("proxy")}
            >
              {fa.pushLab.sendProxy}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            {proxyConfigured ? fa.pushLab.proxyOn : fa.pushLab.proxyOff}
          </p>
          {status ? <p className="text-sm">{status}</p> : null}
          {sendResult ? (
            <p className="text-sm" dir="ltr">
              {sendResult.via} · {sendResult.endpointHost} · HTTP{" "}
              {sendResult.statusCode ?? "—"} · {toFaDigits(sendResult.elapsedMs)} ms
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{fa.pushLab.serverTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {probeError ? <p className="text-sm">{probeError}</p> : null}
          {!probes && !probeError ? <p className="text-sm">{fa.common.loading}</p> : null}
          {probes ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b text-start">
                    <th className="px-2 py-2 text-start">{fa.pushLab.colHost}</th>
                    <th className="px-2 py-2 text-start">{fa.pushLab.colVia}</th>
                    <th className="px-2 py-2 text-start">DNS</th>
                    <th className="px-2 py-2 text-start">TLS</th>
                    <th className="px-2 py-2 text-start">HTTP</th>
                  </tr>
                </thead>
                <tbody>
                  {probes.map((row) => (
                    <tr key={`${row.via}-${row.host}`} className="border-b">
                      <td className="px-2 py-2" dir="ltr">
                        {row.host}
                      </td>
                      <td className="px-2 py-2">{row.via === "direct" ? fa.pushLab.direct : fa.pushLab.proxy}</td>
                      <td className="px-2 py-2">{row.dns}</td>
                      <td className="px-2 py-2">{row.tls}</td>
                      <td className="px-2 py-2" dir="ltr">
                        {row.httpStatus ?? row.error ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

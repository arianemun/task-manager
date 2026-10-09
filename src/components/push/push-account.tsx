"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fa } from "@/lib/i18n/fa";
import { releaseDevicePush } from "@/lib/push/browser";
import {
  removePushDeviceAction,
  savePushPreferencesAction,
  saveQuietHoursAction,
} from "@/server/actions/push-settings";

export function PushAccount({
  devices,
  quietStart,
  quietEnd,
  types,
}: {
  devices: Array<{ endpoint: string; deviceLabel: string | null }>;
  quietStart: string;
  quietEnd: string;
  types: Array<{ id: string; label: string; checked: boolean }>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function testPush() {
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setStatus(data.ok ? fa.push.testSent : data.error || fa.push.testFailed);
    } catch {
      setStatus(fa.push.testFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-3"
        action={async (formData) => {
          const result = await saveQuietHoursAction(null, formData);
          setStatus(result.ok ? fa.push.saved : result.error);
        }}
      >
        <div>
          <p className="font-medium">{fa.push.quiet}</p>
          <p className="text-muted-foreground text-sm leading-[1.7]">{fa.push.quietHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            {fa.push.from}
            <input
              name="start"
              type="time"
              defaultValue={quietStart}
              className="border-input bg-background h-11 rounded-md border px-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            {fa.push.until}
            <input
              name="end"
              type="time"
              defaultValue={quietEnd}
              className="border-input bg-background h-11 rounded-md border px-2"
            />
          </label>
          <Button type="submit">{fa.common.save}</Button>
        </div>
      </form>

      <form
        className="space-y-2"
        action={async (formData) => {
          const result = await savePushPreferencesAction(null, formData);
          setStatus(result.ok ? fa.push.saved : result.error);
        }}
      >
        <p className="font-medium">{fa.push.types}</p>
        {types.map((type) => (
          <label key={type.id} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name={`push:${type.id}`} defaultChecked={type.checked} />
            {type.label}
          </label>
        ))}
        <Button type="submit">{fa.common.save}</Button>
      </form>

      <div className="space-y-2">
        <p className="font-medium">{fa.push.devices}</p>
        {devices.length === 0 ? (
          <p className="text-muted-foreground text-sm">{fa.push.noDevices}</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((device) => (
              <li key={device.endpoint} className="flex items-center justify-between gap-3 text-sm">
                <span>{device.deviceLabel || fa.push.devices}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void removePushDeviceAction(device.endpoint).then(() => {
                      if (localStorage.getItem("tm-push-endpoint") === device.endpoint) {
                        releaseDevicePush();
                      }
                      router.refresh();
                    });
                  }}
                >
                  {fa.push.removeDevice}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" disabled={busy} onClick={() => void testPush()}>
          {fa.push.test}
        </Button>
      </div>
      {status ? <p className="text-sm">{status}</p> : null}
    </div>
  );
}

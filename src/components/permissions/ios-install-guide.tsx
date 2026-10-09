import { fa } from "@/lib/i18n/fa";

export function IosInstallGuide() {
  return (
    <div className="bg-muted/60 space-y-2 rounded-lg px-3 py-3 text-sm leading-[1.7]">
      <p className="font-medium">{fa.push.installTitle}</p>
      <ol className="space-y-1 ps-4">
        {fa.push.installSteps.map((step) => (
          <li key={step} className="list-decimal">
            {step}
          </li>
        ))}
      </ol>
      <p>{fa.push.vpn}</p>
    </div>
  );
}

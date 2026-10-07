"use client";

import { useState } from "react";
import { changelog } from "@/generated/changelog";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

export function AppCredit() {
  const [open, setOpen] = useState(false);
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "";
  const release = changelog.find((item) => item.version === version);

  return (
    <div className="text-muted-foreground px-2 py-2 text-center text-xs leading-relaxed">
      <button
        type="button"
        className="hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        {fa.about.version} {toFaDigits(version)}
      </button>
      <p className="mt-1">
        {fa.about.madeWith}{" "}
        <span className="heart-beat" aria-hidden="true">
          ❤️
        </span>{" "}
        {fa.about.by}{" "}
        <a
          href={fa.about.authorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary no-underline hover:underline"
        >
          {fa.about.author}
        </a>
      </p>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{fa.about.changesTitle}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {fa.about.version} {toFaDigits(version)}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            {release && release.sections.length > 0 ? (
              <div className="space-y-4 text-start text-sm leading-[1.7]">
                {release.sections.map((section) => (
                  <section key={section.title}>
                    <h3 className="font-medium">{section.title}</h3>
                    <ul className="mt-1 list-disc ps-5">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{fa.about.noChanges}</p>
            )}
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

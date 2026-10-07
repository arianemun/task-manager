"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { fa } from "@/lib/i18n/fa";
import { normalizePersianText } from "@/lib/validation/normalize";
import {
  createDepartmentChatAction,
  createDirectChatAction,
  createGroupChatAction,
} from "@/server/actions/chat";

export type ChatPerson = { id: number; fullName: string };
export type ChatDept = { id: number; name: string };

export function NewChatButton(props: {
  people: ChatPerson[];
  departments: ChatDept[];
  canCreateGroup: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"direct" | "group" | "department">("direct");
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const people = useMemo(() => {
    const needle = normalizePersianText(q);
    return props.people.filter((person) =>
      needle ? normalizePersianText(person.fullName).includes(needle) : true,
    );
  }, [props.people, q]);

  function go(id: number) {
    setOpen(false);
    router.push(`/chat/${id}`);
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {fa.chat.newChat}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{fa.chat.newChat}</DrawerTitle>
          </DrawerHeader>
          <div className="flex gap-2 px-4 pb-3">
            <Button
              type="button"
              size="sm"
              variant={mode === "direct" ? "default" : "outline"}
              onClick={() => setMode("direct")}
            >
              {fa.chat.direct}
            </Button>
            {props.canCreateGroup ? (
              <Button
                type="button"
                size="sm"
                variant={mode === "group" ? "default" : "outline"}
                onClick={() => setMode("group")}
              >
                {fa.chat.group}
              </Button>
            ) : null}
            {props.isAdmin ? (
              <Button
                type="button"
                size="sm"
                variant={mode === "department" ? "default" : "outline"}
                onClick={() => setMode("department")}
              >
                {fa.chat.department}
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-destructive px-4 pb-2 text-sm">{error}</p> : null}
          {mode === "department" ? (
            <ul className="max-h-80 overflow-y-auto px-2 pb-4">
              {props.departments.map((dept) => (
                <li key={dept.id}>
                  <button
                    type="button"
                    className="hover:bg-accent w-full rounded-md px-3 py-3 text-start"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await createDepartmentChatAction(dept.id);
                        if (!result.ok) setError(result.error);
                        else go(result.id);
                      });
                    }}
                  >
                    {dept.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 pb-4">
              {mode === "group" ? (
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={fa.chat.groupName}
                  className="border-input mb-3 h-11 w-full rounded-md border px-3"
                />
              ) : null}
              <Command className="border">
                <CommandInput
                  placeholder={fa.chat.search}
                  value={q}
                  onValueChange={setQ}
                />
                <CommandList>
                  <CommandEmpty>{fa.common.empty}</CommandEmpty>
                  <CommandGroup>
                    {people.map((person) => {
                      const on = picked.includes(person.id);
                      return (
                        <CommandItem
                          key={person.id}
                          value={person.fullName}
                          onSelect={() => {
                            if (mode === "direct") {
                              startTransition(async () => {
                                const result = await createDirectChatAction(person.id);
                                if (!result.ok) setError(result.error);
                                else go(result.id);
                              });
                              return;
                            }
                            setPicked((prev) =>
                              prev.includes(person.id)
                                ? prev.filter((id) => id !== person.id)
                                : [...prev, person.id],
                            );
                          }}
                        >
                          <Check className={on ? "opacity-100" : "opacity-0"} />
                          {person.fullName}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
              {mode === "group" ? (
                <Button
                  type="button"
                  className="mt-3 w-full"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await createGroupChatAction({
                        title,
                        memberIds: picked,
                      });
                      if (!result.ok) setError(result.error);
                      else go(result.id);
                    });
                  }}
                >
                  {fa.common.create}
                </Button>
              ) : null}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

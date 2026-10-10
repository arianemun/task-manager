const SETTLED = new Set(["DONE", "DONE_LATE", "NOT_DONE", "DONE_BY_PEER"]);

/** پرسنل تکلیفش را مشخص کرده، یا همکار کار مشترک را بسته است. */
export function isSettledOccurrence(status: string): boolean {
  return SETTLED.has(status);
}

export function splitSettled<T extends { status: string }>(items: T[]): {
  open: T[];
  archive: T[];
} {
  const open: T[] = [];
  const archive: T[] = [];
  for (const item of items) {
    if (isSettledOccurrence(item.status)) archive.push(item);
    else open.push(item);
  }
  return { open, archive };
}

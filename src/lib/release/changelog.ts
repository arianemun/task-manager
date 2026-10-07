export type ChangelogSection = {
  title: string;
  items: string[];
};

export type ChangelogRelease = {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
};

const RELEASE_HEADING = /^## \[([^\]]+)\](?:\s+-\s+(.+))?$/;
const SECTION_HEADING = /^### (.+)$/;

/** CHANGELOG به سبک Keep a Changelog را به فهرست نسخه‌ها تبدیل می‌کند. */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let current: ChangelogRelease | null = null;
  let section: ChangelogSection | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const releaseMatch = line.match(RELEASE_HEADING);
    if (releaseMatch) {
      current = {
        version: releaseMatch[1]!.trim(),
        date: releaseMatch[2]?.trim() ?? null,
        sections: [],
      };
      section = null;
      releases.push(current);
      continue;
    }
    if (!current) continue;
    const sectionMatch = line.match(SECTION_HEADING);
    if (sectionMatch) {
      section = { title: sectionMatch[1]!.trim(), items: [] };
      current.sections.push(section);
      continue;
    }
    if (!section) continue;
    const item = line.match(/^- (.+)$/);
    if (item) section.items.push(item[1]!.trim());
  }

  return releases;
}

export function bumpVersion(
  version: string,
  level: "patch" | "minor" | "major",
): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`نسخه نامعتبر است: ${version}`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

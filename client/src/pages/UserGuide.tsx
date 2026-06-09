import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  GUIDE_SECTIONS,
  type GuideSection,
  type GuideBlock,
} from "@/pages/guide/guide-content";
import {
  Info,
  BookOpen,
  LogIn,
  LayoutDashboard,
  Gauge,
  BarChart3,
  Search,
  CalendarClock,
  PlusCircle,
  Receipt,
  Pencil,
  History,
  FileText,
  Upload,
  Download,
  Settings,
  ShieldCheck,
  Users,
  ListChecks,
  HelpCircle,
  Wrench,
  Target,
  ArrowLeft,
  Lightbulb,
  AlertTriangle,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Info,
  BookOpen,
  LogIn,
  LayoutDashboard,
  Gauge,
  BarChart3,
  Search,
  CalendarClock,
  PlusCircle,
  Receipt,
  Pencil,
  History,
  FileText,
  Upload,
  Download,
  Settings,
  ShieldCheck,
  Users,
  ListChecks,
  HelpCircle,
  Wrench,
  Target,
};

function blockText(b: GuideBlock): string {
  switch (b.type) {
    case "p":
    case "subhead":
      return b.text;
    case "callout":
      return b.text;
    case "steps":
    case "bullets":
      return b.items.join(" ");
    case "table":
      return [...b.head, ...b.rows.flat()].join(" ");
    case "image":
      return [b.alt, b.caption ?? ""].join(" ");
    default:
      return "";
  }
}

function sectionHaystack(s: GuideSection): string {
  return [s.title, s.summary, ...(s.keywords ?? []), ...s.blocks.map(blockText)]
    .join(" ")
    .toLowerCase();
}

/** Wraps query matches in <mark> for readable search highlighting. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.trim();
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(ql, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="rounded bg-yellow-300/70 px-0.5 text-foreground dark:bg-yellow-500/40">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return <>{parts}</>;
}

const CALLOUT_STYLE: Record<
  string,
  { icon: LucideIcon; cls: string; label: string }
> = {
  tip: { icon: Lightbulb, cls: "border-emerald-500/40 bg-emerald-500/10", label: "Tip" },
  note: { icon: StickyNote, cls: "border-blue-500/40 bg-blue-500/10", label: "Note" },
  warn: { icon: AlertTriangle, cls: "border-amber-500/40 bg-amber-500/10", label: "Important" },
};

function Block({ block, query }: { block: GuideBlock; query: string }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-sm leading-relaxed text-muted-foreground">
          <Highlight text={block.text} query={query} />
        </p>
      );
    case "subhead":
      return (
        <h3 className="mt-6 text-base font-semibold text-foreground">
          <Highlight text={block.text} query={query} />
        </h3>
      );
    case "bullets":
      return (
        <ul className="ml-1 space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>
                <Highlight text={it} query={query} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5 text-muted-foreground">
                <Highlight text={it} query={query} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "image":
      return (
        <figure className="my-2">
          <a
            href={block.src}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-lg border bg-muted/30 transition hover:border-primary/50"
          >
            <img
              src={block.src}
              alt={block.alt}
              loading="lazy"
              className="w-full"
            />
          </a>
          {block.caption && (
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              {block.caption} <span className="opacity-60">(click to enlarge)</span>
            </figcaption>
          )}
        </figure>
      );
    case "callout": {
      const s = CALLOUT_STYLE[block.tone];
      const Icon = s.icon;
      return (
        <div className={cn("flex gap-3 rounded-lg border p-3", s.cls)}>
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">{s.label}: </span>
            <Highlight text={block.text} query={query} />
          </p>
        </div>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {block.head.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b last:border-0">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-3 py-2 align-top text-muted-foreground",
                        ci === 0 && "font-medium text-foreground",
                      )}
                    >
                      <Highlight text={cell} query={query} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export default function UserGuide() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(GUIDE_SECTIONS[0]?.id ?? "");
  const contentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDE_SECTIONS;
    return GUIDE_SECTIONS.filter((s) => sectionHaystack(s).includes(q));
  }, [query]);

  // Scrollspy: highlight the section currently in view.
  useEffect(() => {
    if (filtered.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
    );
    const els = filtered
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filtered]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold">User Guide</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[280px_1fr]">
        {/* Sidebar: search + table of contents */}
        <aside className="lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-84px)] lg:self-start lg:overflow-y-auto lg:pr-2">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the guide…"
              className="pl-9"
              data-testid="input-guide-search"
            />
          </div>

          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {query.trim()
              ? `${filtered.length} matching ${filtered.length === 1 ? "topic" : "topics"}`
              : "Contents"}
          </p>

          <nav className="space-y-0.5" data-testid="guide-toc">
            {filtered.map((s) => {
              const Icon = ICONS[s.icon] ?? Info;
              const active = s.id === activeId;
              return (
                <button
                  key={s.id}
                  onClick={() => jumpTo(s.id)}
                  data-testid={`toc-${s.id}`}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-sm text-muted-foreground">No topics match.</p>
            )}
          </nav>
        </aside>

        {/* Content */}
        <main ref={contentRef} className="min-w-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24 text-center">
              <Search className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No results for “{query}”.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different word, or clear the search to see all topics.
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {filtered.map((s) => {
                const Icon = ICONS[s.icon] ?? Info;
                return (
                  <section
                    key={s.id}
                    id={s.id}
                    className="scroll-mt-24"
                    data-testid={`section-${s.id}`}
                  >
                    <div className="mb-4 border-b pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <h2 className="text-xl font-semibold">
                          <Highlight text={s.title} query={query} />
                        </h2>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        <Highlight text={s.summary} query={query} />
                      </p>
                    </div>
                    <div className="space-y-3.5">
                      {s.blocks.map((b, i) => (
                        <Block key={i} block={b} query={query} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

import { SearchBox } from "@/components/layout/SearchBox";

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-[--topbar-height] flex-shrink-0 items-center gap-4 border-b border-border bg-surface px-5">
      <div className="min-w-0 flex-1">{children}</div>
      <SearchBox />
    </header>
  );
}

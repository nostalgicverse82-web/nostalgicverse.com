import { ReactNode } from "react";

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  sub?: string;
  disabled?: boolean;
}

export default function MenuList({ items, selected }: { items: MenuItem[]; selected: number }) {
  return (
    <div className="flex h-full flex-col justify-center gap-[2px] px-2 font-['VT323'] text-[15px] leading-none">
      {items.map((it, i) => (
        <div
          key={it.id}
          className={`flex items-center justify-between rounded-sm px-1 py-[3px] ${
            i === selected ? "bg-current/20" : ""
          } ${it.disabled ? "opacity-35" : ""}`}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block w-3">{i === selected ? "▶" : ""}</span>
            {it.icon}
            {it.label}
          </span>
          {it.sub && <span className="opacity-60">{it.sub}</span>}
        </div>
      ))}
    </div>
  );
}

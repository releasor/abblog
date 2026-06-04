import { memo } from "react";

interface FilterTab {
  key: string;
  label: string;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  active: string;
  onChange: (key: string) => void;
}

export const FilterTabs = memo(function FilterTabs({ tabs, active, onChange }: FilterTabsProps) {
  return (
    <div className="overflow-x-auto" role="tablist">
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            role="tab"
            aria-selected={active === key}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              active === key
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
});

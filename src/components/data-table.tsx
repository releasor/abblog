import { ReactNode, memo } from "react";
import { SkeletonRow } from "./skeleton";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  loadingRows?: number;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
}

export const DataTable = memo(function DataTable<T>({
  columns,
  data,
  loading = false,
  loadingRows = 5,
  emptyIcon,
  emptyMessage = "暂无数据",
  emptyAction,
  keyExtractor,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return <SkeletonRow count={loadingRows} height="h-16" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        {emptyIcon && (
          <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
            {emptyIcon}
          </div>
        )}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.className || ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50" : ""}`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-5 py-4 text-sm ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.className || ""}`}>
                  {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}) as <T>(props: DataTableProps<T>) => ReactNode;

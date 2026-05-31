import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, message, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-20"}`}>
      {icon && (
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4 text-zinc-400">
          {icon}
        </div>
      )}
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">{message}</p>
      {description && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

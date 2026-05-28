import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 text-zinc-400">{icon}</div>}
      <p className="text-zinc-500 dark:text-zinc-400 mb-4">{message}</p>
      {action}
    </div>
  );
}

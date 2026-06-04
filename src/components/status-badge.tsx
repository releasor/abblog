import { memo } from "react";

interface StatusBadgeConfig {
  label: string;
  dot: string;
  bg: string;
  text: string;
}

interface StatusBadgeProps {
  config: StatusBadgeConfig;
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: "px-2 py-0.5",
  md: "px-2.5 py-1",
};

export const StatusBadge = memo(function StatusBadge({ config, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
});

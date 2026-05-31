interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "outline";
  size?: "sm" | "md";
}

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  const baseClasses = "inline-flex items-center rounded-full font-medium";
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  const variantClasses =
    variant === "outline"
      ? "border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300";

  return (
    <span className={`${baseClasses} ${sizeClasses} ${variantClasses}`}>
      {children}
    </span>
  );
}

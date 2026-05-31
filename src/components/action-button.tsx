import { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "default" | "danger" | "success";

const variantStyles: Record<Variant, string> = {
  default: "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
  danger: "text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
  success: "text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
};

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: Variant;
  icon: ReactNode;
  label: string;
}

export function ActionButton({
  variant = "default",
  icon,
  label,
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`p-2 rounded-lg disabled:opacity-50 transition-colors ${variantStyles[variant]}`}
    >
      {icon}
    </button>
  );
}

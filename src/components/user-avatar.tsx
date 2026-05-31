import Image from "next/image";

interface UserAvatarProps {
  name: string;
  avatar?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  loading?: "lazy" | "eager";
}

const sizes = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
  xl: "w-16 h-16 text-xl",
};

const imgSizes = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 64,
};

export function UserAvatar({ name, avatar, size = "md", className = "", loading = "lazy" }: UserAvatarProps) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";

  if (avatar) {
    return (
      <div className={`${sizes[size]} relative rounded-full overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 ${className}`}>
        <Image
          src={avatar}
          alt={name}
          fill
          className="object-cover"
          sizes={`${imgSizes[size]}px`}
          loading={loading}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex-shrink-0 ${className}`}>
      {initial}
    </div>
  );
}

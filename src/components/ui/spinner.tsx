import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "md" | "lg";
}

const SIZE: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "text-[10px]",
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
};

export function Spinner({ className, size = "sm", ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("motion-spinner align-[-0.125em]", SIZE[size], className)}
      {...props}
    />
  );
}

export default Spinner;

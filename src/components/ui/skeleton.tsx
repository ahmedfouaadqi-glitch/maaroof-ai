import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("motion-skeleton rounded-md bg-primary/5", className)}
      {...props}
    />
  );
}

export { Skeleton };

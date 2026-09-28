import { Skeleton } from '@/shared/ui';

export function ProductCardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-1">
      <Skeleton className="aspect-[250/320] w-full rounded-sm" />
      <Skeleton className="mt-1 h-[26px] w-16" />
      <Skeleton className="h-[26px] w-full" />
      <Skeleton className="h-[26px] w-24" />
    </div>
  );
}

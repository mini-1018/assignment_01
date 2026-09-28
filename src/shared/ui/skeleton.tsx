export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-sm bg-gray-50 ${className}`} />;
}

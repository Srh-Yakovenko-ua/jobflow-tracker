import { LoadingRegion } from '@/shared/ui/loading-region';
import { CardSkeleton } from '@/shared/ui/skeleton';

export function ComparisonSkeleton() {
  return (
    <LoadingRegion className="grid min-w-0 grid-cols-1 gap-4 @xl:grid-cols-2">
      <CardSkeleton />
      <CardSkeleton />
    </LoadingRegion>
  );
}

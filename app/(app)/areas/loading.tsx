import { SkeletonList } from "@/components/ui/Skeleton";

export default function AreasLoading() {
  return <SkeletonList rows={5} className="max-w-[700px]" />;
}

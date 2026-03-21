import { SkeletonList } from "@/components/ui/Skeleton";

export default function AreasLoading() {
  return <SkeletonList rows={5} style={{ maxWidth: 700 }} />;
}

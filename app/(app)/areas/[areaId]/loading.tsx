import { SkeletonCard, SkeletonList } from "@/components/ui/Skeleton";

export default function AreaDetailLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <SkeletonCard lines={2} />
      <SkeletonList rows={4} />
    </div>
  );
}

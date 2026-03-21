import { SkeletonCard, SkeletonList } from "@/components/ui/Skeleton";

export default function TeamLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <SkeletonCard lines={1} />
      <SkeletonList rows={4} />
    </div>
  );
}

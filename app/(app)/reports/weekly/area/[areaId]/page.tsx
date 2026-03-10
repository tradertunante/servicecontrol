export default function Page({
  params,
  searchParams,
}: {
  params: { areaId: string };
  searchParams: { weekStart?: string };
}) {

  const areaId = params.areaId;
  const weekStart = searchParams.weekStart;

}
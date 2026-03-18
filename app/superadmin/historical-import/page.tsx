import HotelHeader from "@/app/components/HotelHeader";
import HistoricalImportClient from "@/app/superadmin/historical-import/HistoricalImportClient";
import { getHistoricalImportHotels } from "@/lib/superadmin/historicalImports";

export default async function SuperadminHistoricalImportPage({
  searchParams,
}: {
  searchParams?: {
    hotelId?: string;
    templateId?: string;
  };
}) {
  const hotels = await getHistoricalImportHotels();

  return (
    <main style={{ padding: 24, paddingTop: 80, display: "grid", gap: 16 }}>
      <HotelHeader />
      <HistoricalImportClient
        hotels={hotels}
        initialHotelId={String(searchParams?.hotelId ?? "").trim()}
        initialTemplateId={String(searchParams?.templateId ?? "").trim()}
      />
    </main>
  );
}

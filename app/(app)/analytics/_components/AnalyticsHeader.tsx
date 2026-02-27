"use client";

export default function AnalyticsHeader({
  hotelName,
  busy,
}: {
  hotelName: string;
  busy: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xs font-semibold text-gray-500">{hotelName}</div>
        <h1 className="text-2xl font-extrabold tracking-tight">Analítica</h1>
        <div className="mt-1 text-sm font-semibold text-gray-600">
          Ranking y fallos más repetidos por estándar en el área.
        </div>
      </div>

      <div className="flex items-center gap-2">
        {busy ? (
          <span className="rounded-full border bg-white px-3 py-1 text-xs font-extrabold text-gray-700">
            Calculando…
          </span>
        ) : null}
      </div>
    </div>
  );
}
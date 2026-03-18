import { redirect } from "next/navigation";

export default async function LegacyTemplateHistoricalImportPage({
  params,
}: {
  params: { templateId: string };
}) {
  redirect(`/superadmin/historical-import?templateId=${encodeURIComponent(params.templateId)}`);
}

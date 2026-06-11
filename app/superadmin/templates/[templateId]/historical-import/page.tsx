import { redirect } from "next/navigation";

export default async function LegacyTemplateHistoricalImportPage(
  props: {
    params: Promise<{ templateId: string }>;
  }
) {
  const params = await props.params;
  redirect(`/superadmin/historical-import?templateId=${encodeURIComponent(params.templateId)}`);
}

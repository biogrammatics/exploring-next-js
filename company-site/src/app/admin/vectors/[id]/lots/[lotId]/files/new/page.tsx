import { requireAdminPage } from "@/lib/auth-guards";
import { UploadLotFileForm } from "./upload-lot-file-form";

interface PageProps {
  params: Promise<{ id: string; lotId: string }>;
}

export default async function UploadLotFilePage({ params }: PageProps) {
  await requireAdminPage();
  const { id, lotId } = await params;
  return <UploadLotFileForm vectorId={id} lotId={lotId} />;
}

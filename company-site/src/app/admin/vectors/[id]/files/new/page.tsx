import { requireAdminPage } from "@/lib/auth-guards";
import { UploadVectorFileForm } from "./upload-vector-file-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UploadVectorFilePage({ params }: PageProps) {
  await requireAdminPage();
  const { id } = await params;
  return <UploadVectorFileForm vectorId={id} />;
}

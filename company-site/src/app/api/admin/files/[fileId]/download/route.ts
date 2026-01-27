import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/s3";

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await params;

    // Try to find the file in VectorFile first
    const vectorFile = await prisma.vectorFile.findUnique({
      where: { id: fileId },
    });

    if (vectorFile) {
      const signedUrl = await getSignedDownloadUrl(vectorFile.s3Key, vectorFile.fileName, 3600);
      return NextResponse.redirect(signedUrl);
    }

    // Try VectorLotFile
    const lotFile = await prisma.vectorLotFile.findUnique({
      where: { id: fileId },
    });

    if (lotFile) {
      const signedUrl = await getSignedDownloadUrl(lotFile.s3Key, lotFile.fileName, 3600);
      return NextResponse.redirect(signedUrl);
    }

    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}

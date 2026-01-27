import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/s3";

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params;

    // Try to find the file in VectorFile first
    const vectorFile = await prisma.vectorFile.findUnique({
      where: { id: fileId },
      include: {
        vector: {
          include: {
            productStatus: true,
          },
        },
      },
    });

    if (vectorFile) {
      // Allow public download for available products
      if (vectorFile.vector.productStatus?.isAvailable) {
        const signedUrl = await getSignedDownloadUrl(vectorFile.s3Key, vectorFile.fileName, 3600);
        return NextResponse.redirect(signedUrl);
      }

      // For unavailable products, require authentication
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const signedUrl = await getSignedDownloadUrl(vectorFile.s3Key, vectorFile.fileName, 3600);
      return NextResponse.redirect(signedUrl);
    }

    // VectorLotFile - always require admin authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

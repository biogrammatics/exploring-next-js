import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSignedViewUrl } from "@/lib/s3";

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

// This route serves files inline (for display in browser)
// No authentication required for public product pages
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
      // Only allow viewing files for available products (public access)
      // or require auth for unavailable products
      if (!vectorFile.vector.productStatus?.isAvailable) {
        return NextResponse.json({ error: "Product not available" }, { status: 403 });
      }

      const signedUrl = await getSignedViewUrl(
        vectorFile.s3Key,
        vectorFile.contentType || undefined,
        3600
      );
      return NextResponse.redirect(signedUrl);
    }

    // Lot files are not publicly accessible
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (error) {
    console.error("Error generating view URL:", error);
    return NextResponse.json(
      { error: "Failed to generate view URL" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3, BUCKET_NAME } from "@/lib/s3";
import type { VectorFileType } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: vectorId } = await params;

    // Verify the vector exists
    const vector = await prisma.vector.findUnique({
      where: { id: vectorId },
    });

    if (!vector) {
      return NextResponse.json({ error: "Vector not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as VectorFileType | null;
    const isPrimary = formData.get("isPrimary") === "on";

    if (!file || !fileType) {
      return NextResponse.json(
        { error: "File and file type are required" },
        { status: 400 }
      );
    }

    // Validate file type enum
    const validFileTypes: VectorFileType[] = [
      "SNAPGENE",
      "GENBANK",
      "FASTA",
      "PRODUCT_SHEET",
      "IMAGE",
      "OTHER",
    ];
    if (!validFileTypes.includes(fileType)) {
      return NextResponse.json(
        { error: "Invalid file type" },
        { status: 400 }
      );
    }

    // If setting as primary, unset any existing primary for this type
    if (isPrimary) {
      await prisma.vectorFile.updateMany({
        where: {
          vectorId,
          fileType,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Generate S3 key
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `vectors/${vectorId}/files/${timestamp}-${sanitizedFileName}`;

    // Upload to S3
    const arrayBuffer = await file.arrayBuffer();
    await uploadToS3(
      s3Key,
      Buffer.from(arrayBuffer),
      file.type || "application/octet-stream"
    );

    // Create file record in database
    const vectorFile = await prisma.vectorFile.create({
      data: {
        vectorId,
        fileType,
        fileName: file.name,
        fileSize: file.size,
        s3Key,
        s3Bucket: BUCKET_NAME,
        contentType: file.type || "application/octet-stream",
        isPrimary,
      },
    });

    return NextResponse.json({
      success: true,
      file: vectorFile,
    });
  } catch (error) {
    console.error("Error uploading vector file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: vectorId } = await params;

    const files = await prisma.vectorFile.findMany({
      where: { vectorId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching vector files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3, BUCKET_NAME } from "@/lib/s3";
import type { LotFileType } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string; lotId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
    if (!session?.user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: vectorId, lotId } = await params;

    // Verify the lot exists and belongs to the vector
    const lot = await prisma.vectorLot.findFirst({
      where: {
        id: lotId,
        vectorId,
      },
    });

    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as LotFileType | null;

    if (!file || !fileType) {
      return NextResponse.json(
        { error: "File and file type are required" },
        { status: 400 }
      );
    }

    // Validate file type enum
    const validFileTypes: LotFileType[] = [
      "SEQUENCING_DATA",
      "QC_REPORT",
      "COA",
      "OTHER",
    ];
    if (!validFileTypes.includes(fileType)) {
      return NextResponse.json(
        { error: "Invalid file type" },
        { status: 400 }
      );
    }

    // Generate S3 key
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `vectors/${vectorId}/lots/${lotId}/${timestamp}-${sanitizedFileName}`;

    // Upload to S3
    const arrayBuffer = await file.arrayBuffer();
    await uploadToS3(
      s3Key,
      Buffer.from(arrayBuffer),
      file.type || "application/octet-stream"
    );

    // Create file record in database
    const lotFile = await prisma.vectorLotFile.create({
      data: {
        lotId,
        fileType,
        fileName: file.name,
        fileSize: file.size,
        s3Key,
        s3Bucket: BUCKET_NAME,
        contentType: file.type || "application/octet-stream",
      },
    });

    return NextResponse.json({
      success: true,
      file: lotFile,
    });
  } catch (error) {
    console.error("Error uploading lot file:", error);
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

    const { lotId } = await params;

    const files = await prisma.vectorLotFile.findMany({
      where: { lotId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching lot files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

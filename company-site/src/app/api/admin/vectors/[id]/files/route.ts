import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

    // TODO: Upload to S3
    // For now, we'll just store the metadata. Actual S3 upload should be:
    //
    // const s3Client = new S3Client({
    //   region: process.env.AWS_REGION,
    //   credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    //   },
    // });
    //
    // const arrayBuffer = await file.arrayBuffer();
    // await s3Client.send(
    //   new PutObjectCommand({
    //     Bucket: process.env.AWS_S3_BUCKET,
    //     Key: s3Key,
    //     Body: Buffer.from(arrayBuffer),
    //     ContentType: file.type,
    //   })
    // );

    // Create file record in database
    const vectorFile = await prisma.vectorFile.create({
      data: {
        vectorId,
        fileType,
        fileName: file.name,
        fileSize: file.size,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET || "biogrammatics-files",
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

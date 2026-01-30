import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";

// POST - Upload a vector map image
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const vectorId = formData.get("vectorId") as string;

    if (!file || !vectorId) {
      return NextResponse.json(
        { error: "File and vectorId are required" },
        { status: 400 }
      );
    }

    // Verify vector exists
    const vector = await prisma.vector.findUnique({
      where: { id: vectorId },
      include: {
        files: {
          where: { fileType: "IMAGE" },
        },
      },
    });

    if (!vector) {
      return NextResponse.json({ error: "Vector not found" }, { status: 404 });
    }

    // Delete existing image file if any
    for (const existingFile of vector.files) {
      try {
        await deleteFromS3(existingFile.s3Key);
      } catch (err) {
        console.error("Error deleting old image from S3:", err);
      }
      await prisma.vectorFile.delete({
        where: { id: existingFile.id },
      });
    }

    // Generate S3 key
    const timestamp = Date.now();
    const s3Key = `vectors/${vectorId}/map-${timestamp}.png`;

    // Convert file to buffer and upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await uploadToS3(s3Key, buffer, "image/png");

    // Create VectorFile record
    const vectorFile = await prisma.vectorFile.create({
      data: {
        vectorId,
        fileType: "IMAGE",
        fileName: `${vector.name} Map.png`,
        fileSize: buffer.length,
        s3Key,
        contentType: "image/png",
        isPrimary: true,
      },
    });

    return NextResponse.json({
      success: true,
      fileId: vectorFile.id,
    });
  } catch (error) {
    console.error("Error uploading vector image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}

// DELETE - Remove vector map image
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vectorId = searchParams.get("vectorId");

    if (!vectorId) {
      return NextResponse.json(
        { error: "vectorId is required" },
        { status: 400 }
      );
    }

    // Find and delete all image files for this vector
    const imageFiles = await prisma.vectorFile.findMany({
      where: {
        vectorId,
        fileType: "IMAGE",
      },
    });

    for (const file of imageFiles) {
      try {
        await deleteFromS3(file.s3Key);
      } catch (err) {
        console.error("Error deleting from S3:", err);
      }
      await prisma.vectorFile.delete({
        where: { id: file.id },
      });
    }

    // Also clear the thumbnail from the vector
    await prisma.vector.update({
      where: { id: vectorId },
      data: { thumbnailBase64: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vector image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}

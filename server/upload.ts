import path from "path";
import { existsSync, mkdirSync, createReadStream } from "fs";
import multer from "multer";
import { randomUUID } from "crypto";
import type { Express } from "express";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";

const uploadDir = path.join(process.cwd(), "uploads");
const useS3 = Boolean(process.env.S3_BUCKET_NAME && process.env.AWS_REGION);

if (!useS3 && !existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${uniqueSuffix}__${safeOriginal}`);
  },
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const upload = multer({
  storage: useS3 ? memoryStorage : diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, images, Word, and Excel files are allowed."));
    }
  },
});

const s3Client = useS3
  ? new S3Client({
      region: process.env.AWS_REGION,
    })
  : null;

export async function persistUploadedFile(file?: Express.Multer.File): Promise<string | null> {
  if (!file) return null;

  if (useS3 && s3Client) {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `uploads-${Date.now()}-${randomUUID()}__${safeOriginal}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    return key;
  }

  return file.filename;
}

export interface StoredFileStream {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  originalName?: string;
}

export async function getFileStream(key: string): Promise<StoredFileStream | null> {
  if (!key) return null;

  if (useS3 && s3Client) {
    try {
      const result = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: key,
        })
      );

      if (!result.Body) return null;

      return {
        stream: result.Body as Readable,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        originalName: key.split("__").pop() || undefined,
      };
    } catch (error) {
      return null;
    }
  }

  const filePath = path.join(uploadDir, key);
  if (!existsSync(filePath)) {
    return null;
  }

  return {
    stream: createReadStream(filePath),
    originalName: key.split("__").pop() || key,
  };
}

export const isS3Enabled = useS3;

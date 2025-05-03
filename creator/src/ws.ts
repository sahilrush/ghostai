import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { WebSocketServer } from "ws";

const BUCKET_NAME = "ghostmeet-chunks";
const REGION = "ap-southeast-2";

// Use environment variables for credentials in production!
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

class S3MultipartUploader {
  private uploadId: string | undefined;
  private partNumber = 1;
  private parts: { ETag: string; PartNumber: number }[] = [];
  private isFailed = false;

  constructor(private bucket: string, private key: string) {}

  async initialize() {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: this.key,
      ContentType: "video/webm",
    });
    const response = await s3Client.send(command);
    this.uploadId = response.UploadId;
    console.log(`[S3] Multipart upload started (ID: ${this.uploadId})`);
  }

  async uploadPart(data: Buffer) {
    if (!this.uploadId) throw new Error("Upload not initialized");
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: this.key,
      UploadId: this.uploadId,
      PartNumber: this.partNumber,
      Body: data,
    });
    const response = await s3Client.send(command);
    if (!response.ETag) throw new Error("Missing ETag from S3");
    this.parts.push({ ETag: response.ETag, PartNumber: this.partNumber });
    console.log(`[S3] Uploaded part ${this.partNumber} (${data.length} bytes)`);
    this.partNumber++;
  }

  async complete() {
    if (!this.uploadId) throw new Error("Upload not initialized");
    if (!this.parts.length) {
      await this.abort();
      throw new Error("No parts uploaded; aborting");
    }
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: this.key,
      UploadId: this.uploadId,
      MultipartUpload: { Parts: this.parts },
    });
    const response = await s3Client.send(command);
    console.log(`[S3] Upload complete: ${response.Location || this.key}`);
    return response.Location;
  }

  async abort() {
    if (!this.uploadId) return;
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: this.key,
      UploadId: this.uploadId,
    });
    await s3Client.send(command);
    console.log(`[S3] Upload aborted`);
  }
}

export function startWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });
  console.log(`WebSocket server started on ws://localhost:${port}`);

  wss.on("connection", (ws) => {
    const key = `recording-${Date.now()}-${uuidv4()}.webm`;
    const uploader = new S3MultipartUploader(BUCKET_NAME, key);
    let initialized = false;
    let chunkCount = 0;
    let lastChunkTime = Date.now();

    // Heartbeat: close if no chunks for 30s
    const heartbeat = setInterval(() => {
      if (Date.now() - lastChunkTime > 30000) {
        console.warn("[WS] No chunks in 30s, closing connection");
        ws.close();
      }
    }, 5000);

    ws.on("message", async (data: Buffer) => {
      try {
        lastChunkTime = Date.now();
        chunkCount++;
        if (!initialized) {
          await uploader.initialize();
          initialized = true;
        }
        if (data.length > 0) {
          await uploader.uploadPart(data);
        }
      } catch (err) {
        console.error("[WS] Error handling chunk:", err);
        ws.close();
      }
    });

    ws.on("close", async () => {
      clearInterval(heartbeat);
      try {
        if (initialized) {
          await uploader.complete();
          console.log(`[WS] Upload complete for ${key} (${chunkCount} chunks)`);
        } else {
          await uploader.abort();
          console.log("[WS] No chunks received; upload aborted");
        }
      } catch (err) {
        console.error("[WS] Error on close:", err);
        await uploader.abort();
      }
    });

    ws.on("error", async (err) => {
      clearInterval(heartbeat);
      console.error("[WS] WebSocket error:", err);
      await uploader.abort();
    });
  });
}

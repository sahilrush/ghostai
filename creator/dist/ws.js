"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebSocketServer = startWebSocketServer;
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
const ws_1 = require("ws");
const BUCKET_NAME = "ghostmeet-chunks";
const REGION = "ap-southeast-2";
// Use environment variables for credentials in production!
const s3Client = new client_s3_1.S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "AKIAXYKJWWRM5GB5C5VN",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ||
            "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",
    },
});
class S3MultipartUploader {
    constructor(bucket, key) {
        this.bucket = bucket;
        this.key = key;
        this.partNumber = 1;
        this.parts = [];
        this.isFailed = false;
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            const command = new client_s3_1.CreateMultipartUploadCommand({
                Bucket: this.bucket,
                Key: this.key,
                ContentType: "video/webm",
            });
            const response = yield s3Client.send(command);
            this.uploadId = response.UploadId;
            console.log(`[S3] Multipart upload started (ID: ${this.uploadId})`);
        });
    }
    uploadPart(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.uploadId)
                throw new Error("Upload not initialized");
            const command = new client_s3_1.UploadPartCommand({
                Bucket: this.bucket,
                Key: this.key,
                UploadId: this.uploadId,
                PartNumber: this.partNumber,
                Body: data,
            });
            const response = yield s3Client.send(command);
            if (!response.ETag)
                throw new Error("Missing ETag from S3");
            this.parts.push({ ETag: response.ETag, PartNumber: this.partNumber });
            console.log(`[S3] Uploaded part ${this.partNumber} (${data.length} bytes)`);
            this.partNumber++;
        });
    }
    complete() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.uploadId)
                throw new Error("Upload not initialized");
            if (!this.parts.length) {
                yield this.abort();
                throw new Error("No parts uploaded; aborting");
            }
            const command = new client_s3_1.CompleteMultipartUploadCommand({
                Bucket: this.bucket,
                Key: this.key,
                UploadId: this.uploadId,
                MultipartUpload: { Parts: this.parts },
            });
            const response = yield s3Client.send(command);
            console.log(`[S3] Upload complete: ${response.Location || this.key}`);
            return response.Location;
        });
    }
    abort() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.uploadId)
                return;
            const command = new client_s3_1.AbortMultipartUploadCommand({
                Bucket: this.bucket,
                Key: this.key,
                UploadId: this.uploadId,
            });
            yield s3Client.send(command);
            console.log(`[S3] Upload aborted`);
        });
    }
}
function startWebSocketServer(port) {
    const wss = new ws_1.WebSocketServer({ port });
    console.log(`WebSocket server started on ws://localhost:${port}`);
    wss.on("connection", (ws) => {
        const key = `recording-${Date.now()}-${(0, uuid_1.v4)()}.webm`;
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
        ws.on("message", (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                lastChunkTime = Date.now();
                chunkCount++;
                if (!initialized) {
                    yield uploader.initialize();
                    initialized = true;
                }
                if (data.length > 0) {
                    yield uploader.uploadPart(data);
                }
            }
            catch (err) {
                console.error("[WS] Error handling chunk:", err);
                ws.close();
            }
        }));
        ws.on("close", () => __awaiter(this, void 0, void 0, function* () {
            clearInterval(heartbeat);
            try {
                if (initialized) {
                    yield uploader.complete();
                    console.log(`[WS] Upload complete for ${key} (${chunkCount} chunks)`);
                }
                else {
                    yield uploader.abort();
                    console.log("[WS] No chunks received; upload aborted");
                }
            }
            catch (err) {
                console.error("[WS] Error on close:", err);
                yield uploader.abort();
            }
        }));
        ws.on("error", (err) => __awaiter(this, void 0, void 0, function* () {
            clearInterval(heartbeat);
            console.error("[WS] WebSocket error:", err);
            yield uploader.abort();
        }));
    });
}

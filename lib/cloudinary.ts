import { v2 as cloudinary } from "cloudinary";
import type { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";

const CLOUDINARY_FOLDER = "kalumalu/vehicle-images";

let configured = false;

/**
 * Configure the Cloudinary SDK from the CLOUDINARY_URL env var
 * (format: cloudinary://<api_key>:<api_secret>@<cloud_name>).
 * Parsed explicitly so it works reliably in every runtime.
 */
function ensureConfig() {
  if (configured) return;

  const url = process.env.CLOUDINARY_URL;
  if (!url) {
    throw new Error("CLOUDINARY_URL is not set");
  }

  const parsed = new URL(url);
  cloudinary.config({
    cloud_name: parsed.hostname,
    api_key: parsed.username,
    api_secret: parsed.password,
  });

  configured = true;
}

/** Whether Cloudinary credentials are available in the environment. */
export function isCloudinaryConfigured(): boolean {
  return Boolean(process.env.CLOUDINARY_URL);
}

/**
 * Upload an image buffer to Cloudinary.
 * `filename` (without extension) is used as the public id so assets are
 * easy to trace back to their vehicle.
 */
export async function uploadVehicleImage(
  buffer: Buffer,
  filename: string
): Promise<{ secureUrl: string; publicId: string }> {
  ensureConfig();

  const publicId = `${CLOUDINARY_FOLDER}/${filename.replace(/\.[^.]+$/, "")}`;

  return new Promise<{ secureUrl: string; publicId: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
        },
        (error: UploadApiErrorResponse | undefined, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(error ?? new Error("Cloudinary upload failed"));
            return;
          }
          resolve({ secureUrl: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(buffer);
    }
  );
}

/** Delete an image from Cloudinary by its public id. */
export async function deleteVehicleImage(publicId: string): Promise<void> {
  ensureConfig();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
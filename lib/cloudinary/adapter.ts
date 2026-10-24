import "server-only";

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import {
  PRODUCT_IMAGE_FOLDER,
  type ProductImageAdapter,
  type ProductImageProviderMetadata,
  type ProductImageUploadInput,
} from "@/lib/catalog/image-upload";
import { getCloudinaryServerConfig } from "@/lib/cloudinary/config";

function configureCloudinary() {
  const config = getCloudinaryServerConfig();
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
  });
  return cloudinary;
}

function mapUploadResponse(response: UploadApiResponse): ProductImageProviderMetadata {
  return {
    publicId: response.public_id,
    secureUrl: response.secure_url,
    width: response.width,
    height: response.height,
  };
}

export function createCloudinaryImageAdapter(): ProductImageAdapter {
  return {
    upload: (input: ProductImageUploadInput) => new Promise((resolve, reject) => {
      const client = configureCloudinary();
      const stream = client.uploader.upload_stream(
        {
          folder: PRODUCT_IMAGE_FOLDER,
          resource_type: "image",
          type: "upload",
          use_filename: false,
          unique_filename: true,
          overwrite: false,
          allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        },
        (error, result) => {
          if (error || !result) {
            reject(new Error("Cloudinary upload failed"));
            return;
          }
          resolve(mapUploadResponse(result));
        },
      );
      stream.end(input.data);
    }),
    destroy: (publicId: string) => new Promise((resolve, reject) => {
      const client = configureCloudinary();
      client.uploader.destroy(publicId, { resource_type: "image", type: "upload", invalidate: true }, (error, result) => {
        if (error || !result) {
          reject(new Error("Cloudinary deletion failed"));
        } else if (result.result === "ok") {
          resolve("ok");
        } else if (result.result === "not found") {
          resolve("not found");
        } else {
          reject(new Error("Cloudinary deletion failed"));
        }
      });
    }),
  };
}

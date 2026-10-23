import "server-only";

export interface CloudinaryServerConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function required(name: "CLOUDINARY_CLOUD_NAME" | "CLOUDINARY_API_KEY" | "CLOUDINARY_API_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getCloudinaryServerConfig(): CloudinaryServerConfig {
  return {
    cloudName: required("CLOUDINARY_CLOUD_NAME"),
    apiKey: required("CLOUDINARY_API_KEY"),
    apiSecret: required("CLOUDINARY_API_SECRET"),
  };
}

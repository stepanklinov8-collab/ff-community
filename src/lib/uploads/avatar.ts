const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const FORMATS = {
  jpeg: { mimeType: "image/jpeg", extension: "jpg" },
  png: { mimeType: "image/png", extension: "png" },
  webp: { mimeType: "image/webp", extension: "webp" },
} as const;

export class AvatarUploadError extends Error {}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}

function isWebp(bytes: Uint8Array) {
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function readAvatarUpload(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    throw new AvatarUploadError("Выберите изображение для загрузки");
  }
  if (value.size > MAX_AVATAR_BYTES) {
    throw new AvatarUploadError("Изображение должно быть не больше 5 МБ");
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  const format = isJpeg(bytes) ? FORMATS.jpeg : isPng(bytes) ? FORMATS.png : isWebp(bytes) ? FORMATS.webp : null;
  if (!format) {
    throw new AvatarUploadError("Разрешены только настоящие JPEG, PNG и WebP изображения");
  }
  if (value.type && value.type !== format.mimeType && !(format.mimeType === "image/jpeg" && value.type === "image/jpg")) {
    throw new AvatarUploadError("Расширение и содержимое изображения не совпадают");
  }

  return { bytes, ...format };
}

export function storagePathFromPublicUrl(publicUrl: string | null | undefined, bucket: string) {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  try {
    const url = new URL(publicUrl);
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    return url.pathname
      .slice(markerIndex + marker.length)
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");
  } catch {
    return null;
  }
}

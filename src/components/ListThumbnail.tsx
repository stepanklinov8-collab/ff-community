"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { allowedBackendRequest, backendImageUrl } from "@/platform/backend-transport";

function thumbnailSource(src: string) {
  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!endpoint) return null;
  try {
    const url = new URL(src);
    if (url.origin !== new URL(endpoint).origin || url.search || url.hash
      || !allowedBackendRequest(url.pathname, "GET")
      || !url.pathname.startsWith("/storage/v1/object/public/")
      || !/\.(jpe?g|png|webp|avif)$/i.test(url.pathname)) return null;
    // The browser always requests the generated image from our own domain.
    if (url.protocol === "https:") return url.href;
    const proxied = backendImageUrl(src);
    return proxied.startsWith("/") ? proxied : null;
  } catch {
    return null;
  }
}

export default function ListThumbnail({ src, alt, onError, ...props }: Omit<ImageProps, "src" | "unoptimized"> & {src: string}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const optimized = failedSource === src ? null : thumbnailSource(src);
  return <Image
    {...props}
    src={optimized ?? backendImageUrl(src)}
    alt={alt}
    unoptimized={!optimized}
    onError={(event) => {
      if (optimized) setFailedSource(src);
      else onError?.(event);
    }}
  />;
}

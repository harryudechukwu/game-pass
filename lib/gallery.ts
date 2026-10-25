// Uploaded Cloudinary URLs are stored unmodified so the originals remain
// available; these delivery URLs ask Cloudinary for smaller, auto-formatted
// copies on the public page and in the admin grid.
export function galleryImageUrl(url: string, width: number): string {
  const marker = "/image/upload/";
  const index = url.indexOf(marker);
  if (index < 0) return url;
  return `${url.slice(0, index + marker.length)}f_auto,q_auto,c_limit,w_${width}/${url.slice(index + marker.length)}`;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeSlash, FloppyDisk, ImageSquare, UploadSimple } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { ErrorNote, Loading } from "@/components/ui";
import { galleryImageUrl } from "@/lib/gallery";

type Photo = {
  _id: string;
  url: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  published: boolean;
  createdAt: number;
};

export default function WebsitePage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await api<{ photos: Photo[]; uploadConfigured: boolean }>("/api/admin/gallery");
    setPhotos(data.photos);
    setConfigured(data.uploadConfigured);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof ApiClientError ? e.message : "Could not load the gallery.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setError(""); setMessage(""); setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("alt", alt.trim());
      form.append("caption", caption.trim());
      const response = await fetch("/api/admin/gallery/upload", { method: "POST", body: form });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error?.message ?? "Upload failed.");
      await load();
      setFile(null); setAlt(""); setCaption("");
      if (fileInput.current) fileInput.current.value = "";
      setMessage("Photo added to the website gallery.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  function changePhoto(id: string, changes: Partial<Photo>) {
    setPhotos((current) => current.map((photo) => photo._id === id ? { ...photo, ...changes } : photo));
  }

  async function save(photo: Photo, changes: { alt?: string; caption?: string; published?: boolean }) {
    setError(""); setMessage(""); setSavingId(photo._id);
    try {
      await api("/api/admin/gallery", { method: "PATCH", body: { id: photo._id, ...changes } });
      await load();
      setMessage(changes.published === false ? "Photo hidden from the website." : changes.published === true ? "Photo is visible again." : "Photo details saved.");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save the photo.");
      await load().catch(() => {});
    } finally { setSavingId(null); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="admin-head">
        <h1 className="text-2xl font-black tracking-tight">Website gallery</h1>
        <p className="mt-1 text-sm text-white/55">Add real venue photos to the public landing page. Only the owner admin can manage them.</p>
      </div>

      {error && <ErrorNote message={error} />}
      {message && <p role="status" className="rounded-xl border border-[#b8dfc7] bg-[#e9f8ef] p-3 text-sm font-semibold text-[#17623c]">{message}</p>}
      {!configured && <p className="rounded-xl border border-[#f1d28a] bg-[#fff7e5] p-4 text-sm text-[#684d13]">Uploads need Cloudinary credentials in the site’s environment settings. Existing photos can still be edited.</p>}

      <form onSubmit={upload} className="card grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label className="label" htmlFor="venue-photo">Venue photo</label>
          <input
            ref={fileInput}
            id="venue-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="input w-full"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="mt-2 text-xs text-white/55">JPEG, PNG or WebP. Up to 4 MB per photo. Please get permission before showing identifiable visitors, especially children.</p>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview of selected venue photo" className="mt-4 aspect-[4/3] w-full rounded-xl object-cover" />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="venue-alt">What does the photo show?</label>
            <input id="venue-alt" className="input w-full" value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={140} placeholder="e.g. Kids playing arcade games inside Creamy Castle" required />
            <p className="mt-1 text-xs text-white/55">This description helps visitors using screen readers and helps search engines understand the image.</p>
          </div>
          <div>
            <label className="label" htmlFor="venue-caption">Short caption (optional)</label>
            <input id="venue-caption" className="input w-full" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={120} placeholder="e.g. The games area" />
          </div>
          <button className="btn-primary mt-auto w-full" disabled={!configured || !file || alt.trim().length < 5 || busy} type="submit">
            <UploadSimple size={18} /> {busy ? "Uploading…" : "Add photo"}
          </button>
        </div>
      </form>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ImageSquare size={20} />
          <h2 className="text-lg font-bold">Photos ({photos.filter((photo) => photo.published).length} visible)</h2>
        </div>
        {photos.length === 0 ? (
          <p className="card p-5 text-sm text-white/55">No photos yet. Upload a few clear shots of the venue, games, and treats.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {photos.map((photo) => (
              <article key={photo._id} className={`card overflow-hidden ${photo.published ? "" : "opacity-65"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={galleryImageUrl(photo.url, 640)} alt={photo.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <div className="space-y-3 p-4">
                  <span className="text-xs font-semibold text-white/55">{photo.published ? "Visible on website" : "Hidden from website"}</span>
                  <div><label className="label" htmlFor={`alt-${photo._id}`}>Photo description</label><input id={`alt-${photo._id}`} className="input w-full" value={photo.alt} maxLength={140} onChange={(event) => changePhoto(photo._id, { alt: event.target.value })} /></div>
                  <div><label className="label" htmlFor={`caption-${photo._id}`}>Caption</label><input id={`caption-${photo._id}`} className="input w-full" value={photo.caption} maxLength={120} onChange={(event) => changePhoto(photo._id, { caption: event.target.value })} /></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost flex-1 !py-2 text-sm" disabled={savingId === photo._id || photo.alt.trim().length < 5} onClick={() => save(photo, { alt: photo.alt, caption: photo.caption })}><FloppyDisk size={16} /> Save</button>
                    <button type="button" className="btn-ghost flex-1 !py-2 text-sm" disabled={savingId === photo._id} onClick={() => save(photo, { published: !photo.published })}>{photo.published ? <EyeSlash size={16} /> : <Eye size={16} />}{photo.published ? "Hide" : "Show"}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

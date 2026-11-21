# Avatar upload: design (short)

**Date:** 2026-11-21 · **Status:** Draft for approval · **Size:** small change, one PR

## Intent

Today a profile photo is an `https://` URL typed into a text box on `/account`
(`user_profiles.avatar_url`), and nothing outside that form shows it: the desktop top bar
and the Library header show initials. People should be able to pick a photo from their
phone and see it wherever their initials show now.

## Goals / non-goals / anti-goals

- **Goals:** upload from the device (phone photo picker or camera), replace, remove; the
  photo shows in place of initials in `AccountAvatarLink` (desktop top bar, Library
  header) and in the profile form.
- **Non-goals:** a crop/zoom control (operator: automatic centre crop is fine); author
  lines on Discover (they can use it when they are built); moderation (single user today;
  noted as a pre-signup item).
- **Anti-goals:** shipping a phone photo's EXIF (it carries GPS); a stale photo after a
  change because of caching; an upload that leaves the old file behind forever.

## Approaches

1. **Centre-crop and resize in the browser, store one 512px square.** *Chosen.* A canvas
   draws the largest centred square of the photo at 512×512 and encodes WebP (quality
   ~0.85). Re-encoding drops all metadata, including GPS. Every display is a circle over
   that square (`object-cover`, `rounded-full`), so the circle shows the middle of the
   photo and the square's corners are simply masked.
2. **Store the original, crop with CSS at display.** Rejected: multi-megabyte phone
   photos served for a 36px chip, and the EXIF/GPS stays in the stored file.
3. **Resize on the server** (route handler with an image library). Rejected: a new
   dependency and server CPU for something the browser does well; the server still
   validates type and size.

## Design

- **Storage:** a public-read Supabase Storage bucket `avatars`, created by a migration
  (`config.toml` buckets exist only locally) and mirrored in `config.toml` for local.
  Objects at `avatars/<user_id>/<random>.webp`. Storage RLS: insert/update/delete only
  where the first path segment is `auth.uid()`; select is public (the bucket is public).
  Bucket limits: `image/webp` only, 1 MB max.
- **Flow on `/account`:** the URL text box is replaced by the current photo (or initials)
  with **Change photo** (`<input type="file" accept="image/*">`) and **Remove**.
  Change: decode in the browser (reject non-images and anything over 15 MB before
  decoding), centre-crop to 512×512 WebP, upload with the user's client to a new random
  path, then save `avatar_url` (the object's public URL, which satisfies the existing
  `https://` check) through the existing `PATCH /api/profile`, then delete the previous
  object if it was in the user's own folder, then `router.refresh()` so the top bar
  updates. Remove: set `avatar_url` to null and delete the object.
  Failures say so in place (toast) and leave the old photo.
- **Display:** `AccountAvatarLink` takes an optional `avatarUrl` and renders the image
  (`Avatar` with `AvatarImage` + initials as `AvatarFallback`). `getViewer()` returns the
  URL alongside `displayName`.
- **Existing URL avatars:** a URL that is not in the bucket keeps working; Change replaces
  it. The text box goes away.
- **Privacy:** `/privacy` gains a line that profile photos are stored and are public when
  the profile is public.
- **Operator item:** the bucket migration deploys with the merge; check on a phone that
  picking a photo, replacing it, and removing it all work, and that the top bar updates.

## Left to the builder

Button copy, the loading state while uploading, and the exact WebP quality.

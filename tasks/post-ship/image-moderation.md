# Image Moderation for Uploads

**Status:** Not started
**Priority:** Before signups open (Phase 6). Near-zero risk while the operator is the only
user.
**Related:** [Public content moderation](./public-content-moderation.md),
[Generated cover art](./generated-cover-art.md) (custom uploads),
`docs/superpowers/specs/2026-11-21-avatar-upload-design.md`

## Why it matters

Profile photos shipped 2026-11-21 (#149). A photo shows to strangers wherever a public
profile's author line appears, and nothing checks what it is. Custom cover uploads, when
they come, show on Discover. Apps that display user-uploaded images to strangers
normally check them automatically at upload and reject sexual, violent or hateful
images; many also match uploads against databases of known child sexual abuse material.

## Today

The browser centre-crops and re-encodes the photo (512px WebP/JPEG, EXIF stripped) and
uploads it **straight to Storage** with the user's session (`avatars/<user_id>/…`, owner
folder policies). `PATCH /api/profile` accepts only a URL in the caller's own folder.

## Scope sketch

- **Route uploads through the server.** A route handler receives the processed image,
  runs the check, and only then writes to Storage with the service role. The direct
  browser upload and its insert/update policies go away.
- **The check.** Candidates: OpenAI's moderation endpoint (free, accepts images), AWS
  Rekognition `DetectModerationLabels`, Google Cloud Vision SafeSearch, Sightengine, Hive
  (paid, roughly a tenth of a cent per image). A small Claude model can classify images
  but is not built for this and does no known-image matching. Pick one; reject with a
  plain message; log rejections without storing the image.
- **Upload quota** (from the #149 review): today any signed-in user can upload unlimited
  1 MB public objects. Cap uploads per user per day.
- **Report and take down.** A way to report a profile, and an operator takedown that
  clears `avatar_url` and deletes the object, as the meditation Report link works.
- `/privacy` and `/terms` say photos are checked automatically.

## Decisions to make

- Which provider, and whether its terms allow sending user images.
- What happens to an existing photo that a later check would reject.
- Whether the same route serves custom cover uploads from day one.

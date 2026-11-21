/**
 * The image model every generated cover is made with, through Vercel AI
 * Gateway (docs/superpowers/specs/2026-11-21-generated-cover-art-design.md).
 * The operator chose FLUX 2 Klein from real output of four models; moving to
 * `bfl/flux-2-pro` or later is this one line.
 */
export const COVER_MODEL = "bfl/flux-2-klein-9b";

/**
 * Covers the studio may generate for one meditation. A failed generation is
 * given back. The reserve RPC (20261121020000_cover_generation_rpc.sql) and
 * the column's check constraint hold the same number.
 */
export const COVER_CAP = 3;

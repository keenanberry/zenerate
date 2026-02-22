# UI Enhancements — Taking Zenerate to the Next Level

A roadmap of UI/UX improvements beyond the initial POC, roughly ordered by impact.

---

## High Priority

### 1. Dark Mode Toggle
The amethyst-haze theme already has full dark mode variables defined. Add a theme toggle in the nav (sun/moon icon) using `next-themes` to persist preference.

### 2. Meditation Creation UX Overhaul
- **Multi-step wizard** instead of a single form: (1) Choose type & duration → (2) Set intention & preferences → (3) Generate & preview → (4) Save & configure visibility
- **Regenerate sections** — ability to regenerate just the intro, body, or closing of a script
- **Edit script inline** — let users tweak the generated text before saving, with a split view (raw markup on left, rendered preview on right)
- **Template presets** — one-click generation from popular templates (Morning Calm, Sleep Wind-Down, Focus Session, etc.)

### 3. Real Audio Player
Replace the stubbed placeholder with a proper player:
- Waveform visualization (using `wavesurfer.js` or similar)
- Play/pause, seek bar, time display, volume slider
- Persistent mini-player at the bottom of the page that continues playback during navigation
- Queue support — play through a collection continuously

### 4. Discover Page Improvements
- **Category filters** — pills for meditation type (guided, breathwork, body scan, etc.)
- **Duration filters** — 5 min, 10 min, 15 min, 20+ min
- **Sort options** — newest, most favorited, trending
- **Infinite scroll** or pagination (currently hard-limited to 50)
- **Creator attribution** — show avatar/name on cards, link to "creator profile" (future)

### 5. Loading & Empty States
- **Skeleton loaders** — replace plain `animate-pulse` divs with shaped skeletons that match card layouts
- **Illustrated empty states** — custom illustrations for "no meditations yet", "no favorites", "empty collection"
- **Optimistic updates** — favorite/unfavorite, add-to-collection should feel instant (already partially done, but could improve transitions)

---

## Medium Priority

### 6. Collection Management
- ~~**Track list view**~~ ✅ Spotify-style track list with index, type badge, duration, date, and hover-to-play indicator. Used on collections, dashboard, and discover. Grid/list toggle available.
- **Drag-to-reorder** meditations within a collection
- **Collection cover image** — auto-generated gradient or user-uploaded
- **Edit collection** inline — rename, update description without a separate page
- **Delete confirmation** dialogs for destructive actions

### 7. Responsive & Mobile
- **Mobile nav** — hamburger/sheet menu for small screens (shadcn Sheet is already installed)
- **Touch-friendly** cards and buttons — larger tap targets on mobile
- **Bottom navigation** bar on mobile (Library, Create, Discover) like native apps
- **Swipe gestures** on cards (swipe right to favorite, swipe left to dismiss)

### 8. Script Viewer Enhancements
- **Estimated duration display** — calculate total time from pauses + silence + estimated speech duration
- **Segment timeline** — visual timeline bar showing the proportion of speech vs silence vs pauses
- **Collapsible sections** — group speech segments between sound markers as "chapters"
- **Copy script** button for sharing the raw text

### 9. Toast / Notification System
- Use Sonner (already installed) for:
  - "Meditation saved" confirmation
  - "Added to collection" feedback
  - "Script generation failed" error
  - "Copied to clipboard" feedback
- Currently no toasts are wired up — all actions are silent

### 10. Search & Filtering on Dashboard
- Add search to "My Meditations" tab (currently only Discover has search)
- Filter by status (script ready, processing, completed)
- Filter by type from settings metadata
- Sort by date, title, or status

---

## Nice to Have

### 11. Onboarding Flow
- First-time user experience after signup
- Guided tour of key features (create, discover, collections)
- Suggest creating their first meditation with a pre-filled template

### 12. User Profiles
- `/profile/[userId]` — public page showing a user's public meditations
- Avatar upload (Supabase Storage)
- Display name, bio
- Follow system (future)

### 13. Analytics Dashboard
- Personal stats: total meditations created, total listen time (Phase 2), streak tracking
- "Weekly practice" chart
- Most-played meditations

### 14. Keyboard Shortcuts
- `Cmd+K` — quick search across all meditations
- `Cmd+N` — new meditation
- `Space` — play/pause audio (Phase 2)
- `F` — toggle favorite on detail page

### 15. Animations & Transitions
- Page transitions between routes (Framer Motion or View Transitions API)
- Card hover effects with subtle depth/shadow changes
- Smooth expand/collapse for script sections
- Gentle fade-in for streaming script text during generation

### 16. Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation through card grids
- Screen reader announcements for status changes
- Focus management after dialog close
- Reduced motion preference support

### 17. PWA Support
- Service worker for offline access to saved scripts
- Add-to-home-screen prompt
- Push notifications for audio generation completion (Phase 2)

---

## Design System Refinements

### Typography
- The amethyst-haze theme defines a serif font (Lora) — consider using it for meditation script text to create a more literary, calming reading experience
- Larger line-height for script text (1.8+) to improve readability

### Color Usage
- Use the rose-pink accent color more intentionally — currently underused
- Gradient backgrounds for hero sections and card headers
- Subtle purple-to-pink gradient on the primary CTA button

### Spacing & Layout
- Increase card padding for a more "breathable" feel (meditation app should feel spacious)
- Max width of content area could be narrower for script reading (prose-friendly width ~65ch)
- More vertical whitespace between sections

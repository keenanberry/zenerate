# UI Enhancements — Roadmap

Roughly ordered by impact. Items marked ~~strikethrough~~ with ✅ are complete.

---

## High Priority

### ~~1. Dark Mode Toggle~~ ✅
Theme toggle (sun/moon icon) in nav and landing page using `next-themes`. Persists preference, supports system detection.

### ~~2. Meditation Creation UX Overhaul~~ ✅
- ~~Multi-step wizard (4 steps: Type & Duration → Intention & Preferences → Generate & Preview → Save & Configure)~~
- ~~Template presets (8 quick-start templates covering common meditation types)~~
- ~~Inline script editor with split view (desktop) / tabbed edit+preview (mobile)~~
- **Conversational regeneration** (future) — provide feedback on a generated script and regenerate with context, rather than manual section editing

### 3. Audio Generation UX
The next major UX challenge: bridging the gap between a saved script and a finished audio meditation.

Open questions to resolve:
- **Trigger point** — where/when does the user initiate audio generation? A button on the meditation detail page? A new step in the creation wizard? A separate "Produce" flow?
- **Voice selection** — present a gallery of voices with short audio previews so users can audition before committing. Consider a "preview sentence" feature that reads a snippet of their actual script in the selected voice.
- **Audio options** — background music selection, volume levels, sound effects. Could be a simple settings panel or a more immersive mixing interface.
- **Progress & status** — the audio pipeline is multi-step and takes time. Need clear progress indication (e.g., "Generating speech... Mixing audio... Finalizing...") with the ability to navigate away and come back.
- **Preview & iterate** — let users listen to the result and re-generate with different voice/music options before finalizing.

### 4. Real Audio Player
Replace the stubbed placeholder with a proper player:
- Waveform visualization (using `wavesurfer.js` or similar)
- Play/pause, seek bar, time display, volume slider
- Persistent mini-player at the bottom of the page that continues playback during navigation
- Queue support — play through a collection continuously

### 5. Discover Page Improvements
- **Category filters** — pills for meditation type (guided, breathwork, body scan, etc.)
- **Duration filters** — 5 min, 10 min, 15 min, 20+ min
- **Sort options** — newest, most favorited, trending
- **Infinite scroll** or pagination (currently hard-limited to 50)
- **Creator attribution** — show avatar/name on cards, link to "creator profile" (future)

### 6. Loading & Empty States
- **Skeleton loaders** — replace plain `animate-pulse` divs with shaped skeletons that match card layouts
- **Illustrated empty states** — custom illustrations for "no meditations yet", "no favorites", "empty collection"
- **Optimistic updates** — favorite/unfavorite, add-to-collection should feel instant (already partially done, but could improve transitions)

---

## Medium Priority

### 7. Collection Management
- ~~**Track list view**~~ ✅ Spotify-style track list with index, type badge, duration, date, and hover-to-play indicator. Used on collections, dashboard, and discover. Grid/list toggle available.
- **Drag-to-reorder** meditations within a collection
- **Collection cover image** — auto-generated gradient or user-uploaded
- **Edit collection** inline — rename, update description without a separate page
- **Delete confirmation** dialogs for destructive actions

### 8. Responsive & Mobile
- ~~**Mobile-friendly nav**~~ ✅ Icon-only nav on small screens, responsive spacing
- ~~**Responsive creation wizard**~~ ✅ Compact step indicator on mobile, stacked layouts, full-width buttons
- **Bottom navigation** bar on mobile (Library, Create, Discover) like native apps
- **Swipe gestures** on cards (swipe right to favorite, swipe left to dismiss)

### 9. Script Viewer Enhancements
- **Estimated duration display** — calculate total time from pauses + silence + estimated speech duration
- **Segment timeline** — visual timeline bar showing the proportion of speech vs silence vs pauses
- **Collapsible sections** — group speech segments between sound markers as "chapters"
- **Copy script** button for sharing the raw text

### 10. Toast / Notification System
- Use Sonner (already installed) for:
  - "Meditation saved" confirmation
  - "Added to collection" feedback
  - "Script generation failed" error
  - "Copied to clipboard" feedback
- Currently no toasts are wired up — all actions are silent

### 11. Search & Filtering on Dashboard
- Add search to "My Meditations" tab (currently only Discover has search)
- Filter by status (script ready, processing, completed)
- Filter by type from settings metadata
- Sort by date, title, or status

---

## Nice to Have

### 12. Onboarding Flow
- First-time user experience after signup
- Guided tour of key features (create, discover, collections)
- Suggest creating their first meditation with a pre-filled template

### 13. User Profiles
- `/profile/[userId]` — public page showing a user's public meditations
- Avatar upload (Supabase Storage)
- Display name, bio
- Follow system (future)

### 14. Analytics Dashboard
- Personal stats: total meditations created, total listen time, streak tracking
- "Weekly practice" chart
- Most-played meditations

### 15. Keyboard Shortcuts
- `Cmd+K` — quick search across all meditations
- `Cmd+N` — new meditation
- `Space` — play/pause audio
- `F` — toggle favorite on detail page

### 16. Animations & Transitions
- Page transitions between routes (Framer Motion or View Transitions API)
- Card hover effects with subtle depth/shadow changes
- Smooth expand/collapse for script sections
- Gentle fade-in for streaming script text during generation

### 17. Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation through card grids
- Screen reader announcements for status changes
- Focus management after dialog close
- Reduced motion preference support

### 18. PWA Support
- Service worker for offline access to saved scripts
- Add-to-home-screen prompt
- Push notifications for audio generation completion

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

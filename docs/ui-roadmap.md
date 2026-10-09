# UI Roadmap

Post-ship UI improvements, roughly ordered by impact. For pre-ship work see `tasks/ship/`.

---

## High Priority

### 1. Discover Page Improvements
- **Category filters** — pills for meditation type (guided, breathwork, body scan, etc.)
- **Duration filters** — 5 min, 10 min, 15 min, 20+ min
- **Sort options** — newest, most favorited, trending
- **Infinite scroll** or pagination (currently hard-limited to 50)
- **Creator attribution** — show avatar/name on cards, link to creator profile (future)

### 2. Loading & Empty States
- **Skeleton loaders** — replace plain `animate-pulse` divs with shaped skeletons that match card layouts
- **Illustrated empty states** — custom illustrations for "no meditations yet", "no favorites", "empty collection"
- **Optimistic updates** — favorite/unfavorite, add-to-collection should feel instant (already partially done)

### 3. Conversational Script Regeneration
Provide feedback on a generated script and regenerate with context, rather than manual section editing. Feeds into the post-ship form-based editor.

---

## Medium Priority

### 4. Collection Management
- **Drag-to-reorder** meditations within a collection
- **Collection cover image** — auto-generated gradient or user-uploaded
- **Edit collection** inline — rename, update description without a separate page
- **Delete confirmation** dialogs for destructive actions

### 5. Mobile Polish
- **Bottom navigation** bar on mobile (Library, Create, Discover) like native apps
- **Swipe gestures** on cards (swipe right to favorite, swipe left to dismiss)

### 6. Script Viewer Enhancements
- **Estimated duration display** — calculate total time from pauses + silence + estimated speech duration
- **Segment timeline** — visual timeline bar showing the proportion of speech vs silence vs pauses
- **Collapsible sections** — group speech segments between sound markers as "chapters"
- **Copy script** button for sharing the raw text

### 7. Search & Filtering on Dashboard
- Add search to "My Meditations" tab (currently only Discover has search)
- Filter by status (script ready, processing, completed)
- Filter by type from settings metadata
- Sort by date, title, or status

---

## Nice to Have

### 8. Onboarding Flow
- First-time user experience after signup
- Guided tour of key features (create, discover, collections)
- Suggest creating their first meditation with a pre-filled template

### 9. User Profiles
- `/profile/[userId]` — public page showing a user's public meditations
- Avatar upload (Supabase Storage)
- Display name, bio
- Follow system (future)

### 10. Personal Analytics
- Personal stats: total meditations created, total listen time, streak tracking
- "Weekly practice" chart
- Most-played meditations

### 11. Keyboard Shortcuts
- `Cmd+K` — quick search across all meditations
- `Cmd+N` — new meditation
- `Space` — play/pause audio
- `F` — toggle favorite on detail page

### 12. Animations & Transitions
- Page transitions between routes (Framer Motion or View Transitions API)
- Smooth expand/collapse for script sections
- Gentle fade-in for streaming script text during generation

Task 21 did card hover (a lighter surface, `--card-hover`, not a shadow: shadows are
out under DESIGN.md's Lightness Rule) and the playback fade in the script viewer.

### 13. Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation through card grids
- Screen reader announcements for status changes
- Focus management after dialog close
- Reduced motion: transitions added or touched in task 21 are under `motion-safe:`; the
  shadcn overlay animations (dialog, popover, menus) are not yet

### 14. PWA Support
- Service worker for offline access to saved scripts
- Add-to-home-screen prompt
- Push notifications for audio generation completion

---

## Design System Refinements

Colour usage and spacing were settled by the Nocturne pass (task 21) and are recorded in
`DESIGN.md`: the rose lives in the player gradient, card padding and vertical rhythm are a
table under Layout, and width is chosen per content type. Gradients on heroes, card
headers or CTAs are ruled out by the One Gradient Rule, not deferred.

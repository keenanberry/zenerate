# Let the Owner Delete a Chat

**Status:** Not started
**Priority:** Post-ship

## Why it matters
Chats are kept until the account is deleted. Deleting a meditation keeps its chat
(`chats.meditation_id` is `on delete set null`) so the conversation can restart the
meditation, and there is no action or UI that deletes a chat. `/privacy` (task 38) says so,
and tells people to email `privacy@zeneratestudio.com` to have one deleted sooner.

## Scope sketch
- A server action that deletes the caller's chat. RLS (`delete_own` on `chats`) already
  allows it, and `chat_messages` cascades from `chats`.
- A delete control in the studio's chat list or chat header, with a confirmation.
- Update `/privacy` in the same PR: a chat can be deleted directly.

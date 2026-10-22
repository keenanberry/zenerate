-- Clear the chat's first message from studio meditations (ship task 38).
--
-- Until this task, the studio's writeScript copied the chat's first user
-- message into meditations.prompt. Chats are owner-only, always, but prompt
-- is a meditations column, and anon may SELECT meditations (20261008000000),
-- so a public meditation exposed the opening of its private conversation.
-- writeScript no longer writes it; this clears the copies already made.
--
-- Data only: no table, column, policy or grant changes, so it is safe to
-- reach production on merge. A meditation with a chats row was made in the
-- studio; its request is still in chat_messages. Wizard-era meditations have
-- no chat and keep their prompt.

update public.meditations m
set prompt = null
where m.prompt is not null
  and exists (select 1 from public.chats c where c.meditation_id = m.id);

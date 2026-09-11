-- ############################################################
-- #  LOCAL DEVELOPMENT ONLY -- NEVER APPLY TO PRODUCTION     #
-- #                                                          #
-- #  Creates test users with the password "password123".     #
-- #  Applied by `supabase db reset`, which also DROPS all    #
-- #  existing data. Production uses `supabase db push`,      #
-- #  which applies migrations only and never runs this file. #
-- #                                                          #
-- #  If you are pointed at a linked production project,      #
-- #  `db reset` will destroy real user data.                 #
-- ############################################################

-- Seed data for local development
-- Creates 2 test users and a variety of meditations, collections, and favorites

-- Create test users via Supabase auth schema
-- Password for both: "password123"
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone, phone_change, phone_change_token, reauthentication_token
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'alice@example.com', crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'alice@example.com', 'email_verified', true, 'phone_verified', false),
  false, false,
  '', '',
  '', '', '',
  NULL, '', '', ''
), (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'bob@example.com', crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'email', 'bob@example.com', 'email_verified', true, 'phone_verified', false),
  false, false,
  '', '',
  '', '', '',
  NULL, '', '', ''
);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'alice@example.com', 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'email', 'bob@example.com', 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  );

-- ── Alice's meditations ──

INSERT INTO public.meditations (id, user_id, title, prompt, script, status, is_public, settings, created_at) VALUES
(
  'aaaa0001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Morning Calm — Gratitude',
  'Generate a 10-minute guided meditation.
Focus/intention: gratitude',
  '*[SOUND: bell-tibetan.mp3]*

Welcome to this moment of stillness. Allow yourself to arrive, just as you are.

*[PAUSE: 3 seconds]*

Gently close your eyes. Take a slow, deep breath in through your nose... and release it softly through your mouth.

*[PAUSE: 5 seconds]*

As you settle into this space, bring to mind one thing you are grateful for today. It can be something small — the warmth of sunlight, a kind word, the simple act of breathing.

*[PAUSE: 8 seconds]*

Let that feeling of gratitude fill your chest. Notice how it softens your body, how it eases the tension in your shoulders.

*[PAUSE: 5 seconds]*

Now expand that gratitude outward. Think of a person in your life who has brought you joy. Hold them gently in your awareness.

*[PAUSE: 10 seconds]*

With each breath, silently repeat: I am grateful. I am enough. I am at peace.

*[PAUSE: 5 seconds]*

*[SILENCE: 5 minutes]*

*[SOUND: gong-gentle.mp3]*

Slowly begin to deepen your breath. Wiggle your fingers and toes.

*[PAUSE: 5 seconds]*

Carry this sense of gratitude with you as you return to your day. When you are ready, gently open your eyes.

*[SOUND: bell-tibetan.mp3]*',
  'script_ready',
  false,
  '{"type": "guided", "duration": 10, "focus": "gratitude"}',
  now() - interval '3 days'
),
(
  'aaaa0002-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'Body Scan — Stress Relief',
  'Generate a 15-minute body scan meditation.
Focus/intention: stress relief',
  '*[SOUND: bowls-singing.mp3]*

Find a comfortable position, either lying down or seated. Allow your body to be fully supported.

*[PAUSE: 3 seconds]*

Close your eyes and take three deep breaths. With each exhale, let go of any tension you have been carrying.

*[PAUSE: 8 seconds]*

Bring your attention to the top of your head. Notice any sensations — tingling, warmth, tightness. Simply observe without judgment.

*[PAUSE: 5 seconds]*

Now slowly move your awareness down to your forehead... your eyes... your jaw. If you notice tension, breathe into that area and let it soften.

*[PAUSE: 8 seconds]*

Continue down to your neck and shoulders. These areas often hold so much. Invite them to release.

*[PAUSE: 10 seconds]*

Move your attention through your arms, your hands, your fingertips. Feel the life flowing through every part of you.

*[PAUSE: 8 seconds]*

Now bring awareness to your chest and your heart space. Notice the rhythm of your heartbeat — steady, reliable, always there for you.

*[PAUSE: 10 seconds]*

Continue through your belly, your lower back, your hips. Breathe softness into any areas of discomfort.

*[PAUSE: 10 seconds]*

Down through your legs, your knees, your calves, your feet. Feel the weight of your body being held by the earth beneath you.

*[PAUSE: 8 seconds]*

Now rest in this feeling of wholeness. Your entire body, scanned and softened.

*[SILENCE: 5 minutes]*

*[SOUND: chime-soft.mp3]*

Begin to bring gentle movement back. A stretch, a deep breath.

*[PAUSE: 5 seconds]*

You have given your body a gift of attention. Carry this awareness with you.

*[SOUND: bell-crystal.mp3]*',
  'script_ready',
  false,
  '{"type": "body-scan", "duration": 15, "focus": "stress relief"}',
  now() - interval '2 days'
),
(
  'aaaa0003-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'Breathwork — Morning Energy',
  'Generate a 5-minute breathwork meditation.
Focus/intention: morning energy',
  '*[SOUND: bell-tibetan.mp3]*

Good morning. This short breathwork practice will fill you with energy and clarity for the day ahead.

*[PAUSE: 3 seconds]*

Sit upright with your spine tall. Rest your hands on your knees.

*[PAUSE: 3 seconds]*

We will begin with energizing breaths. Inhale deeply through your nose for four counts... hold for four... and exhale powerfully through your mouth for four.

*[PAUSE: 3 seconds]*

Ready? Inhale... two... three... four. Hold... two... three... four. Exhale... two... three... four.

*[PAUSE: 5 seconds]*

Again. Inhale deeply... hold... and release.

*[PAUSE: 5 seconds]*

One more round. Deep breath in... hold at the top... and let it all go.

*[PAUSE: 5 seconds]*

Now return to natural breathing. Notice the tingling in your body, the alertness in your mind.

*[PAUSE: 8 seconds]*

Set one intention for your day. Something simple. Hold it clearly in your mind.

*[SILENCE: 1 minutes]*

*[SOUND: gong-gentle.mp3]*

You are ready. Open your eyes and step into your day with purpose.

*[SOUND: bell-tibetan.mp3]*',
  'script_ready',
  false,
  '{"type": "breathwork", "duration": 5, "focus": "morning energy"}',
  now() - interval '1 day'
),
(
  'aaaa0004-0000-0000-0000-000000000004',
  '11111111-1111-1111-1111-111111111111',
  'Sleep Meditation — Letting Go',
  'Generate a 20-minute sleep meditation.
Focus/intention: letting go of the day',
  '*[SOUND: bowls-singing.mp3]*

Welcome to this sleep meditation. There is nothing left to do today. Nothing to fix, nothing to plan. Just rest.

*[PAUSE: 5 seconds]*

Lie comfortably in your bed. Let the pillow cradle your head. Let the blankets hold you.

*[PAUSE: 5 seconds]*

Take a long, slow breath in... and sigh it out. Let your body sink deeper into the mattress.

*[PAUSE: 8 seconds]*

With each exhale, release one thing from today. A worry... a task... a conversation. Just let it drift away like a cloud.

*[PAUSE: 10 seconds]*

Your eyes are heavy. Your muscles are soft. The day is complete.

*[PAUSE: 5 seconds]*

Imagine yourself in a quiet meadow at dusk. The sky is painted in soft purples and golds. A warm breeze passes over you.

*[PAUSE: 10 seconds]*

Fireflies begin to appear, each one carrying a thought from today. Watch them drift upward... higher and higher... until they become stars.

*[PAUSE: 10 seconds]*

The meadow grows darker, quieter. You are safe. You are held.

*[SILENCE: 10 minutes]*

*[SOUND: chime-soft.mp3]*

Sleep well. You have done enough. You are enough.

*[PAUSE: 10 seconds]*',
  'script_ready',
  false,
  '{"type": "sleep", "duration": 20, "focus": "letting go"}',
  now() - interval '12 hours'
);

-- ── Bob's meditations ──

INSERT INTO public.meditations (id, user_id, title, prompt, script, status, is_public, settings, created_at) VALUES
(
  'bbbb0001-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'Loving Kindness — Self Compassion',
  'Generate a 10-minute loving kindness meditation.
Focus/intention: self compassion',
  '*[SOUND: bell-crystal.mp3]*

Find a comfortable seat and gently close your eyes. Place one hand on your heart if that feels right.

*[PAUSE: 5 seconds]*

Take a deep breath and feel the warmth of your own touch. You are here for yourself today.

*[PAUSE: 5 seconds]*

Begin by directing kindness inward. Silently repeat after me:

May I be happy.

*[PAUSE: 5 seconds]*

May I be healthy.

*[PAUSE: 5 seconds]*

May I be safe.

*[PAUSE: 5 seconds]*

May I live with ease.

*[PAUSE: 8 seconds]*

Now bring to mind someone you love. See their face clearly. Send them these same wishes:

May you be happy. May you be healthy. May you be safe. May you live with ease.

*[PAUSE: 10 seconds]*

Now extend this kindness to all beings everywhere. Every person carrying joy, every person carrying pain. All of us, together.

May all beings be happy. May all beings be free.

*[SILENCE: 5 minutes]*

*[SOUND: gong-gentle.mp3]*

Gently bring your awareness back. Feel the kindness you have cultivated. It is always available to you.

*[PAUSE: 5 seconds]*

Open your eyes whenever you are ready.

*[SOUND: bell-crystal.mp3]*',
  'script_ready',
  false,
  '{"type": "loving-kindness", "duration": 10, "focus": "self compassion"}',
  now() - interval '4 days'
),
(
  'bbbb0002-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  'Focus Flow — Deep Work',
  'Generate a 10-minute mindfulness meditation.
Focus/intention: focus and concentration for deep work',
  '*[SOUND: bell-tibetan.mp3]*

Welcome. This meditation will sharpen your focus and prepare your mind for deep, concentrated work.

*[PAUSE: 3 seconds]*

Sit with your back straight. Feet flat on the floor. Hands resting in your lap.

*[PAUSE: 3 seconds]*

Close your eyes and take three clearing breaths. In through the nose... out through the mouth.

*[PAUSE: 8 seconds]*

Now anchor your attention on the sensation of breathing at the tip of your nose. Cool air in... warm air out.

*[PAUSE: 5 seconds]*

When your mind wanders — and it will — simply notice where it went, and gently return to the breath. No frustration. Just a soft redirect.

*[PAUSE: 10 seconds]*

Each time you bring your attention back, you strengthen your focus. Think of it like a mental pushup.

*[PAUSE: 5 seconds]*

Continue watching the breath. In... and out. Nothing else matters in this moment.

*[SILENCE: 5 minutes]*

*[SOUND: gong-gentle.mp3]*

Well done. Your mind is now primed. Carry this single-pointed attention into your work.

*[PAUSE: 5 seconds]*

Open your eyes. You are ready.

*[SOUND: bell-tibetan.mp3]*',
  'script_ready',
  false,
  '{"type": "mindfulness", "duration": 10, "focus": "focus and concentration"}',
  now() - interval '1 day'
),
(
  'bbbb0003-0000-0000-0000-000000000003',
  '22222222-2222-2222-2222-222222222222',
  'Visualization — Mountain Retreat',
  'Generate a 15-minute visualization meditation.
Focus/intention: inner peace',
  '*[SOUND: bowls-singing.mp3]*

Close your eyes and allow yourself to be transported. We are going on a journey to a place of deep peace.

*[PAUSE: 5 seconds]*

Imagine you are walking along a forest path. The air is crisp and cool. Tall pine trees surround you, their branches gently swaying.

*[PAUSE: 8 seconds]*

Beneath your feet, soft earth and fallen needles cushion each step. You hear a stream somewhere nearby.

*[PAUSE: 5 seconds]*

The path begins to climb gently upward. With each step, you feel lighter. The weight of your responsibilities falls away.

*[PAUSE: 10 seconds]*

You emerge into a clearing at the top of a mountain. Before you stretches an endless vista of rolling hills and distant peaks.

*[PAUSE: 5 seconds]*

Find a smooth, warm rock and sit down. The sun warms your face. A gentle wind carries the scent of wildflowers.

*[PAUSE: 8 seconds]*

This is your sanctuary. No one can reach you here. No phone, no email, no obligations. Just this vast, open sky and the steady rhythm of your breathing.

*[PAUSE: 5 seconds]*

Rest here for as long as you need.

*[SILENCE: 8 minutes]*

*[SOUND: chime-soft.mp3]*

It is time to return. But know that this mountain is always here, waiting for you, inside your mind.

*[PAUSE: 5 seconds]*

Slowly walk back down the forest path. Feel the ground beneath you. Hear the sounds of the room around you.

*[PAUSE: 5 seconds]*

When you are ready, open your eyes. Welcome back.

*[SOUND: bell-crystal.mp3]*',
  'script_ready',
  false,
  '{"type": "visualization", "duration": 15, "focus": "inner peace"}',
  now() - interval '5 days'
);

-- ── Alice's collections ──

INSERT INTO public.collections (id, user_id, name, description) VALUES
(
  'cccc0001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Morning Routine',
  'My go-to meditations for starting the day right'
),
(
  'cccc0002-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'Wind Down',
  'Evening meditations for better sleep'
);

INSERT INTO public.collection_items (collection_id, meditation_id, position) VALUES
('cccc0001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 1),
('cccc0001-0000-0000-0000-000000000001', 'aaaa0003-0000-0000-0000-000000000003', 2),
('cccc0001-0000-0000-0000-000000000001', 'bbbb0002-0000-0000-0000-000000000002', 3),
('cccc0002-0000-0000-0000-000000000002', 'aaaa0004-0000-0000-0000-000000000004', 1),
('cccc0002-0000-0000-0000-000000000002', 'aaaa0002-0000-0000-0000-000000000002', 2);

-- ── Bob's collection ──

INSERT INTO public.collections (id, user_id, name, description) VALUES
(
  'cccc0003-0000-0000-0000-000000000003',
  '22222222-2222-2222-2222-222222222222',
  'Best of Community',
  'Favorite meditations from the community'
);

INSERT INTO public.collection_items (collection_id, meditation_id, position) VALUES
('cccc0003-0000-0000-0000-000000000003', 'aaaa0001-0000-0000-0000-000000000001', 1),
('cccc0003-0000-0000-0000-000000000003', 'aaaa0004-0000-0000-0000-000000000004', 2);

-- ── Favorites ──

-- Alice favorites some of Bob's meditations
INSERT INTO public.favorites (user_id, meditation_id) VALUES
('11111111-1111-1111-1111-111111111111', 'bbbb0001-0000-0000-0000-000000000001'),
('11111111-1111-1111-1111-111111111111', 'bbbb0003-0000-0000-0000-000000000003');

-- Bob favorites some of Alice's meditations
INSERT INTO public.favorites (user_id, meditation_id) VALUES
('22222222-2222-2222-2222-222222222222', 'aaaa0001-0000-0000-0000-000000000001'),
('22222222-2222-2222-2222-222222222222', 'aaaa0002-0000-0000-0000-000000000002'),
('22222222-2222-2222-2222-222222222222', 'aaaa0004-0000-0000-0000-000000000004');

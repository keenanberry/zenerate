/**
 * The landing demo's examples: what a visitor might type as a focus, and the
 * script that would arrive for it. Hand-written, so the page never spends a
 * generation; checked by examples.test.ts to one shape (a sound, three
 * passages, two pauses, a silence, 55 to 85 words) so every one streams in
 * about the same time and sits in the same card. Each opens with a different
 * sound, so the loop also shows the bells, gongs and bowls by name.
 */
export interface DemoExample {
  /** Two to four words, for the chip row under the card: one row on a desktop, three of two on a phone. */
  chip: string;
  /** Shown as the create page's prompt would be: lowercase, no full stop. */
  focus: string;
  script: string;
}

export const DEMO_EXAMPLES: DemoExample[] = [
  {
    chip: "A hard conversation",
    focus: "the night before a hard conversation",
    script: `*[SOUND: bell-tibetan.mp3]*

Settle into wherever you are sitting. There is nothing to prepare in this moment, and nothing yet to say.

*[PAUSE: 5 seconds]*

Notice the conversation you have been rehearsing. Let it move a little further away, the way a voice sounds from another room.

*[PAUSE: 8 seconds]*

Breathe in slowly. As you breathe out, let your jaw soften and your shoulders drop.

*[SILENCE: 1 minute]*`,
  },
  {
    chip: "A new baby",
    focus: "the week the baby came home",
    script: `*[SOUND: gong-gentle.mp3]*

Find a position you can hold for a few minutes, even if it is not the one you planned.

*[PAUSE: 5 seconds]*

Notice how much of you is listening for the next room. Let that listening stay, and let the rest of you rest.

*[PAUSE: 8 seconds]*

Breathe out slowly. Whatever is undone can wait the length of one breath, and then another.

*[SILENCE: 1 minute]*`,
  },
  {
    chip: "Loving-kindness",
    focus: "loving-kindness for someone I'm angry at",
    script: `*[SOUND: bowls-singing.mp3]*

Begin with yourself. Breathe in, and wish yourself ease, the way you would for a friend who is tired.

*[PAUSE: 6 seconds]*

Now let the person come to mind, just as they are. You need not agree with them to wish them a quiet night.

*[PAUSE: 8 seconds]*

If the anger returns, let it sit beside the wish rather than in place of it. Both can be here.

*[SILENCE: 1 minute]*`,
  },
  {
    chip: "A book I finished",
    focus: "what stayed with me from The Power of Now",
    script: `*[SOUND: bell-crystal.mp3]*

Set the book down, in your mind as well as your hands. One idea from it is enough to sit with.

*[PAUSE: 5 seconds]*

Let a line you underlined come back to you. Say it once, slowly, and then stop repeating it.

*[PAUSE: 10 seconds]*

Notice this moment, the one the line was pointing at. It was here before you read about it.

*[SILENCE: 1 minute]*`,
  },
  {
    chip: "An anniversary",
    focus: "the anniversary of losing my dad",
    script: `*[SOUND: gong-deep.mp3]*

There is nowhere you need to be for the next few minutes, and nothing you need to feel on schedule.

*[PAUSE: 8 seconds]*

Let your dad come to mind however he arrives today: a voice, a habit, a room. Stay with whatever comes.

*[PAUSE: 10 seconds]*

Breathe in. Breathe out. Grief and love are using the same breath, and there is room for both.

*[SILENCE: 1 minute]*`,
  },
  {
    chip: "Sleep after a shift",
    focus: "falling asleep after a late shift",
    script: `*[SOUND: chime-soft.mp3]*

Lie down and let the bed take your full weight. The shift is over, and nothing from it needs you now.

*[PAUSE: 8 seconds]*

Let the sounds of the last few hours fade one by one, like lights going off in a building after closing.

*[PAUSE: 12 seconds]*

Breathe out a little longer than you breathe in. Each breath out is one step further from the door.

*[SILENCE: 2 minutes]*`,
  },
];

/** The example after `index`, wrapping to the first. */
export const nextExample = (index: number, count: number): number => (index + 1) % count;

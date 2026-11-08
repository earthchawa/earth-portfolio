// Achievements + levels for the site's game layer.
// secret: hidden as "???" in the Quest Log until unlocked, and not needed for 100%.
export const ACHIEVEMENTS = [
  { id: 'boot', title: 'Press Start', hint: 'Enter the site', xp: 10 },
  { id: 'approach', title: 'Wheels Up', hint: 'Scroll to the Approach section', xp: 20 },
  { id: 'work', title: 'Quest Board', hint: 'Reach Selected Work', xp: 30 },
  { id: 'inspect', title: 'Scout', hint: 'Inspect every project', xp: 60 },
  { id: 'sidequest', title: 'Side Quest', hint: 'Open a live project or its code', xp: 50 },
  { id: 'contact', title: 'Signal Found', hint: 'Reach the Connect section', xp: 30 },
  { id: 'about', title: 'Character Sheet', hint: 'Open the About page', xp: 40 },
  { id: 'archive', title: 'Memory Lane', hint: 'Scroll through the whole Visual Archive', xp: 40 },
  { id: 'resume', title: 'Loot Acquired', hint: 'Download the resume', xp: 80 },
  { id: 'social', title: 'New Follower', hint: 'Visit Instagram or GitHub', xp: 40 },
  { id: 'party', title: 'Party Invite', hint: 'Send an email or call', xp: 100 },
  { id: 'complete', title: '100% Complete', hint: 'Unlock every non-secret achievement', xp: 200 },
  { id: 'konami', title: 'Cheat Code', hint: '↑ ↑ ↓ ↓ ← → ← → B A', xp: 150, secret: true },
  { id: 'masher', title: 'Button Masher', hint: 'Click the logo 5 times fast', xp: 50, secret: true },
  { id: 'nightowl', title: 'Night Owl', hint: 'Visit between midnight and 5 AM', xp: 50, secret: true },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Ids that '100% Complete' needs
export const CORE_IDS = ACHIEVEMENTS.filter((a) => !a.secret && a.id !== 'complete').map((a) => a.id);

// Air Force ranks, min XP to reach each
export const LEVELS = [
  { xp: 0, title: 'Cadet' },
  { xp: 60, title: 'Pilot' },
  { xp: 180, title: 'Flight Lead' },
  { xp: 350, title: 'Squadron Ace' },
  { xp: 550, title: 'Wing Commander' },
  { xp: 900, title: 'Legend' },
];

export function levelFor(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  return {
    level: i + 1,
    title: cur.title,
    // 0–1 progress toward the next rank (1 at max rank)
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
    nextXp: next?.xp ?? null,
  };
}

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

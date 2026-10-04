# Strive — Rank Page: Design Spec

Date: 2026-10-05
Status: Approved in brainstorming, pending written-spec review
Extends: `docs/superpowers/specs/2026-10-04-strive-tracker-design.md` (all its rules still apply)

## 1. Purpose

Clicking the rank title in the header opens a "bestiary" page for ranks: a large pixel-art image, a few sentences of lore, and how many days the player has spent in that rank. The player can step through all 15 ranks. Ranks they have not reached yet are locked.

## 2. Scope

**In scope:** hash-based navigation between the home screen and the rank page; 16 sprites of 20×20 pixels (15 ranks plus a locked "?"); lore text; persisted day counts per rank; locked/unlocked state.

**Out of scope:** a router library, animations, per-rank statistics beyond days, editing lore in the UI.

## 3. Navigation

- Routes are read from `location.hash`:
  - `''`, `#` or `#/` → home screen.
  - `#/ranks/<slug>` → rank page for that rank.
  - Any other hash → home screen.
- `rankSlug(title)` = title lowercased, every run of non-alphanumeric characters replaced by `-`, leading/trailing `-` trimmed. Examples: `beggar`, `man-at-arms`, `wizard-of-the-white-order`. All 15 slugs are unique.
- An unknown slug under `#/ranks/` shows the player's current rank.
- A `useHash()` hook returns the current hash and re-renders on `hashchange`. No router library.
- The header's rank title is a link to `#/ranks/<current rank slug>`.
- The browser back button returns home, because navigation is ordinary hash history.

## 4. Data

`AppState` gains one field, still under the `strive:v1` key:

```ts
rankDays: Record<string, number>; // rank title -> settled days spent in that rank
```

- **Crediting:** in `settle()`, for each settled day `d`, before applying `d`'s points, add 1 to `rankDays[getRank(points).current.title]`, using the points as they were at the start of `d`. That is the rank shown on screen during `d`. Because points change only at settlement, each day belongs to exactly one rank.
- **Displayed days:** `daysInRank(state, title)` = `rankDays[title] ?? 0`, plus 1 if `title` is the current rank (today counts live).
- **Unlocked:** `isUnlocked(state, title)` is true if `rankDays[title] > 0`, or `title` is the current rank, or `title` is `Beggar`. A rank you reached stays unlocked after you drop below it.
- **Fresh state:** `rankDays: {}`.
- **Migration:** data without `rankDays` gets `{}`, so counting starts from the first load after this change.
- **Validation:** `rankDays` must be a plain object whose keys are rank titles from `RANKS` and whose values are integers ≥ 0. Anything else counts as invalid data (fresh state plus a warning, as before).

## 5. Rank page UI

Same visual language as the home screen: black background, `#B48CFF` / `#5A3F8C`, VT323, 2px borders, square corners.

```
┌──────────────────────────────────────────┐
│ [ < BACK ]                     RANK 1/15 │
│                                          │
│  [<]      ████ 20×20 sprite ████     [>] │
│                                          │
│                 BEGGAR                   │
│                  0 PTS+                  │
│                                          │
│        Lore text (dim, centred)          │
│                                          │
│              DAYS AS BEGGAR: 1           │
│              ◆ CURRENT RANK ◆            │
└──────────────────────────────────────────┘
```

- Opens on the rank given by the slug.
- `[ < BACK ]` goes to `#/` (home).
- `[<]` / `[>]` move to the previous/next rank by changing the hash. They are disabled on the first/last rank.
- Keyboard: `ArrowLeft` / `ArrowRight` act like `[<]` / `[>]`; `Escape` goes home.
- `RANK N/15` shows the rank's position.
- **Unlocked rank:** sprite (200px wide, 10px per pixel), title, `<min> PTS+`, lore, `DAYS AS <TITLE>: N` (`DAY` when N = 1). The current rank also shows `◆ CURRENT RANK ◆`; if the ◆ glyph falls back to another font, use `* CURRENT RANK *` instead.
- **Locked rank:** the "?" sprite in dim purple, the title, `REACH <min> PTS TO UNLOCK` instead of the lore, and no days line.
- Arrows use plain text brackets, because VT323 lacks ◀ ▶ (the same issue as the old ✓).

## 6. Sprites

Each sprite is a 20×20 `string[]` map of `#` and `.`, rendered by the existing `PixelSprite`. They are single-colour and simple, with one clear silhouette each.

| # | Rank | Sprite |
|---|---|---|
| 1 | Beggar | hunched figure holding out a cup |
| 2 | Peasant | pitchfork |
| 3 | Stable Hand | horseshoe |
| 4 | Squire | pennant banner on a pole |
| 5 | Man-at-Arms | spear crossed behind a round shield |
| 6 | Knight | great helm with an eye slit |
| 7 | Ranger | drawn bow with an arrow |
| 8 | Battlemage | sword crossed with a flaming staff |
| 9 | Lord | castle tower with a flag |
| 10 | Paladin | shield with a cross, rays around it |
| 11 | Archmage | wizard hat with stars |
| 12 | Dragon Slayer | dragon skull pierced by a sword |
| 13 | King | crown |
| 14 | Wizard of the White Order | robed figure with a tall staff |
| 15 | Legend of the Realm | sword in a stone |
| — | Locked | question mark |

## 7. Lore

| Rank | Lore |
|---|---|
| Beggar | You sleep in the gutter outside the tavern of Good Intentions. Every hero's tale begins somewhere, and yours begins here, in the mud, with an empty cup. |
| Peasant | You have a roof, a field, and calluses to prove both. The work is honest, the bread is plain, and for the first time tomorrow looks a little like a plan. |
| Stable Hand | Up before the rooster, mucking stalls nobody thanks you for. The horses trust you now; small chores done daily are how great riders are made. |
| Squire | You carry another's shield and learn by watching. Each morning you polish armour that isn't yours yet, and each evening it fits you a little better. |
| Man-at-Arms | Spear in hand, you hold the line with the rest of the garrison. You don't skip drills anymore; the ones who did are not on the wall. |
| Knight | Your oaths are kept and your armour is polished daily. Discipline has become your steel; the realm is starting to whisper your name. |
| Ranger | You move through the wilds unseen, reading tracks like pages of a book. Patience is your bowstring, and you have learned to draw it every single day. |
| Battlemage | Steel in one hand, spellfire in the other. You trained body and mind until neither could be called the weaker; scholars fear your sword, soldiers fear your books. |
| Lord | Your banner flies over a keep of your own making. Others now look to your routine for order, and the granaries never run empty on your watch. |
| Paladin | Your vows are a light that does not flicker. Temptation knocks at the gate every night, and every night it leaves with nothing. |
| Archmage | The tower library holds no secrets from you, and foreign tongues bend to your will. You have learned that true power is compound interest, paid daily in study. |
| Dragon Slayer | The beast that devoured lesser heroes now hangs above your hearth. It was not one mighty blow but ten thousand ordinary days that sharpened the blade. |
| King | The crown is heavy, and you wear it every day without complaint. Your kingdom runs on the habits you set; the people sleep soundly because you never stopped showing up. |
| Wizard of the White Order | Robed in white, you walk between kingdoms and counsel kings. Few remember you were once the beggar in the gutter, and you never forget it. |
| Legend of the Realm | Bards sing of you in taverns you have never visited. The sword left the stone because you returned to it, day after day, until it had no choice. |

## 8. Code structure

```
src/
  domain/
    ranks.ts         # + rankSlug(title), rankBySlug(slug)
    settle.ts        # + rankDays crediting
    selectors.ts     # + daysInRank, isUnlocked
    types.ts         # + rankDays
  storage/
    persist.ts       # + rankDays default, migration, validation
  state/
    useHash.ts       # current location.hash, re-render on hashchange
  ui/
    rankContent.ts   # RANK_SPRITES (title -> 20x20 map), LOCKED_SPRITE, RANK_LORE
    RankPage.tsx     # the page
    Header.tsx       # rank title becomes a link
  App.tsx            # picks home or rank page from the hash
```

## 9. Testing

- **settle:** a day is credited to the rank held at the start of that day; promotion (Beggar → Peasant) credits the promotion day to Beggar; demotion credits the next day to the lower rank; gaps credit every day; idempotent.
- **selectors:** `daysInRank` adds today only for the current rank; `isUnlocked` covers Beggar, current, visited and never-reached ranks, plus staying unlocked after a demotion.
- **ranks:** slugs are unique and `rankBySlug(rankSlug(t))` returns the rank; unknown slug → `undefined`.
- **persist:** fresh state has `rankDays: {}`; migration adds it; invalid `rankDays` (unknown title, negative or fractional value, array) → fresh state.
- **rankContent:** every rank has a sprite and lore; all 16 sprites are 20×20 maps of `#`/`.`.
- **RankPage:** unlocked rank shows its lore and days; locked rank shows the unlock message and no lore; `[<]`/`[>]` and arrow keys change the hash and are disabled at the ends; Escape and `[ < BACK ]` go home.
- **App:** clicking the header's rank title opens that rank's page; Back returns home; an unknown slug shows the current rank.

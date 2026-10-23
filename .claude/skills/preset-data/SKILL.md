---
name: preset-data
description: Create a new neighbourhood preset (a bundled restaurant list under src/assets/data/presets/ plus its index.json entry) or update an existing one — add, fix or remove restaurants, add a city or district. Use this whenever the user wants restaurants for a new area, mall, street or city added to the app's presets, asks to research what restaurants are in some place for the app, pastes a list of restaurants or a Google Maps / Wongnai list to turn into a preset, or says things like "add a preset for Siam", "update the Ladprao list", "these places closed", or "make a neighbourhood list" — even if they never say the word "preset".
---

# Preset data

A neighbourhood preset is a ready-made restaurant list that people tick on `/settings/presets`
to fill their own list. Each one is two things that must agree:

- `src/assets/data/presets/<id>.json` — a normal version 6 export file (`app`, `version`,
  `exportedAt`, `restaurants`, `history: []`, `groups: []`), so the app's own `parseImport`
  validates it.
- An entry in `src/assets/data/presets/index.json` — names in English and Thai, city,
  district, the malls or streets shown in the row (`places`), the allowed `area` values
  (`areas`), `count` and `updatedAt`.

`tests/lib/presets.test.ts` enforces the agreement: every file has an entry and every entry a
file, `count` matches, each restaurant's area is one of the entry's `areas`, ids are unique
across all files, and every city and district has `en` and `th` names. A preset change is done
when those tests pass, not when the JSON looks right.

## Workflow

1. **Ship it like any change.** This repo's `shipping-a-change` skill applies: worktree, then
   commit, push, PR, preview URL. Data has no failing-test-first step of its own — the
   existing preset tests are the test; run them after each edit. Use scope `assets`:
   `feat(assets): add bangna preset`, `fix(assets): drop closed places from ladprao`.
2. **Pin down the neighbourhood.** Settle with the user (or decide and say so) the preset id,
   which malls and streets it covers, and its city and district. One preset is roughly what a
   person would walk or take one short ride between — a cluster of malls around one
   intersection or station, not a whole district. If the area is huge, propose splitting.
3. **Gather the restaurants** — see "Sources" below.
4. **Write a draft** and apply it with the bundled script (see "Writing the data").
5. **Write or update the index entry** by hand (see "The index entry").
6. **Refresh and verify:**
   ```sh
   bun run presets:index          # rewrites every count from its file
   bun run format
   bun test tests/lib/presets.test.ts
   bun run check && bun run test && bun run build
   ```
7. **Report** what the preset now holds: how many restaurants per area, how many are
   unverified, and anything you left out and why.

## Sources

### Web research

Look for current tenant lists, not listicles. In rough order of trust:

1. The mall's own directory or dining page (Central, The Mall group, Lotus's, Major, MBK,
   ICONSIAM and others publish them, usually in both languages).
2. Recent Wongnai, Google Maps or LINE MAN listings that show the branch at that mall.
3. Food blogs and news, only to fill gaps, and only when recent.

Branches open and close often. Be honest about how sure you are, because the user picks from
these lists to decide where to eat tonight:

- Seen on an official directory or a listing updated in the last year: no marker tag.
- Found but not confirmed for the current year, or unsure of the branch's place or floor:
  tag `unverified` (no year; the index entry's `updatedAt` dates it).
- Recently opened, confirmed: `open <year>` is fine when it helps.

Never invent restaurants to reach a number. A preset of 25 real places beats 80 guesses.
Skip places that are clearly closed, kiosks with no seating unless they are a real drinks or
dessert stop, and supermarket counters.

### A user-supplied list

The user may paste names, a Google Maps list, a spreadsheet, or an app export file. Keep
everything they gave you unless it is a duplicate or plainly not a place to eat; fill in
kinds, cuisine, area and tags yourself. If they gave you an export (`app: "whattoeat"`), keep
its ids — they may already be in someone's list. The script keeps an `id` on a new entry
unless another preset already uses it; then it stops, and you drop that `id` to get a new one.
Ask only about things you cannot work out, like which mall an unlabelled place is in.

## Writing the data

Don't hand-write ids and timestamps. Write a small draft and run the script, which assigns
8-character ids that are unique across every preset file, sets `createdAt`/`updatedAt`,
cleans tags and group values the way the app does, writes the export wrapper, and sets the
index entry's `updatedAt` to today when anything changed:

```sh
bun .claude/skills/preset-data/scripts/upsert-preset.ts <preset-id> <draft.json>
```

Put the draft in the scratchpad or `/tmp`, not in the repo. Shape:

```json
{
  "restaurants": [
    {
      "name": { "en": "Sushiro", "th": "ซูชิโร่" },
      "link": "https://sushiro.co.th/",
      "location": "Major Ratchayothin, 1F",
      "notes": "Room 110-112. 10:00-22:00.",
      "kinds": ["food"],
      "cuisine": "japanese",
      "area": "major ratchayothin",
      "tags": ["sushi", "conveyor"]
    },
    { "id": "BSoLvd51", "notes": "Major Ratchayothin, 2F\n10:30-21:00. Opposite Olino." },
    { "id": "ItuIAmsg", "remove": true }
  ]
}
```

- A draft `name` is a string (the English name) or `{ "en": ..., "th": ... }`; the file
  always stores both. An update changes only the languages the draft gives.
- An item without `id` whose English or Thai name matches an existing restaurant
  (case-insensitive, and in the same area when the draft gives `area`) updates it; otherwise it is new. An item with an `id` already in the file updates only the fields
  it lists; a full item with an unused `id` is added under that id.
- `location` exists only in the draft: on a new item the script makes it the first line of
  `notes`, the way the app stores a place and floor. To change an existing restaurant's place
  or floor, give its whole new `notes` (first line included); the script refuses `location`
  on an update rather than guess which line to replace.
- For a brand-new preset the file is created; for an existing one only the listed changes
  apply, so a draft of five fixes doesn't need the other 140 restaurants.

### Field conventions

Match what is already in the existing preset files, since they are what people see side by
side:

| Field | Convention |
| --- | --- |
| `name` | `{ "en": "Kuay Teow Ruea Suea Na Yok", "th": "ก๋วยเตี๋ยวเรือเสือหน้าหยก" }`. The brand only: no ` - Place` suffix (the area group and notes tell branches apart) and no Thai in `en`. `th` is the name Thais write, only when the brand has one you have seen; never transliterate. Every branch of a brand uses the same spelling in both languages. The app shows `en` when `th` is empty. |
| `location` (draft only) | `Place, Floor` (`Central Ladprao, G`, `Union Mall, 3F`, `Major Ratchayothin, B`). A street shop: the soi or road. Becomes the first line of `notes`. |
| `notes` | After the place line, short sentences: what to order or what it is, price hint (`Budget.`, `Mid price.`, `From ฿799.`), opening hours `10:00-22:00.`, a landmark if the floor is big. |
| `link` | Required `https://` URL, the first that exists: the brand's official website, else its official social page (Facebook, Instagram, LINE), else a Google Maps search `https://www.google.com/maps/search/?api=1&query=<name and place, URL-encoded>`. Only URLs you have seen; never guess a domain. The app opens it from the restaurant's name. |
| `kinds` | Any of `food`, `drinks`, `dessert`. A café with cakes is `["drinks", "dessert"]`. |
| `cuisine` | One lowercase value, two if truly mixed. Reuse what exists: `thai`, `japanese`, `korean`, `chinese`, `western`, `italian`, `international`, `isan`, `northern thai`, `taiwanese`, `vietnamese`… Leave out for drinks-only places and chains with no clear cuisine. |
| `area` | Exactly one, lowercase, the mall or street — and listed in the index entry's `areas`. |
| `tags` | Lowercase dish or style words people filter by in their head: `sushi`, `ramen`, `buffet`, `shabu`, `bbq`, `noodles`, `cafe`, `bubble tea`, `fast food`, `healthy`. Plus the verification marker when it applies. 1–4 tags. |

## The index entry

Write this by hand; only `count` is generated. Keep the presets array in the order people
would expect, new ones at the end.

```json
{
  "id": "bangna",
  "city": "bangkok",
  "district": "bang-na",
  "name": { "en": "Bangna", "th": "บางนา" },
  "count": 0,
  "updatedAt": "2026-10-17",
  "places": ["Mega Bangna", "Central Bangna"],
  "areas": ["mega bangna", "central bangna"]
}
```

- `id`: lowercase, dashes, matches the file name. It is stored in people's browsers to
  remember what they added, so don't rename an existing one.
- `city` and `district` are ids into the top-level `cities` and `districts` maps. A new one
  needs an entry there with both `en` and `th` names, the Thai written the way Thais write the
  place (`กรุงเทพฯ`, `ปทุมวัน`), not transliterated.
- `places`: display names in English, biggest or best known first; the row shows the first
  two. These are matched by the page's search, so use the names people type.
- `areas`: every `area` value the file uses. Usually one per place, lowercase.
- `updatedAt`: the date the file's content last changed. People who added the preset see
  **Update** when it moves, so bump it for real content changes only — the script does that
  for you.

## Pitfalls

- **Ids must stay stable.** The browser remembers which restaurant ids came from a preset,
  and Add skips ids already saved. Changing an existing restaurant's id makes it a duplicate
  for everyone who added the preset. Fix a restaurant in place; never delete and re-add it.
- **Same brand, two presets** (a chain in both Central Ladprao and Major Ratchayothin) is fine
  — each branch is its own restaurant with its own id and area, under the same name.
- **Duplicates.** Two items with the same brand in the same area are one place: keep the
  older id and fold the other's notes into it. Tags are the same: one word per idea
  (`bbq` not `grill`, `bingsu` not `kakigori`, `tonkatsu` not `katsu`), and a cuisine goes in
  `cuisine`, not `tags` (an Isan place is cuisine `isan`, tag `som tam`).
- **Counts drift** if you edit a file without rerunning `bun run presets:index`; the test
  catches it.
- **The page changes shape as presets grow.** A new city adds a chip, and the search field
  appears once there are more than 7 presets. Mention either in the PR so the preview gets
  checked.
- **Reuse existing ids.** Check the `cities` and `districts` maps before adding one; a second
  id for the same district (`pathum-wan` vs `pathumwan`) splits its presets into two groups.

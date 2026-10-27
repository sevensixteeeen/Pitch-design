# What Canva's users hate, and what this clone does about it

Research for `/replica-entrepreneur`, 2026-10-27. Every quote is copied exactly from the linked source
(trimmed with "…" where shortened) and was checked against `replica/reviews.csv`. Reviewers' words are
**research only**: never put them on the landing page, in ads or in a store listing. Never use the
original's name in this app's name, ads or listing.

## The sample (and its limits)

| source | rows | what it is |
| --- | --- | --- |
| App Store (US) | 500 | Apple's official reviews feed, newest first: everything from 2026-09-30 to 2026-10-25. 88 rated 1–3 stars |
| Capterra | 24 | the "Cons" section of the 24 reviews on page 1 (sorted "most helpful"), read in the browser. Mostly 4–5 stars |
| Hacker News | 640 | comments naming "Canva", 2023-11 to 2026-10, found through the official search API with queries like "canva alternative", "canva pricing", "canva pro", "canva AI". **Not a random sample**, so it's not used for ranking, only for context and quotes |

- Total: 1,164 rows. 1,134 after duplicates. **524 have star ratings, 89 of them 1–3 stars.**
- Not reachable:
  - **Trustpilot:** stuck on a bot check, which I didn't try to get around.
  - **Reddit:** blocked by the browser tool's safety settings.
  - **Google Play and G2:** not tried.
- The App Store reviews are about the **phone app**. Complaints only about the iPhone/iPad app are noted as
  out of scope for this web editor.
- Canva's own newsroom (read 2026-10-27) is almost all AI: its own image model (Oct 23), an in-house AI lab
  (Oct 22), an AI "ProSuite" (Sep 16). Nothing about the free plan or simpler editing, so none of the
  fixes below is something Canva just shipped.
- How the counts were made: `reviews.py` with design-tool themes (`replica/themes.json`; output
  `feedback.md` and `feedback-rated.md`), then a targeted pattern per problem. **I read every 1–3 star
  match by hand.**

## 1. What they hate (ranked)

| # | problem | evidence | sources |
| --- | --- | --- | --- |
| 1 | **Paywalls everywhere, and the free plan keeps shrinking** | 111 rows (33 App Store, 17 Capterra, 61 HN); 15 of the 89 low ratings | 3 |
| 2 | **AI pushed on them, or AI that disappoints** | 25 of the 89 low ratings mention AI. Read by hand, at least **18 complain about the AI itself**, 3 about paying for it. All from the last 4 weeks of App Store reviews | 2 (+ HN discussion) |
| 3 | **Billing: charged after a trial or after cancelling, hard to cancel** | 31 rows (13 App Store, 18 HN); 11 of the 89 low ratings | 2 |
| 4 | **Hard to use, clunky** | 27 rows (11 App Store, 14 HN, 2 Capterra); 8 low ratings, several about the iPad/iPhone apps only | 3 |
| 5 | **Upgrade pop-ups over the work** (thin) | 3 App Store reviews; HN threads worry the same will happen to Affinity | 1 + HN |
| – | Video editing | 34 rated reviews | **out of scope**: the clone has no video |

1. Paywalls:
   - "Everything you need to do requires a Pro subscription." ([App Store 1★, Oct 5](https://itunes.apple.com/us/rss/customerreviews/page=8/id=897446215/sortBy=mostRecent/json))
   - "…paying is now almost required since there is less and less available in the free version." ([Capterra 4★, Sep 30](https://www.capterra.com/p/168956/Canva/reviews/))
2. AI:
   - "I loved Canva up until they integrated AI and there is no way to opt out of it." ([App Store 1★, Oct 13](https://itunes.apple.com/us/rss/customerreviews/page=5/id=897446215/sortBy=mostRecent/json))
   - "The AI implementation is also really pushy…" ([Capterra 3★, Sep 25](https://www.capterra.com/p/168956/Canva/reviews/))
3. Billing:
   - "Make it impossible to cancel" ([App Store 1★, Oct 8](https://itunes.apple.com/us/rss/customerreviews/page=7/id=897446215/sortBy=mostRecent/json))
   - "Repeated Unauthorized Debiting After Cancellation" ([App Store 1★, Oct 24](https://itunes.apple.com/us/rss/customerreviews/page=1/id=897446215/sortBy=mostRecent/json))
4. Hard to use:
   - "Not intuitive or user friendly" ([App Store 3★, Oct 19](https://itunes.apple.com/us/rss/customerreviews/page=3/id=897446215/sortBy=mostRecent/json))
   - "…panels that don't disappear when their parent looses focus." ([HN, Oct 12](https://news.ycombinator.com/item?id=50051221))
5. Pop-ups:
   - "…all the ai popups and begging for me to subscribe to pro is annoying" ([App Store 2★, Oct 23](https://itunes.apple.com/us/rss/customerreviews/page=1/id=897446215/sortBy=mostRecent/json))
   - "…without that popup every single time…" ([App Store 3★, Oct 13](https://itunes.apple.com/us/rss/customerreviews/page=5/id=897446215/sortBy=mostRecent/json))

**Thin. Listed, not trends:**
- **Imprecise alignment and kerning:** 1 HN comment, "It's impossible to align stuff properly." ([HN](https://news.ycombinator.com/item?id=50053147)), plus a few mild Capterra cons.
- **Designs all look the same:** 5 Capterra cons, all 4–5 stars.
- **Lost work / can't save:** 3 App Store reviews.
- **Slow on big designs:** 4 Capterra cons.

## 2. What is missing (asked for by name)

All thin: each is asked for by 1–3 reviews.

| request | evidence |
| --- | --- |
| a way to turn the AI off | 3 App Store reviews, e.g. "Please take all of the ai updates out." ([3★, Oct 21](https://itunes.apple.com/us/rss/customerreviews/page=2/id=897446215/sortBy=mostRecent/json)) |
| a filter to show only free items | 2 App Store reviews, e.g. "…no way to filter to only see free things…" ([2★, Oct 12](https://itunes.apple.com/us/rss/customerreviews/page=6/id=897446215/sortBy=mostRecent/json)) |
| editable / more export formats | 2 Capterra cons: "You cannot export designs as fully layered, editable source files…", "Export options are limited if you need specific file types" ([Capterra](https://www.capterra.com/p/168956/Canva/reviews/)) |
| PDFs with real, selectable text | 1 HN thread from 2024 (may have been fixed since): "…text that is impossible to select and copy." ([HN](https://news.ycombinator.com/item?id=39824631)) |
| better file organisation | "File organization is lacking" ([App Store 4★, Oct 1](https://itunes.apple.com/us/rss/customerreviews/page=10/id=897446215/sortBy=mostRecent/json)), plus 1 Capterra con |

## 3. What is unsolved (groups the original leaves behind)

1. **People who want a design tool without generative AI.** That means artists, teachers, and small
   creators who feel the AI label rubs off on them. One App Store reviewer writes that "small creators that
   did simple design work are accused of not creating ANYTHING" ([1★, Oct 5](https://itunes.apple.com/us/rss/customerreviews/page=8/id=897446215/sortBy=mostRecent/json)).
   Canva's newsroom shows it moving further into AI, so this gap is likely to last.
2. **Occasional makers on a budget who relied on the free plan for years.** "This app used to have so many
   options that were free for us who can’t afford the subscription." ([App Store 2★, Oct 20](https://itunes.apple.com/us/rss/customerreviews/page=2/id=897446215/sortBy=mostRecent/json)).
   Note: Canva runs free programmes for education and non-profits (listed on canva.com). The gap is
   people outside those programmes.
3. (thin) **People who want "a normal editor" with precise control rather than templates.** "I want a
   normal editor." ([HN, Oct 12](https://news.ycombinator.com/item?id=50053147)).

**What the clone can't beat:** a commenter in the same HN thread (about another open-source Canva alternative)
says Canva's edge "comes from its IP coupled to their ecosystem/product (templates, assets and stock
photography)" ([HN](https://news.ycombinator.com/item?id=50051221)). Don't compete on library size. Compete
on how the tool treats people.

## 4. Fix plan

Chosen by evidence × how cheap it is. Each fix is now a row in `features.csv` with `original` = `no`.

| # | fix | what to build or change | size | skill | evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | **Nothing is locked** | Every element, template, font and download format is free to use. No watermarks, no "Pro" crowns. If a paid plan ever exists, it charges for things like storage or teams, never for design pieces | S (a rule; true today) | `/replica-launch` (plans) | hate #1: 111 rows, 3 sources |
| 2 | **No AI pushed at you** | No generative AI in the editor. If any is ever added: opt-in, off by default, one clear switch, and designs never used to train a model | S (true today; write the promise down) | `/replica-brand`, `/replica-launch` | hate #2: 18+ of 89 low ratings; unsolved #1 |
| 3 | **Nothing covers the canvas** | No upgrade prompts or pop-ups over the design. Plan info lives on its own page | S (a design rule; add a check in `/replica-test`) | `/replica-test` | hate #5 (thin), #1 |
| 4 | **Honest billing** | One-click cancel that takes effect at once, a reminder email before any trial turns paid, no charge after cancelling | M | `/replica-launch` (+ `/replica-backend` if payments are added) | hate #3: 31 rows, 2 sources |
| 5 | **Your designs stay yours** | Download the editable design file (the document plus its images) and open it again later | M | `/replica-build` (milestone 4) | missing: export formats (thin) |
| 6 | **SVG download for everyone** | Write the page out as SVG. Canva's help pages list SVG as a paid option (recon source 2) | M | `/replica-build` | missing: export formats (thin) |

Already on the roadmap and backed by the evidence: **PDF with real, selectable text** (milestone 4), and a
small, calm editor (keep it that way; hate #4).

## 5. The angle

**A. Nothing locked**
> For people who just want to make something without being sold to at every step, **[app]** gives you
> every element, template and download free: no watermarks, no crowns, no pop-ups.
> Evidence: paywalls, 111 rows across 3 sources; pop-ups and billing back it up.

**B. A calm design tool, with no AI pushed at you** (recommended)
> For people who loved their design tool until it filled up with generative AI, **[app]** is a calm,
> simple editor where nothing is generated for you and your designs never train a model.
> Evidence: at least 18 of the 89 recent 1–3 star reviews complain about the AI, in only 4 weeks, and the
> original is doubling down on AI.

**C. Your designs stay yours**
> For people who need to take their work elsewhere, **[app]** lets you download the editable file, SVG and
> real-text PDF, all free.
> Evidence: thin (export complaints in 2 sources).

**Why B:**
1. It's the biggest share of recent angry reviews.
2. It's a gap the original is moving away from, not towards.
3. It costs nothing to deliver: the clone has no AI.

**Use A's "nothing locked" as the second promise.** It's the most common complaint overall, but whether it
can hold if the app ever charges is a decision for `/replica-launch`.

**C** is a good feature, not a headline; the evidence is thin.

Next: `/replica-brand` (name, voice) built on B, then `/replica-launch`.

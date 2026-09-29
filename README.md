# kaDlala

kaDlala is a South African knowledge quiz for solo play and live rooms of up to 16 friends. A round mixes categories and difficulty, rewards quick answers and streaks, and ends with scorecards and answer explanations.

## Run locally

```sh
npm install
npm run dev
```

`npm run lint` checks the source and `npm run build` creates the production bundle.

## Question bank files

Keep question banks in `src/data/questions/`, with one UTF-8 JSON file per category. Vite loads every `*.json` file in that folder when the app builds. Current category files are Geography, Culture, Nature, History, Sport, Food, Landmarks, Science & Innovation, and Public Life & Civics.

The settings page can import an additional bank in the same format. Valid files are stored in that browser and become available for solo and hosted online rounds. Importing does not edit the repository. To contribute questions to everyone, add the file to `src/data/questions/`.

### Schema version 1

```json
{
  "schemaVersion": 1,
  "category": "Local Knowledge",
  "reviewedAt": "2026-09-29",
  "sources": [
    "https://www.gov.za/about-sa/south-africa-glance"
  ],
  "questions": [
    {
      "id": "local_001",
      "category": "Local Knowledge",
      "difficulty": "Medium",
      "points": 200,
      "text": "Replace this with a South African quiz question.",
      "options": [
        { "id": "local_001_a", "text": "Answer A", "isCorrect": true },
        { "id": "local_001_b", "text": "Answer B" },
        { "id": "local_001_c", "text": "Answer C" },
        { "id": "local_001_d", "text": "Answer D" }
      ],
      "explanation": "Explain why the correct answer is right.",
      "timeLimit": 12
    }
  ]
}
```

Requirements:

- `schemaVersion` must be `1`; `reviewedAt` is an ISO date (`YYYY-MM-DD`); `sources` has one or more authoritative HTTP(S) URLs.
- `category` must be non-empty and match the category on every question.
- Question IDs must be unique across all built-in and imported banks; answer option IDs must be unique within their question.
- A bank contains 1–250 questions and imported files must be smaller than 1 MB.
- `difficulty` is `Easy`, `Medium`, or `Hard`. `points` is a positive integer. `timeLimit` is an integer from 5 to 60 seconds.
- Every question needs a non-empty explanation and exactly four answer options, with exactly one `isCorrect: true`.
- Re-check time-sensitive facts and update `reviewedAt` before distributing a question file.

The in-game settings sliders always total 100%. For rounds of 5, 10, or 15 questions, the category percentages determine the closest whole-question mix; questions then ramp from easier to harder. Settings also let solo players turn the 0.75-second correct-answer reveal on or off. If a chosen category or difficulty has no remaining questions, the deck builder fills the round from the remaining pool without repeating a question.

## Live online rooms

Online rooms use Supabase Auth (anonymous guest sign-in), Postgres RPCs, row-level security, and Realtime. Set up the project once:

1. Create a Supabase project and enable **Anonymous Sign-Ins** in its Auth provider settings.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon/publishable key is intended for browser use; never put a service-role or secret key in a `VITE_` variable.
3. Run the SQL files in `supabase/migrations/` in filename order in the Supabase SQL editor.
4. Restart the Vite dev server or redeploy the app.

The migrations create rooms, an eight-character invite code, a 16-player scoreboard, private question/answer-key storage, member-only read policies, and server-validated RPCs for starting, answering, and advancing rounds. Correct answers and scores remain private until a round ends. The same invite code and synchronized timer are used on every device.

Without Supabase credentials, solo play and local question/settings management still work; the online screen explains the required setup.

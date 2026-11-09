# Practice Finances

**Open the app: https://vinced-tech.github.io/practice-finances/**

A simple money tracker for a solo therapy practice. Everything stays in your
browser on your own device. There is no account, no server and no cloud.

## Running it

You need [Node.js](https://nodejs.org) (version 18 or newer) installed once.

```bash
npm install
```

```bash
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

To run the tests:

```bash
npm test
```

To make a finished version to host (for example on Netlify or GitHub Pages), run
`npm run build` and upload the `dist` folder.

## Using it

| Tab | What it’s for |
|-----|---------------|
| **Home** | Money in, money out, what you kept, a month-by-month chart, and where the money went. |
| **Money in** | Add income from Talkspace, Grow Therapy or private clients. Never enter client names. |
| **Money out** | Import your credit-card CSV each month, or add one expense by hand. Shows Business, Subscriptions and Personal. |
| **Taxes** | The year’s business totals by category and source, quarterly totals, CSV download, and Print / save as PDF. |
| **More** | Backup and restore, plus adding, renaming and merging categories. |

**Importing a statement:** On Money out, choose *Import card statement* and pick
the CSV from your card website. You’ll see every line before anything is saved.
Fix categories, switch personal items to **Personal**, and press *Add*. The app
remembers your corrections for next time, and lines you already imported are
skipped automatically.

Real statements are never saved to git: any `.csv` in `examples/` is ignored on
purpose, so your transactions stay on your device.

**Back up regularly.** Clearing your browser’s site data deletes everything.
Use *More → Download backup* about once a month.

## How the numbers work (for anyone checking)

- All money is stored as whole cents (integers), so there are no rounding errors.
- Expenses are stored as positive amounts. **Net profit = income − expenses.**
- Card “Return” lines are refunds and reduce spending in their own category.
- The month and year come from the **Transaction Date** (not the Post Date).
- Personal items are excluded from every business total and the tax page.
- A subscription is the same merchant at about the same price (±25%) in 3 or more months.

Code layout: `src/lib/` holds all the calculations (with tests in `tests/`),
`src/screens/` holds the five screens, and `src/ui/` holds shared pieces and charts.

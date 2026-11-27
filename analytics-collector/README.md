# Website analytics

The public site sends pageviews, article depth milestones, and selected link clicks to a Cloudflare Worker. D1 buffers events until the Worker exports aggregate CSVs to a separate private GitHub repository. Workers and D1 have free tiers.

## Deployment

1. Create a private GitHub repository such as `sichaoj/site-analytics-private` and initialize its default branch. Create a fine-grained GitHub token limited to that repository with Contents read/write permission. Keep the token in Cloudflare.
2. From this directory, sign into Wrangler with `npx wrangler login`, then run `npx wrangler d1 create site-analytics`. Put the returned database ID into `wrangler.toml` and set `REPORT_REPOSITORY` if you chose a different name.
3. Run `npx wrangler d1 execute site-analytics --remote --file=schema.sql`, then `npx wrangler secret put GITHUB_TOKEN`. Enter the token at the private prompt. Run `npx wrangler deploy` and set the public Worker URL ending in `/collect` as `endpoint` in the site's shared `site.js`.
4. Deploy the website. Open an article, scroll, and click a key link. Confirm successful POSTs in the browser network panel. After 00:15 Asia/Shanghai the next day, check the private repository for the first CSV in `analytics/`.

## Reading the reports

Each CSV contains `period_start,period_end,metric,page,detail,count`. Dates use Asia/Shanghai. Weekly visitors appear in Sunday's CSV and count distinct browser IDs over Monday through Sunday. Daily and weekly estimates depend on browser storage and may count a person on multiple browsers. Country rows use Cloudflare's request geolocation and `ZZ` for unknown. A visitor who changes country can appear in multiple country rows.

Post views and visitors are grouped by article path. Divide a depth milestone count by the same article's view count to estimate the share of views reaching it. Link clicks use the source path and destination host/path without query strings or fragments. Email links use the label `email`.

The collector does not read or store raw IPs. Browser IDs rotate weekly. Successfully exported weeks are deleted from D1. Failed exports leave the cursor in place for retry. The Worker checks that the repository is private before exporting. The collector is public, so fabricated traffic can still affect counts.

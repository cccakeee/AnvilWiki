---
title: "Add GA4: Understand How They Left"
description: "Optional upgrade: when questions move from 'how many' to 'which path', GA4 goes in — property, Measurement ID into PUBLIC_GA_ID, then realtime-report verify."
manual: learn
order: 24
stage: "Monetize & Operate"
icon: lucide:bar-chart-3
tldr: "Install when questions upgrade to behavior paths: create the property at analytics.google.com, add a web stream, fill the G- Measurement ID into PUBLIC_GA_ID, redeploy, then check Realtime. Standard reports lag 24-48 hours."
updated: 2026-09-06
---

## A true scene first

By now "how many came and what they read" is answered by Cloudflare and Clarity. When you need GA4: you've started asking "of the people who hit the codes page, how many went on to a guide?" or "do returning players behave differently from search-ins?" — **paths and conversion** are GA4's home turf. Not there yet? Installing it just grows dust. There? Ten minutes.

### Step 1: create the account and property (5 minutes)

Open [analytics.google.com](https://analytics.google.com) → sign in → **Start measuring**; create the account and property (names arbitrary; timezone yours).

### Step 2: add a web data stream, copy the Measurement ID

In the property → **Data streams** → **Add stream** → **Web** → enter `https://your-domain` → create. Note the **Measurement ID** (looks like `G-AB12CD34EF`).

### Step 3: fill the variable, redeploy

Put the Measurement ID into **`PUBLIC_GA_ID`** (Cloudflare project Variables, or `wrangler.toml` `[vars]` locally) → save and redeploy.

### Step 4: verify it yourself, once

Open your site → back in GA4 → **Reports** → **Realtime** — you should see one active user (you).

**⚠️ The two most common "no data" causes**:

- **The Measurement ID is incomplete or misplaced**: copy the full `G-` value, save it in the deployment environment that serves the site, then redeploy before checking Realtime.
- **Reports lag**: realtime is instant; standard reports can lag 24-48 hours. Don't declare it broken on day one.

## Three classic mistakes (made for you in advance)

- **Installing during the newbie phase**: your questions haven't arrived; you'd read one total-traffic number Cloudflare gives free. Wait for the path questions.
- **Declaring it broken immediately**: check the deployed Measurement ID first, wait 48 hours second; only then hunt bugs.
- **Reading GA4 without GSC**: GA4 sees on-site behavior, GSC sees search performance — read both or read half the picture.

## Three words to know (just these)

- **Measurement ID**: the `G-`-prefixed stream identifier the template uses to load GA.
- **Realtime report**: GA4's near-immediate view of active visitors; use it to verify installation before standard reports fill in.
- **Conversion path**: the route from landing to a goal action (copying a code, finishing a guide) — GA4's core value.

## ✅ Acceptance (all must hold)

- ☐ The realtime report shows you
- ☐ You know standard reports lag 24-48 hours
- ☐ You can state the division of labor: GA4 = behavior paths, Cloudflare = headcounts, Clarity = page behavior

## Next lesson

Every tool is in place — set the rhythm that keeps the site alive: the 30-minute weekly freshness loop. [Go to Lesson 25 · Thirty Minutes Weekly](/landing/docs/weekly-ops)

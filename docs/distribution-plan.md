# Distribution / Go-to-Market Plan — draft

Right now, growth is entirely word of mouth from people who happen to find the tool. This is a
concrete plan to change that, ordered by cost and effort — cheapest and fastest first.

## 1. Communities where the audience already is (start here, ~$0)

Nigerian visa applicants already congregate in specific, findable places:
- Facebook groups and pages built around UK/Canada visa applications for Nigerians
- WhatsApp groups run by travel agents, alumni associations, or study-abroad communities
- Nairaland and similar forums with active "Travel" / "Visa" subsections
- Reddit communities like r/immigration or visa-specific subs, where relevant and where
  self-promotion rules allow it

**Action:** share the tool (with the same honest "not immigration advice" framing already in the
product) in a handful of these spaces, ideally as a genuine answer to someone's specific question
rather than a cold post. Track which source each new visitor mentions (via the analytics event
names already wired up, or simply by asking) to see which community actually converts.

## 2. SEO (slow to start, compounds over time, ~$0–low cost)

People already search phrases like "UK visa documents checklist Nigeria" or "Canada visitor visa
documents needed." A simple content strategy:
- A few genuinely useful landing pages/articles targeting these exact phrases, linking into the
  tool
- Make sure the tool itself has basic on-page SEO (title, meta description, a real page of static
  content describing what it does, since the current single-page app is thin on crawlable text)

**Caution:** this is a multi-month play, not a quick win. Don't rely on it for the first wave of
users, but it's worth setting up early since search traffic is free and durable.

## 3. Travel agents & education consultants (relationship-based)

The same group identified as a possible B2B monetization path (see `monetization-strategy.md`)
is also a distribution channel even before any paid relationship exists: if a handful of agents
recommend the tool to their clients as a free prep step, that's a steady trickle of qualified
users at no cost.

**Action:** the same outreach used to test the B2B monetization idea doubles as distribution —
even agents who don't want to pay yet may be happy to recommend a free tool that makes their job
easier.

## 4. Regulated-adviser referral relationships

OISC/RCIC-registered advisers who see straightforward cases they don't need to take on personally
could point people toward the free tool first. This is the reverse of the referral-out
relationship described in the monetization plan, and can be pursued at the same time as those
conversations.

## What I'd hold off on

- Paid advertising — not worth it until there's a monetization path proven (path 1 in
  `monetization-strategy.md`), since you'd be paying to acquire users you can't yet monetize.
- Any channel that requires ongoing content production at real cost/time — better to prove pull
  from the free channels above first.

## Measuring whether this is working

This is exactly what the analytics work in this batch is for — without event counts on
`session_started`, `reached_review`, and `marked_ready`, there's no way to tell whether a given
channel is bringing people who actually use the tool versus just clicking through. Turn on
analytics (see `README.md`) before investing real effort in any one channel, so you can tell which
ones are worth doubling down on.

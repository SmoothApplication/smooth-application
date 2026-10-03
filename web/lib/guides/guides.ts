// Follow-up to the 6-month failure review ("distribution has no visible engine"): searchable,
// evidence-based guides for the exact questions Nigerian applicants type into Google before a visa
// application. Written to stay true over time: no fee amounts, processing times, or
// per-country numeric thresholds (those change; each guide points to the official source instead).
// Every guide ends with the same honesty line: guidance, not immigration advice.
export type GuideSection = { heading: string; paragraphs: string[] };
export type Guide = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  sections: GuideSection[];
  ctaLabel: string;
  ctaHref: string;
};

export const GUIDES: Guide[] = [
  {
    slug: 'unexplained-deposits-bank-statement-visa',
    title: 'Unexplained deposits on your bank statement: what to do before you apply',
    description:
      'Large or irregular deposits are one of the most common reasons a visa reviewer questions a bank statement. Here is how to spot them and what evidence helps.',
    intro:
      'A reviewer reading your statement is asking one question: where did this money come from, and is it really yours? A large deposit with no obvious source makes that question harder to answer.',
    sections: [
      {
        heading: 'What counts as "unexplained"',
        paragraphs: [
          'Anything that does not look like your normal income: a lump sum much larger than your usual salary, a round-figure transfer from someone you do not regularly receive money from, or several deposits shortly before you apply.',
          'It is not that these are forbidden. It is that without context, they can look like borrowed money placed there to inflate your balance.',
        ],
      },
      {
        heading: 'Find them before the reviewer does',
        paragraphs: [
          'Go through the last six months line by line and list every credit that is not your salary or regular business income. Group them by who sent them. A tool that totals inflows by sender makes this much faster than reading page by page.',
        ],
      },
      {
        heading: 'Match each one with evidence',
        paragraphs: [
          'A gift from family: a short signed letter from the giver stating the relationship, the amount, and that it is a gift, ideally with their ID or proof of their own account.',
          'Sale of an item or property: the sale agreement or receipt. Business payment: the invoice or contract. Loan: the loan agreement (and be honest that it is a loan).',
          'Keep this evidence in your application pack and refer to it briefly in your covering letter.',
        ],
      },
      {
        heading: 'What not to do',
        paragraphs: [
          'Do not move money around just before applying to tidy the picture, and never submit altered or invented documents. Both can lead to a refusal and may affect later applications.',
        ],
      },
    ],
    ctaLabel: 'Check my statement for flagged deposits (free)',
    ctaHref: '/checklist/start',
  },
  {
    slug: 'how-many-months-bank-statements-visa-nigeria',
    title: 'How many months of bank statements do you need for a visa application?',
    description:
      'Guidance on how many months of statements applicants are usually advised to provide, why recent and complete matters, and where to confirm the current rule.',
    intro:
      'There is no single answer for every country and visa type, and the requirement can change. What reviewers consistently want is a statement that is recent, complete and clearly yours.',
    sections: [
      {
        heading: 'Check the official requirement first',
        paragraphs: [
          'Open the official government or embassy page for your exact visa type and read the supporting-documents section. That page, not a blog, is the rule.',
          'Many applicants are advised to show roughly six months of statements, but your visa category may ask for more or less.',
        ],
      },
      {
        heading: 'Recent and complete beats long',
        paragraphs: [
          'A statement that ends weeks before you apply can look stale. Download it as close to your application date as you can, and make sure no pages are missing and the dates run without gaps.',
        ],
      },
      {
        heading: 'Stamped or not?',
        paragraphs: [
          'Some embassies expect bank-stamped or signed statements, particularly for paper copies. Ask your bank for an official copy if the guidance says so, rather than a screenshot.',
        ],
      },
      {
        heading: 'If you have more than one account',
        paragraphs: [
          'If your income reaches you through more than one account (salary in one, business in another), show the accounts that actually reflect your income and savings, and be ready to explain how they relate.',
        ],
      },
    ],
    ctaLabel: 'Run my statement through the free check',
    ctaHref: '/checklist/start',
  },
  {
    slug: 'salary-does-not-match-bank-statement-visa',
    title: 'When your salary, payslips and bank statement do not match',
    description:
      'Reviewers compare the income you declare with what your bank statement actually shows. Here is how mismatches happen and how to explain them.',
    intro:
      'Your employment letter says one figure, your payslip another, and your statement shows credits that fit neither. Reviewers notice, because a consistent story is the strongest proof of genuine income.',
    sections: [
      {
        heading: 'Why they differ',
        paragraphs: [
          'Common honest reasons: the letter states gross pay while your account receives net pay after tax and pension; allowances or bonuses paid on different dates; or part of your income arriving through a second account.',
        ],
      },
      {
        heading: 'Make the numbers reconcile',
        paragraphs: [
          'Write down your gross pay, deductions and net pay for a typical month, then find that net credit on your statement. If the employer name on the narration differs from the name on your letter (a parent company, for example), note it.',
        ],
      },
      {
        heading: 'Explain what remains',
        paragraphs: [
          'If something still does not line up, say so plainly in your covering letter with a supporting document, rather than hoping it goes unnoticed.',
        ],
      },
    ],
    ctaLabel: 'Compare my declared income with my statement',
    ctaHref: '/checklist/start',
  },
  {
    slug: 'show-ties-to-nigeria-visitor-visa',
    title: 'How to show strong ties to Nigeria on a visitor visa application',
    description:
      'Reviewers want evidence that you have reasons to return home. What counts as proof, and how to present it without overclaiming.',
    intro:
      'Most visitor-visa refusals that mention ties are not saying you have none. They are saying the papers did not prove them. Evidence beats statements.',
    sections: [
      {
        heading: 'What reviewers look for',
        paragraphs: [
          'Stable employment or a running business, family you support or live with, property or other commitments, and a travel history that shows you return when you said you would.',
        ],
      },
      {
        heading: 'Turn each tie into a document',
        paragraphs: [
          'Employment: a letter that states your role, salary, start date and approved leave dates. Business: registration, recent tax or invoice records. Family: marriage or birth certificates where relevant. Property: title or tenancy documents.',
        ],
      },
      {
        heading: 'Be consistent, be honest',
        paragraphs: [
          'The dates on your leave letter should match your trip dates; the income in your letter should match your statement. One mismatch can outweigh several strong documents.',
        ],
      },
    ],
    ctaLabel: 'See what documents my situation needs',
    ctaHref: '/quiz',
  },
  {
    slug: 'trip-cost-vs-savings-visa-proof-of-funds',
    title: 'Is your balance enough? Matching your trip cost to your savings',
    description:
      'Reviewers compare your trip cost with your usual balance, not just the closing figure. How to estimate your costs and present your funds.',
    intro:
      'A healthy-looking closing balance can still raise questions if it is far above your usual balance, or if your trip would take most of your savings.',
    sections: [
      {
        heading: 'Estimate the whole trip',
        paragraphs: [
          'Add return flights, accommodation, local transport, food and a buffer. Use realistic current prices rather than the lowest possible figure.',
        ],
      },
      {
        heading: 'Compare with your usual balance',
        paragraphs: [
          'Look at your average balance over several months, not just the last day. A sudden jump just before you apply invites the unexplained-deposit question.',
        ],
      },
      {
        heading: 'If you are being sponsored',
        paragraphs: [
          'Include the sponsor\'s own statements and a letter stating what they will cover, plus evidence of your relationship. Sponsored trips are judged on the sponsor\'s documents as much as yours.',
        ],
      },
    ],
    ctaLabel: 'Check my funds against my trip cost',
    ctaHref: '/checklist/start',
  },
  {
    slug: 'after-a-visa-refusal-nigeria-next-steps',
    title: 'After a visa refusal: how to read the letter and plan your next step',
    description:
      'A refusal letter tells you which area caused concern. How to read it calmly, what usually needs fixing, and when to wait before reapplying.',
    intro:
      'A refusal is painful, but the letter is the most useful document you will receive: it names the area that worried the decision-maker.',
    sections: [
      {
        heading: 'Read what it actually says',
        paragraphs: [
          'Find the stated reasons and note the wording. Common themes are funds or income, ties to home, or the purpose of the visit not being clear. Do not guess at reasons that are not written there.',
        ],
      },
      {
        heading: 'Fix the cause, not just the papers',
        paragraphs: [
          'If funds were the concern, that usually takes time to correct properly (a clean, explained statement), not just a new set of documents. Reapplying quickly with the same evidence tends to repeat the outcome.',
        ],
      },
      {
        heading: 'Be truthful about the refusal',
        paragraphs: [
          'Later forms ask about previous refusals. Always declare it accurately. Concealing a refusal is a far bigger problem than the refusal itself.',
        ],
      },
      {
        heading: 'Get a second pair of eyes',
        paragraphs: [
          'Before reapplying, have your full pack reviewed against the refusal reasons, by a qualified adviser if the case is complex.',
        ],
      },
    ],
    ctaLabel: 'Start from my refusal letter',
    ctaHref: '/checklist/start',
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

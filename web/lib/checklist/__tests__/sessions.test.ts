// Task #383 ("start with the document-checklist split"): regression coverage for
// buildSessionOrder() now that it's per-country and dynamic (driven by each country's own
// catOrder length/names) rather than one fixed array — see sessions.ts's header comment for the
// real 14-session order this is meant to approximate.
//
// Task #417: the fixed 7-session order below was reordered to match the original's actual
// sessionFlowOrder() ([4, 0, 1, 2, 3, 5, 6] over the base array) — statement first, then
// passport/travel-history/responsibilities/trip-details, then financial/next-steps unchanged.
import { buildSessionOrder, sessionHref, sessionIndex, prevSessionHref, nextSessionHref } from '../sessions';
import { ALL_CHECKLISTS } from '../all';

test('places the fixed pre-checklist sessions in the real order, followed by one session per category, then reasons', () => {
  const order = buildSessionOrder('UK');
  const keys = order.map((s) => s.key);
  const catCount = ALL_CHECKLISTS.UK.catOrder.length;

  // 7 fixed sessions ahead of the checklist run, in the original's flow order (statement first).
  expect(keys.slice(0, 7)).toEqual([
    'statement',
    'passport',
    'travel-history',
    'responsibilities',
    'trip-details',
    'financial',
    'next-steps',
  ]);
  // Task #386 added 'final-review' between the last category session and 'reasons'.
  expect(keys[keys.length - 1]).toBe('reasons');
  expect(keys[keys.length - 2]).toBe('final-review');
  expect(keys.length).toBe(7 + catCount + 2);

  // Every category from CAT_ORDER_UK gets its own session, in the same order, with its own href.
  ALL_CHECKLISTS.UK.catOrder.forEach((cat, i) => {
    expect(order[7 + i].key).toBe(`checklist:${i}`);
    expect(order[7 + i].label).toBe(cat);
    expect(order[7 + i].href('UK')).toBe(`/checklist/uk/checklist/${i}`);
  });
});

test('builds a different-length session list for a country with a different catOrder', () => {
  // GH/KE/MA (visa-free "travel readiness" countries) have a shorter, differently-named catOrder
  // than UK's — buildSessionOrder must reflect that, not assume every country matches UK's shape.
  const ukOrder = buildSessionOrder('UK');
  const ghOrder = buildSessionOrder('GH');
  expect(ghOrder.length).not.toBe(ukOrder.length);
  expect(ghOrder.length).toBe(7 + ALL_CHECKLISTS.GH.catOrder.length + 2);
});

test('sessionHref/sessionIndex/prevSessionHref/nextSessionHref agree with buildSessionOrder', () => {
  // Statement (finance2) is the real Session 1 — see the header comment's sessionFlowOrder quote.
  expect(sessionIndex('UK', 'statement')).toBe(0);
  expect(sessionHref('UK', 'statement')).toBe('/checklist/uk/statement');
  expect(prevSessionHref('UK', 'statement')).toBeNull();
  expect(nextSessionHref('UK', 'statement')).toBe('/checklist/uk/passport');

  expect(sessionIndex('UK', 'passport')).toBe(1);
  expect(sessionHref('UK', 'passport')).toBe('/checklist/uk/passport');
  expect(prevSessionHref('UK', 'passport')).toBe('/checklist/uk/statement');
  expect(nextSessionHref('UK', 'passport')).toBe('/checklist/uk/travel-history');

  // Sessions 3/4 sit between Travel Experience and the financial-calculator session.
  expect(sessionHref('UK', 'responsibilities')).toBe('/checklist/uk/responsibilities');
  expect(sessionHref('UK', 'trip-details')).toBe('/checklist/uk/trip-details');
  expect(prevSessionHref('UK', 'responsibilities')).toBe('/checklist/uk/travel-history');
  expect(nextSessionHref('UK', 'responsibilities')).toBe('/checklist/uk/trip-details');
  expect(nextSessionHref('UK', 'trip-details')).toBe('/checklist/uk/financial');

  // Reasons is always last — no "Next" from there, and "Back" goes to Final review. Final review
  // itself sits between the last category session and Reasons.
  const lastCatIndex = ALL_CHECKLISTS.UK.catOrder.length - 1;
  expect(sessionHref('UK', 'final-review')).toBe('/checklist/uk/final-review');
  expect(prevSessionHref('UK', 'final-review')).toBe(`/checklist/uk/checklist/${lastCatIndex}`);
  expect(nextSessionHref('UK', 'final-review')).toBe('/checklist/uk/reasons');
  expect(prevSessionHref('UK', 'reasons')).toBe('/checklist/uk/final-review');
  expect(nextSessionHref('UK', 'reasons')).toBeNull();

  // A checklist:N session's neighbours are checklist:N-1/checklist:N+1 (or the fixed sessions/
  // reasons at the two ends of that run).
  expect(nextSessionHref('UK', 'checklist:0')).toBe('/checklist/uk/checklist/1');
});

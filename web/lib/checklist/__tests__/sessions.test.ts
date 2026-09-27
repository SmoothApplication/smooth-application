// Task #383 ("start with the document-checklist split"): regression coverage for
// buildSessionOrder() now that it's per-country and dynamic (driven by each country's own
// catOrder length/names) rather than one fixed array — see sessions.ts's header comment for the
// real 14-session order this is meant to approximate.
import { buildSessionOrder, sessionHref, sessionIndex, prevSessionHref, nextSessionHref } from '../sessions';
import { ALL_CHECKLISTS } from '../all';

test('places the fixed pre-checklist sessions in the real order, followed by one session per category, then reasons', () => {
  const order = buildSessionOrder('UK');
  const keys = order.map((s) => s.key);
  const catCount = ALL_CHECKLISTS.UK.catOrder.length;

  expect(keys.slice(0, 5)).toEqual(['passport', 'travel-history', 'statement', 'financial', 'next-steps']);
  expect(keys[keys.length - 1]).toBe('reasons');
  expect(keys.length).toBe(5 + catCount + 1);

  // Every category from CAT_ORDER_UK gets its own session, in the same order, with its own href.
  ALL_CHECKLISTS.UK.catOrder.forEach((cat, i) => {
    expect(order[5 + i].key).toBe(`checklist:${i}`);
    expect(order[5 + i].label).toBe(cat);
    expect(order[5 + i].href('UK')).toBe(`/checklist/uk/checklist/${i}`);
  });
});

test('builds a different-length session list for a country with a different catOrder', () => {
  // GH/KE/MA (visa-free "travel readiness" countries) have a shorter, differently-named catOrder
  // than UK's — buildSessionOrder must reflect that, not assume every country matches UK's shape.
  const ukOrder = buildSessionOrder('UK');
  const ghOrder = buildSessionOrder('GH');
  expect(ghOrder.length).not.toBe(ukOrder.length);
  expect(ghOrder.length).toBe(5 + ALL_CHECKLISTS.GH.catOrder.length + 1);
});

test('sessionHref/sessionIndex/prevSessionHref/nextSessionHref agree with buildSessionOrder', () => {
  expect(sessionIndex('UK', 'passport')).toBe(0);
  expect(sessionHref('UK', 'passport')).toBe('/checklist/uk/passport');
  expect(prevSessionHref('UK', 'passport')).toBeNull();
  expect(nextSessionHref('UK', 'passport')).toBe('/checklist/uk/travel-history');

  // Reasons is always last — no "Next" from there, and "Back" goes to the final category session.
  const lastCatIndex = ALL_CHECKLISTS.UK.catOrder.length - 1;
  expect(prevSessionHref('UK', 'reasons')).toBe(`/checklist/uk/checklist/${lastCatIndex}`);
  expect(nextSessionHref('UK', 'reasons')).toBeNull();

  // A checklist:N session's neighbours are checklist:N-1/checklist:N+1 (or the fixed sessions/
  // reasons at the two ends of that run).
  expect(nextSessionHref('UK', 'checklist:0')).toBe('/checklist/uk/checklist/1');
});

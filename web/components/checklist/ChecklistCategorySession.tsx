'use client';

import { useEditableChecklistState } from '@/lib/checklist/useEditableChecklistState';
import { itemApplies, ChecklistItem } from '@/lib/checklist/uk';
import { COUNTRIES } from '@/lib/checklist/countries';
import { splitDoneTodo } from '@/lib/checklist/splitDoneTodo';
import SessionShell from '@/components/checklist/SessionShell';
import { ChecklistRow } from '@/components/checklist/CountryChecklistApp';

// Task #383 ("start with the document-checklist split"): the original splits its document
// checklist into one session per category (sessions 8-13 of the real 14 — see
// lib/checklist/sessions.ts's header comment) rather than showing every category on one combined
// screen the way CountryChecklistApp's own checklist view still does. This component is that per-
// category session: same item list/checkbox/"Why?" rendering CountryChecklistApp already uses
// (ChecklistRow, re-exported from there rather than duplicated), filtered down to just the ONE
// category this session covers, reading and writing the exact same sa_<code>_answers/
// sa_<code>_checked localStorage keys CountryChecklistApp itself uses (see
// useEditableChecklistState.ts) so ticking a box here shows up there too, and vice versa.
//
// Not done here (see task #382): CountryChecklistApp's own combined checklist view (reachable
// directly at /checklist/<code>) is left as-is, still showing every category on one page — it's no
// longer linked from the numbered session flow (SESSION_ORDER now points straight at these
// per-category sessions instead), so in practice it becomes a fallback "everything at once" view
// rather than a numbered session in its own right. Cleaning that duplication up fully is bundled
// into the sessions 3/4 follow-up work already tracked separately.
export type ChecklistCategorySessionProps = {
  code: string;
  catIndex: number;
};

export default function ChecklistCategorySession({ code, catIndex }: ChecklistCategorySessionProps) {
  const { catOrder, checklist, answers, checked, toggle, loaded } = useEditableChecklistState(code);
  const countryName = COUNTRIES.find((c) => c.code === code.toUpperCase())?.name || code;

  if (!loaded) return null;

  const cat = catOrder[catIndex];
  // Out-of-range catIndex shouldn't normally happen — each country's own page.tsx only generates
  // static params for 0..catOrder.length-1 — but rendering nothing rather than crashing is the
  // same defensive pattern used elsewhere in this port (e.g. ALL_CHECKLISTS[code] ?? { ... }).
  if (!cat) return null;

  const items = checklist.filter((it) => it.cat === cat && itemApplies(it, answers));
  const subcats = Array.from(new Set(items.map((it) => it.subcat).filter(Boolean))) as string[];
  const mainItems = items.filter((it) => !it.subcat);
  const { todo: mainTodo, done: mainDone } = splitDoneTodo(mainItems, checked);

  // "Perceived length" follow-up (user demo request, "show me a demo" → "deploy your best"): a
  // category with several items used to show every row flat regardless of checked state, so an
  // applicant who'd already handled some of them still scrolled past those to see what was left.
  // doneCount/totalCount drive a small progress chip in the header; the done rows themselves move
  // into a closed-by-default disclosure per list (see renderList below) rather than disappearing —
  // still reachable to uncheck, just out of the way by default.
  const doneCount = items.filter((it) => checked[it.id]).length;
  const totalCount = items.length;

  return (
    <SessionShell code={code} name={countryName} session={`checklist:${catIndex}`}>
      <section className="rounded-lg border border-black/10 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#12232e]">{cat}</h2>
          {totalCount > 0 && (
            <span className="shrink-0 rounded-full bg-cream-soft px-2.5 py-1 text-[11px] font-medium text-[#566a76]">
              {doneCount} of {totalCount} done
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#4c6270]">
            Nothing in this category applies to you based on your answers so far.
          </p>
        ) : (
          <>
            {renderItemList(mainTodo, mainDone, checked, toggle)}
            {subcats.map((sc) => {
              const scItems = items.filter((it) => it.subcat === sc);
              const { todo: scTodo, done: scDone } = splitDoneTodo(scItems, checked);
              return (
                <div key={sc}>
                  <h3 className="border-t border-black/10 bg-cream-soft px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#566a76]">
                    {sc}
                  </h3>
                  {renderItemList(scTodo, scDone, checked, toggle)}
                </div>
              );
            })}
          </>
        )}
      </section>
    </SessionShell>
  );
}

// Still-to-do items render as a normal list; already-checked items collapse into a closed-by-
// default <details> underneath so they don't keep taking up space once handled. Returns null
// entirely when a list (todo+done) is empty — happens for a subcat with no applicable items after
// itemApplies filtering — so no empty <ul>/<details> shell is left behind.
function renderItemList(
  todo: ChecklistItem[],
  done: ChecklistItem[],
  checked: Record<string, boolean>,
  toggle: (id: string) => void
) {
  if (todo.length === 0 && done.length === 0) return null;
  return (
    <>
      {todo.length > 0 && (
        <ul className="divide-y divide-black/5">
          {todo.map((item) => (
            <ChecklistRow key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggle(item.id)} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none border-t border-black/5 px-4 py-2 text-xs font-medium text-[#566a76] marker:content-none">
            <span className="inline-flex items-center gap-1">
              ✓ {done.length} done
              <span className="text-[#8a99a3] group-open:hidden">— show</span>
              <span className="hidden text-[#8a99a3] group-open:inline">— hide</span>
            </span>
          </summary>
          <ul className="divide-y divide-black/5">
            {done.map((item) => (
              <ChecklistRow key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggle(item.id)} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

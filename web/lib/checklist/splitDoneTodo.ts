import { ChecklistItem } from './uk';

// "Perceived length" follow-up (user demo request, "show me a demo" → "deploy your best"): a
// document-checklist category with 5+ items showed every row flat, so an applicant who'd already
// ticked 2 of them still had to scroll past those 2 to see what was left. This is the pure-logic
// half of the fix — ChecklistCategorySession.tsx renders todo items normally and tucks done items
// behind a closed-by-default "N done" disclosure, so the only thing taking up visible space by
// default is what still needs doing. Kept as a standalone function (rather than inlined in the
// component) so the split itself is unit-testable without rendering anything.
export type DoneTodoSplit<T extends ChecklistItem> = {
  todo: T[];
  done: T[];
};

export function splitDoneTodo<T extends ChecklistItem>(
  items: T[],
  checked: Record<string, boolean>
): DoneTodoSplit<T> {
  const todo: T[] = [];
  const done: T[] = [];
  for (const item of items) {
    (checked[item.id] ? done : todo).push(item);
  }
  return { todo, done };
}

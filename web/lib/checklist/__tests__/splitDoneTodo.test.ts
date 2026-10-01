// "Perceived length" follow-up (user demo request, "show me a demo" → "deploy your best"): locks
// down the pure split that lets ChecklistCategorySession.tsx show only what's left to do by
// default, tucking already-checked items behind a closed disclosure instead of listing everything
// flat regardless of progress.
import { splitDoneTodo } from '../splitDoneTodo';
import { ChecklistItem } from '../uk';

function item(id: string): ChecklistItem {
  return { id, cat: 'c', weight: 'required', label: id };
}

describe('splitDoneTodo', () => {
  test('unchecked items land in todo, checked items land in done, in original order', () => {
    const items = [item('a'), item('b'), item('c')];
    const { todo, done } = splitDoneTodo(items, { b: true });
    expect(todo.map((i) => i.id)).toEqual(['a', 'c']);
    expect(done.map((i) => i.id)).toEqual(['b']);
  });

  test('an empty checked map puts everything in todo', () => {
    const items = [item('a'), item('b')];
    const { todo, done } = splitDoneTodo(items, {});
    expect(todo).toHaveLength(2);
    expect(done).toHaveLength(0);
  });

  test('every item checked puts everything in done', () => {
    const items = [item('a'), item('b')];
    const { todo, done } = splitDoneTodo(items, { a: true, b: true });
    expect(todo).toHaveLength(0);
    expect(done).toHaveLength(2);
  });

  test('an empty item list returns two empty arrays', () => {
    const { todo, done } = splitDoneTodo([], { a: true });
    expect(todo).toEqual([]);
    expect(done).toEqual([]);
  });

  test('checked[id] === false (explicitly unchecked) counts as todo, not done', () => {
    const items = [item('a')];
    const { todo, done } = splitDoneTodo(items, { a: false });
    expect(todo.map((i) => i.id)).toEqual(['a']);
    expect(done).toEqual([]);
  });
});

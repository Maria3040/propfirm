import { filterItems, paginateItems, sortItems, visiblePageNumbers } from './list-utils';

describe('list-utils', () => {
  const rows = [
    { id: '1', title: 'October Upcoming', status: 'upcoming', participants: 100 },
    { id: '2', title: 'September Ongoing', status: 'ongoing', participants: 50 },
    { id: '3', title: 'August Ended', status: 'ended', participants: 200 },
  ];

  it('filters by query', () => {
    const out = filterItems(rows, 'oct', (r, q) => r.title.toLowerCase().includes(q));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('1');
  });

  it('paginates', () => {
    const page = paginateItems(rows, 2, 2);
    expect(page.pageCount).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('3');
  });

  it('sorts by participants desc', () => {
    const out = sortItems(rows, (a, b) => b.participants - a.participants);
    expect(out.map((r) => r.id)).toEqual(['3', '1', '2']);
  });

  it('shows three page numbers centered on current', () => {
    expect(visiblePageNumbers(1, 10, 3)).toEqual([1, 2, 3]);
    expect(visiblePageNumbers(5, 10, 3)).toEqual([4, 5, 6]);
    expect(visiblePageNumbers(10, 10, 3)).toEqual([8, 9, 10]);
    expect(visiblePageNumbers(2, 2, 3)).toEqual([1, 2]);
  });
});

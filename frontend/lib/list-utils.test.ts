import { filterItems, paginateItems } from './list-utils';

describe('list-utils', () => {
  const rows = [
    { id: '1', title: 'October Upcoming', status: 'upcoming' },
    { id: '2', title: 'September Ongoing', status: 'ongoing' },
    { id: '3', title: 'August Ended', status: 'ended' },
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
});

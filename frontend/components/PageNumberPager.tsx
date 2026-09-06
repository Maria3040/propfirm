'use client';

type Props = {
  page: number;
  pageCount: number;
  pageNumbers: number[];
  onPageChange: (page: number) => void;
};

/** Previous · up to 3 page buttons · Next */
export function PageNumberPager({ page, pageCount, pageNumbers, onPageChange }: Props) {
  if (pageCount <= 1) return null;

  return (
    <nav className="comp-pager" aria-label="Pagination">
      <button
        type="button"
        className="comp-pager-nav"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <div className="comp-pager-pages" role="list">
        {pageNumbers.map((n) => (
          <button
            key={n}
            type="button"
            role="listitem"
            className={`comp-pager-num${n === page ? ' on' : ''}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="comp-pager-nav"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

import { Component, Input } from '@angular/core';

/** Same as React PageNumberPager — Previous · up to 3 page buttons · Next */
@Component({
  selector: 'app-page-number-pager',
  standalone: true,
  template: `
    @if (pageCount > 1) {
      <nav class="comp-pager" aria-label="Pagination">
        <button
          type="button"
          class="comp-pager-nav"
          [disabled]="page <= 1"
          (click)="go(page - 1)"
        >
          Previous
        </button>
        <div class="comp-pager-pages" role="list">
          @for (n of pageNumbers; track n) {
            <button
              type="button"
              role="listitem"
              class="comp-pager-num"
              [class.on]="n === page"
              [attr.aria-current]="n === page ? 'page' : null"
              (click)="go(n)"
            >
              {{ n }}
            </button>
          }
        </div>
        <button
          type="button"
          class="comp-pager-nav"
          [disabled]="page >= pageCount"
          (click)="go(page + 1)"
        >
          Next
        </button>
      </nav>
    }
  `,
})
export class PageNumberPagerComponent {
  @Input({ required: true }) page = 1;
  @Input({ required: true }) pageCount = 1;
  @Input({ required: true }) pageNumbers: number[] = [];
  @Input({ required: true }) onPageChange!: (page: number) => void;

  go(p: number) {
    this.onPageChange(p);
  }
}

export function visiblePageNumbers(page: number, pageCount: number, windowSize = 3): number[] {
  if (pageCount <= 0) return [];
  const size = Math.max(1, Math.min(windowSize, pageCount));
  let start = Math.max(1, page - Math.floor((size - 1) / 2));
  let end = start + size - 1;
  if (end > pageCount) {
    end = pageCount;
    start = Math.max(1, end - size + 1);
  }
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

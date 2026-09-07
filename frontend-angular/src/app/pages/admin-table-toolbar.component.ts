import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AdminFilterOption = { value: string; label: string };
export type AdminFilterDef = {
  key: string;
  label: string;
  value: string;
  options: AdminFilterOption[];
};

@Component({
  selector: 'app-admin-table-toolbar',
  standalone: true,
  template: `
    <div class="admin-toolbar" [class.is-loading]="loading">
      <div class="admin-toolbar-row">
        <label class="admin-search">
          <span class="sr-only">Search</span>
          <input
            type="search"
            [value]="search"
            [placeholder]="searchPlaceholder"
            (input)="searchChange.emit(($any($event.target)).value)"
          />
        </label>
        @for (f of filters; track f.key) {
          <label class="admin-filter">
            <span>{{ f.label }}</span>
            <select
              [value]="f.value"
              (change)="filterChange.emit({ key: f.key, value: ($any($event.target)).value })"
            >
              @for (o of f.options; track o.value || 'all') {
                <option [value]="o.value">{{ o.label }}</option>
              }
            </select>
          </label>
        }
      </div>
      @if (!filtersOnly) {
        <div class="admin-pager">
          <button
            type="button"
            class="btn"
            [disabled]="page <= 1 || loading"
            (click)="pageChange.emit(page - 1)"
          >
            Prev
          </button>
          <span class="meta">
            Page {{ page }} of {{ totalPages < 1 ? 1 : totalPages }} · {{ total }} total
            @if (loading) {
              <span> · Updating…</span>
            }
          </span>
          <button
            type="button"
            class="btn"
            [disabled]="page >= totalPages || loading || total === 0"
            (click)="pageChange.emit(page + 1)"
          >
            Next
          </button>
          <label class="admin-filter admin-filter-inline">
            <span>Rows</span>
            <select
              [value]="pageSize"
              [disabled]="loading"
              (change)="pageSizeChange.emit(+$any($event.target).value)"
            >
              @for (n of pageSizes; track n) {
                <option [value]="n">{{ n }}</option>
              }
            </select>
          </label>
        </div>
      }
    </div>
  `,
})
export class AdminTableToolbarComponent {
  @Input() search = '';
  @Input() searchPlaceholder = 'Search…';
  @Input() filters: AdminFilterDef[] = [];
  @Input() page = 1;
  @Input() pageSize = 20;
  @Input() total = 0;
  @Input() totalPages = 1;
  @Input() loading = false;
  @Input() filtersOnly = false;

  @Output() searchChange = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<{ key: string; value: string }>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  readonly pageSizes = [10, 20, 50, 100];
}

@Component({
  selector: 'app-admin-pager',
  standalone: true,
  template: `
    <div class="admin-pager">
      <button
        type="button"
        class="btn"
        [disabled]="page <= 1 || loading"
        (click)="pageChange.emit(page - 1)"
      >
        Prev
      </button>
      <span class="meta">
        Page {{ page }} of {{ totalPages < 1 ? 1 : totalPages }} · {{ total }} total
        @if (loading) {
          <span> · Updating…</span>
        }
      </span>
      <button
        type="button"
        class="btn"
        [disabled]="page >= totalPages || loading || total === 0"
        (click)="pageChange.emit(page + 1)"
      >
        Next
      </button>
      <label class="admin-filter admin-filter-inline">
        <span>Rows</span>
        <select
          [value]="pageSize"
          [disabled]="loading"
          (change)="pageSizeChange.emit(+$any($event.target).value)"
        >
          @for (n of pageSizes; track n) {
            <option [value]="n">{{ n }}</option>
          }
        </select>
      </label>
    </div>
  `,
})
export class AdminPagerComponent {
  @Input() page = 1;
  @Input() pageSize = 20;
  @Input() total = 0;
  @Input() totalPages = 1;
  @Input() loading = false;

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  readonly pageSizes = [10, 20, 50, 100];
}

@Component({
  selector: 'th[appAdminSort]',
  standalone: true,
  template: `
    <button type="button" class="admin-sort" [class.on]="active" (click)="sort.emit(column)">
      {{ label }}{{ active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '' }}
    </button>
  `,
  host: { style: 'padding: 0' },
})
export class AdminSortThComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) column!: string;
  @Input() sortBy = '';
  @Input() sortDir = 'desc';
  @Output() sort = new EventEmitter<string>();

  get active() {
    return this.sortBy === this.column;
  }
}

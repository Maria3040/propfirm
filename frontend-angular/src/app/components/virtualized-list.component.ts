import {
  AfterContentInit,
  AfterViewInit,
  Component,
  ContentChild,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export type VirtualRow = { index: number; start: number; size: number; key: string };

/**
 * Windowed list (parity with React VirtualizedList).
 * Use after filter → paginate so only the current page is virtualized.
 */
@Component({
  selector: 'app-virtualized-list',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div #scroller class="virt-list" [style.height]="heightCss" (scroll)="onScroll()">
      <div class="virt-list-inner" [style.height.px]="totalSize()">
        @for (row of virtualRows(); track row.key) {
          <div
            class="virt-list-row"
            [style.transform]="'translateY(' + row.start + 'px)'"
            [style.minHeight.px]="row.size"
          >
            @if (rowTemplate) {
              <ng-container
                [ngTemplateOutlet]="rowTemplate"
                [ngTemplateOutletContext]="{ $implicit: items[row.index], index: row.index }"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .virt-list {
        position: relative;
        overflow: auto;
        width: 100%;
        border: 1px solid rgba(15, 23, 32, 0.08);
        border-radius: 0 0 0.5rem 0.5rem;
        background: var(--surface, #fff);
      }
      .virt-list-inner {
        position: relative;
        width: 100%;
      }
      .virt-list-row {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        box-sizing: border-box;
      }
    `,
  ],
})
export class VirtualizedListComponent implements OnChanges, AfterViewInit, AfterContentInit {
  @ViewChild('scroller', { static: true }) scroller!: ElementRef<HTMLDivElement>;
  @ContentChild(TemplateRef) rowTemplate?: TemplateRef<{ $implicit: unknown; index: number }>;

  @Input({ required: true }) items: unknown[] = [];
  @Input() estimateSize = 48;
  @Input() overscan = 6;
  @Input() height: number | string = 420;
  @Input() getKey: (item: unknown, index: number) => string = (_item, i) => String(i);

  readonly totalSize = signal(0);
  readonly virtualRows = signal<VirtualRow[]>([]);

  get heightCss() {
    return typeof this.height === 'number' ? `${this.height}px` : this.height;
  }

  ngAfterContentInit() {
    this.recompute();
  }

  ngAfterViewInit() {
    this.recompute();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['items'] || changes['estimateSize'] || changes['height']) {
      queueMicrotask(() => {
        const el = this.scroller?.nativeElement;
        if (el && changes['items']) el.scrollTop = 0;
        this.recompute();
      });
    }
  }

  onScroll() {
    this.recompute();
  }

  private recompute() {
    const count = this.items?.length || 0;
    const size = Math.max(1, this.estimateSize);
    this.totalSize.set(count * size);

    const el = this.scroller?.nativeElement;
    const vh =
      el?.clientHeight ||
      (typeof this.height === 'number' ? this.height : Number.parseInt(String(this.height), 10)) ||
      420;
    const st = el?.scrollTop ?? 0;

    if (count === 0) {
      this.virtualRows.set([]);
      return;
    }

    const startIndex = Math.max(0, Math.floor(st / size) - this.overscan);
    const visible = Math.ceil(vh / size) + this.overscan * 2;
    const endIndex = Math.min(count - 1, startIndex + visible);
    const rows: VirtualRow[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      rows.push({
        index: i,
        start: i * size,
        size,
        key: this.getKey(this.items[i], i),
      });
    }
    this.virtualRows.set(rows);
  }
}

'use client';

import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

type Props<T> = {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  className?: string;
  height?: number | string;
  getKey: (item: T, index: number) => string;
  renderRow: (item: T, index: number) => ReactNode;
};

/**
 * Windowed list for large pages. Pair with `useFilteredPagination` so only the
 * current page is virtualized (filter → paginate → virtualize).
 */
export function VirtualizedList<T>({
  items,
  estimateSize = 168,
  overscan = 4,
  className,
  height = 560,
  getKey,
  renderRow,
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div
      ref={parentRef}
      className={className ?? 'virt-list'}
      style={{ height, overflow: 'auto', width: '100%' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index];
          return (
            <div
              key={getKey(item, row.index)}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start}px)`,
              }}
            >
              {renderRow(item, row.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

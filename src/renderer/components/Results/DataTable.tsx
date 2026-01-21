import { useState, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnInfo } from '../../../shared/types';

interface DataTableProps {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
}

export default function DataTable({ columns, rows }: DataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((col) => [col.name, 150]))
  );
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;

    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];

      if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [rows, sortConfig]);

  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
  });

  const handleSort = (column: string) => {
    setSortConfig((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'asc' ? { column, direction: 'desc' } : null;
      }
      return { column, direction: 'asc' };
    });
  };

  const handleResize = useCallback((column: string, delta: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [column]: Math.max(60, (prev[column] || 150) + delta),
    }));
  }, []);

  const totalWidth = useMemo(
    () => columns.reduce((sum, col) => sum + (columnWidths[col.name] || 150), 0),
    [columns, columnWidths]
  );

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex bg-pastel-bg-tertiary border-b border-pastel-border-light">
          {columns.map((column) => (
            <HeaderCell
              key={column.name}
              column={column}
              width={columnWidths[column.name] || 150}
              sortDirection={sortConfig?.column === column.name ? sortConfig.direction : undefined}
              onSort={() => handleSort(column.name)}
              onResize={(delta) => handleResize(column.name, delta)}
            />
          ))}
        </div>

        {/* Virtual rows */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = sortedRows[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                className={`absolute top-0 left-0 w-full flex border-b border-pastel-border-light ${
                  virtualRow.index % 2 === 0 ? 'bg-white' : 'bg-pastel-bg-secondary'
                } hover:bg-pastel-bg-hover`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((column) => (
                  <DataCell
                    key={column.name}
                    value={row[column.name]}
                    width={columnWidths[column.name] || 150}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface HeaderCellProps {
  column: ColumnInfo;
  width: number;
  sortDirection?: 'asc' | 'desc';
  onSort: () => void;
  onResize: (delta: number) => void;
}

function HeaderCell({ column, width, sortDirection, onSort, onResize }: HeaderCellProps) {
  const resizing = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    lastX.current = e.clientX;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };

    const handleMouseUp = () => {
      resizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="relative flex-shrink-0 flex items-center px-2 py-1.5 text-xs font-semibold text-pastel-text-secondary uppercase tracking-wider cursor-pointer hover:bg-pastel-bg-hover select-none"
      style={{ width }}
      onClick={onSort}
    >
      <span className="truncate flex-1">{column.name}</span>
      {sortDirection && (
        <svg
          className={`w-3 h-3 ml-1 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      )}

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-pastel-accent-blue"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

interface DataCellProps {
  value: unknown;
  width: number;
}

function DataCell({ value, width }: DataCellProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const displayValue = formatValue(value);
  const isNull = value === null || value === undefined;
  const isLong = displayValue.length > 50;

  return (
    <div
      className="relative flex-shrink-0 px-2 py-1.5 text-sm font-mono truncate"
      style={{ width }}
      onMouseEnter={() => isLong && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className={isNull ? 'text-pastel-text-disabled italic' : 'text-pastel-text-primary'}>
        {isNull ? 'NULL' : displayValue}
      </span>

      {/* Tooltip for long values */}
      {showTooltip && isLong && (
        <div className="absolute z-20 left-0 top-full mt-1 p-2 bg-white rounded-lg shadow-soft-lg border border-pastel-border-light max-w-md max-h-48 overflow-auto">
          <pre className="text-xs whitespace-pre-wrap break-all">{displayValue}</pre>
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

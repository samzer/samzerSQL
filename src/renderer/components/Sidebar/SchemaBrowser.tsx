import { useState, useEffect } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import type { SchemaInfo, TableInfo, ColumnInfo } from '../../../shared/types';

export default function SchemaBrowser() {
  const { connections, activeConnectionId, schemas, getSchema, getTablesInSchema, getColumns } = useConnectionStore();
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  // Local cache for schema data (tables/views loaded on expand)
  const [schemaData, setSchemaData] = useState<Map<string, { tables: TableInfo[]; views: TableInfo[]; loading?: boolean }>>(new Map());
  // Local cache for column data loaded on expand
  const [columnData, setColumnData] = useState<Map<string, { columns: ColumnInfo[]; loading?: boolean }>>(new Map());

  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const isConnected = activeConnection?.status === 'connected';
  const schema = activeConnectionId ? schemas.get(activeConnectionId) : undefined;

  // Reset caches when connection changes
  useEffect(() => {
    setSchemaData(new Map());
    setColumnData(new Map());
    setExpandedSchemas(new Set());
    setExpandedTables(new Set());
  }, [activeConnectionId]);

  useEffect(() => {
    if (activeConnectionId && isConnected && !schema) {
      setIsLoading(true);
      getSchema(activeConnectionId).finally(() => setIsLoading(false));
    }
  }, [activeConnectionId, isConnected, schema, getSchema]);

  // Auto-expand first schema when data loads
  useEffect(() => {
    if (schema) {
      const schemaNames = getSchemaNames(schema);
      if (schemaNames.length > 0 && expandedSchemas.size === 0) {
        toggleSchema(schemaNames[0]);
      }
    }
  }, [schema]);

  const handleRefresh = async () => {
    if (!activeConnectionId) return;
    // Clear cached schema and reload
    schemas.delete(activeConnectionId);
    setSchemaData(new Map());
    setColumnData(new Map());
    setExpandedSchemas(new Set());
    setExpandedTables(new Set());
    setIsLoading(true);
    await getSchema(activeConnectionId);
    setIsLoading(false);
  };

  const toggleSchema = async (schemaName: string) => {
    const isExpanding = !expandedSchemas.has(schemaName);

    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schemaName)) {
        next.delete(schemaName);
      } else {
        next.add(schemaName);
      }
      return next;
    });

    // If expanding and we don't have data, fetch it
    if (isExpanding && activeConnectionId && !schemaData.has(schemaName)) {
      setSchemaData((prev) => {
        const next = new Map(prev);
        next.set(schemaName, { tables: [], views: [], loading: true });
        return next;
      });

      const data = await getTablesInSchema(activeConnectionId, schemaName);

      setSchemaData((prev) => {
        const next = new Map(prev);
        next.set(schemaName, { ...data, loading: false });
        return next;
      });
    }
  };

  const toggleTable = async (tableKey: string, schemaName: string, tableName: string) => {
    const isExpanding = !expandedTables.has(tableKey);

    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) {
        next.delete(tableKey);
      } else {
        next.add(tableKey);
      }
      return next;
    });

    // If expanding and we don't have column data, fetch it
    if (isExpanding && activeConnectionId && !columnData.has(tableKey)) {
      setColumnData((prev) => {
        const next = new Map(prev);
        next.set(tableKey, { columns: [], loading: true });
        return next;
      });

      const columns = await getColumns(activeConnectionId, schemaName, tableName);

      setColumnData((prev) => {
        const next = new Map(prev);
        next.set(tableKey, { columns, loading: false });
        return next;
      });
    }
  };

  if (!activeConnection) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-xs text-pastel-text-muted text-center">
          Select a connection to browse schema
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-xs text-pastel-text-muted text-center">
          Connect to "{activeConnection.config.name}" to browse schema
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-pastel-text-muted">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs">Loading schema...</span>
        </div>
      </div>
    );
  }

  // Get schema names from the initial schema data
  const schemaNames = getSchemaNames(schema);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-pastel-border-light bg-pastel-bg-tertiary">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-pastel-accent-blue-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          <span className="text-xs font-semibold text-pastel-text-primary truncate">
            {activeConnection.config.name}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-pastel-bg-hover text-pastel-text-muted hover:text-pastel-text-primary"
          title="Refresh Schema"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Schema tree */}
      <div className="flex-1 overflow-auto p-2">
        {schemaNames.length === 0 ? (
          <p className="text-xs text-pastel-text-muted text-center py-4">
            No schemas found
          </p>
        ) : (
          schemaNames.map((name) => {
            const data = schemaData.get(name);
            return (
              <SchemaGroup
                key={name}
                name={name}
                tables={data?.tables || []}
                views={data?.views || []}
                isLoading={data?.loading || false}
                isExpanded={expandedSchemas.has(name)}
                expandedTables={expandedTables}
                columnData={columnData}
                onToggle={() => toggleSchema(name)}
                onToggleTable={toggleTable}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function getSchemaNames(schema?: SchemaInfo): string[] {
  if (!schema) return [];

  const names = new Set<string>();

  for (const table of schema.tables) {
    if (table.name !== '__schema_placeholder__') {
      names.add(table.schema);
    } else {
      // This is a placeholder entry, just add the schema name
      names.add(table.schema);
    }
  }

  for (const view of schema.views) {
    names.add(view.schema);
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

interface SchemaGroupProps {
  name: string;
  tables: TableInfo[];
  views: TableInfo[];
  isLoading: boolean;
  isExpanded: boolean;
  expandedTables: Set<string>;
  columnData: Map<string, { columns: ColumnInfo[]; loading?: boolean }>;
  onToggle: () => void;
  onToggleTable: (key: string, schemaName: string, tableName: string) => void;
}

function SchemaGroup({
  name,
  tables,
  views,
  isLoading,
  isExpanded,
  expandedTables,
  columnData,
  onToggle,
  onToggleTable,
}: SchemaGroupProps) {
  const totalCount = tables.length + views.length;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 py-1 px-1 rounded hover:bg-pastel-bg-hover text-left"
      >
        <svg
          className={`w-3 h-3 text-pastel-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4 text-pastel-accent-blue-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="flex-1 text-xs font-medium text-pastel-text-primary truncate">{name}</span>
        {isExpanded && totalCount > 0 && (
          <span className="text-2xs text-pastel-text-muted">{totalCount}</span>
        )}
      </button>

      {isExpanded && (
        <div className="ml-2">
          {isLoading ? (
            <div className="flex items-center gap-2 py-2 px-2 text-pastel-text-muted">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-2xs">Loading...</span>
            </div>
          ) : (
            <>
              {/* Tables */}
              {tables.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 py-0.5 px-1 text-2xs text-pastel-text-muted uppercase tracking-wider">
                    Tables ({tables.length})
                  </div>
                  {tables.map((table) => {
                    const tableKey = `${table.schema}.${table.name}`;
                    const colData = columnData.get(tableKey);
                    return (
                      <TableItem
                        key={tableKey}
                        table={table}
                        columns={colData?.columns || []}
                        isLoadingColumns={colData?.loading || false}
                        isExpanded={expandedTables.has(tableKey)}
                        onToggle={() => onToggleTable(tableKey, table.schema, table.name)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Views */}
              {views.length > 0 && (
                <div className="mt-1">
                  <div className="flex items-center gap-1 py-0.5 px-1 text-2xs text-pastel-text-muted uppercase tracking-wider">
                    Views ({views.length})
                  </div>
                  {views.map((view) => {
                    const viewKey = `${view.schema}.${view.name}`;
                    const colData = columnData.get(viewKey);
                    return (
                      <TableItem
                        key={viewKey}
                        table={view}
                        isView
                        columns={colData?.columns || []}
                        isLoadingColumns={colData?.loading || false}
                        isExpanded={expandedTables.has(viewKey)}
                        onToggle={() => onToggleTable(viewKey, view.schema, view.name)}
                      />
                    );
                  })}
                </div>
              )}

              {tables.length === 0 && views.length === 0 && (
                <p className="text-2xs text-pastel-text-muted py-1 px-2">No tables or views</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface TableItemProps {
  table: TableInfo;
  isView?: boolean;
  columns: ColumnInfo[];
  isLoadingColumns: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function TableItem({ table, isView, columns, isLoadingColumns, isExpanded, onToggle }: TableItemProps) {
  const handleCopyName = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${table.schema}.${table.name}`);
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1 py-0.5 px-1 ml-2 rounded hover:bg-pastel-bg-hover cursor-pointer"
        onClick={onToggle}
      >
        <svg
          className={`w-3 h-3 text-pastel-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {isView ? (
          <svg className="w-3.5 h-3.5 text-pastel-accent-purple-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-pastel-accent-green-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
        <span className="flex-1 text-xs text-pastel-text-primary truncate">{table.name}</span>
        <button
          onClick={handleCopyName}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-pastel-bg-active text-pastel-text-muted"
          title="Copy table name"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="ml-6">
          {isLoadingColumns ? (
            <div className="flex items-center gap-2 py-1 px-1 text-pastel-text-muted">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-2xs">Loading columns...</span>
            </div>
          ) : columns.length > 0 ? (
            columns.map((column) => (
              <ColumnItem key={column.name} column={column} />
            ))
          ) : (
            <p className="text-2xs text-pastel-text-muted py-1">No columns found</p>
          )}
        </div>
      )}
    </div>
  );
}

interface ColumnItemProps {
  column: ColumnInfo;
}

function ColumnItem({ column }: ColumnItemProps) {
  const handleCopyName = () => {
    navigator.clipboard.writeText(column.name);
  };

  return (
    <div
      className="group flex items-center gap-1 py-0.5 px-1 rounded hover:bg-pastel-bg-hover cursor-pointer"
      onClick={handleCopyName}
      title={`${column.name} (${column.type})${column.nullable ? '' : ' NOT NULL'} - Click to copy`}
    >
      <svg className="w-3 h-3 text-pastel-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
      <span className="flex-1 text-2xs text-pastel-text-secondary truncate">{column.name}</span>
      <span className="text-2xs text-pastel-text-disabled">{column.type}</span>
      {!column.nullable && (
        <span className="text-2xs text-pastel-accent-orange-text" title="NOT NULL">*</span>
      )}
    </div>
  );
}

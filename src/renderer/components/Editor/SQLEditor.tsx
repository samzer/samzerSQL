import { useEffect, useRef, useCallback } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql, PostgreSQL, MySQL, StandardSQL } from '@codemirror/lang-sql';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from '@codemirror/language';
import { autocompletion, completionKeymap, CompletionContext, Completion, acceptCompletion } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { format } from 'sql-formatter';
import { useUIStore } from '../../stores/uiStore';
import { useQueryStore } from '../../stores/queryStore';

interface SQLEditorProps {
  tabId: string;
  initialContent: string;
}

// Detect SQL context (SELECT, FROM, WHERE, etc.)
function getSqlContext(context: CompletionContext): 'select' | 'from' | 'where' | 'other' {
  const doc = context.state.doc;
  const pos = context.pos;

  // Get text from start of document to cursor
  const textBefore = doc.sliceString(0, pos).toUpperCase();

  // Find the last occurrence of each keyword
  const lastSelect = textBefore.lastIndexOf('SELECT');
  const lastFrom = textBefore.lastIndexOf('FROM');
  const lastWhere = textBefore.lastIndexOf('WHERE');
  const lastJoin = textBefore.lastIndexOf('JOIN');
  const lastOn = textBefore.lastIndexOf(' ON ');

  // Determine which clause we're in based on which keyword is closest
  const positions = [
    { keyword: 'select', pos: lastSelect },
    { keyword: 'from', pos: Math.max(lastFrom, lastJoin) },
    { keyword: 'where', pos: Math.max(lastWhere, lastOn) },
  ].filter(p => p.pos >= 0);

  if (positions.length === 0) return 'other';

  positions.sort((a, b) => b.pos - a.pos);
  return positions[0].keyword as 'select' | 'from' | 'where' | 'other';
}

// Parse table references from the query (schema.table patterns in FROM clause)
function parseTableReferences(doc: { toString: () => string }): Array<{ schema: string; table: string }> {
  const text = doc.toString();
  const tables: Array<{ schema: string; table: string }> = [];

  // Find FROM clause (case-insensitive)
  const fromMatch = text.match(/FROM\s+([^;]+?)(?:WHERE|GROUP|ORDER|LIMIT|HAVING|UNION|;|$)/i);
  if (!fromMatch) return tables;

  const fromClause = fromMatch[1];

  // Match schema.table patterns (handles multiple tables with JOIN)
  const tablePattern = /(\w+)\.(\w+)/g;
  let match;
  while ((match = tablePattern.exec(fromClause)) !== null) {
    tables.push({ schema: match[1], table: match[2] });
  }

  return tables;
}

// Dynamic schema completion source - fetches data on demand
async function schemaCompletionSource(context: CompletionContext) {
  // Match word characters and dots for schema.table.column patterns
  const word = context.matchBefore(/[\w."]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const text = word.text.replace(/"/g, '');
  const completions: Completion[] = [];

  // Detect SQL context
  const sqlContext = getSqlContext(context);
  console.log('[Autocomplete] Input text:', text, 'Context:', sqlContext);

  // Get current connection data from store
  const store = useConnectionStore.getState();
  const activeConnectionId = store.activeConnectionId;
  if (!activeConnectionId) {
    console.log('[Autocomplete] No active connection');
    return null;
  }

  const schemaInfo = store.schemas.get(activeConnectionId);
  if (!schemaInfo) {
    console.log('[Autocomplete] No schema info for connection:', activeConnectionId);
    return null;
  }

  // Get all schema names from the schema info (case-preserved)
  const schemaNames: string[] = [];
  for (const table of schemaInfo.tables) {
    if (!schemaNames.includes(table.schema)) {
      schemaNames.push(table.schema);
    }
  }

  console.log('[Autocomplete] Available schemas:', schemaNames);

  const parts = text.split('.');
  console.log('[Autocomplete] Parts:', parts, 'Length:', parts.length);

  // Helper to fetch tables for a schema - fetches on demand
  const fetchTables = async (schemaName: string) => {
    try {
      return await store.getTablesInSchema(activeConnectionId, schemaName);
    } catch {
      return { tables: [], views: [] };
    }
  };

  // Helper to fetch columns - fetches on demand
  const fetchColumns = async (schemaName: string, tableName: string) => {
    try {
      return await store.getColumns(activeConnectionId, schemaName, tableName);
    } catch {
      return [];
    }
  };

  // Case-insensitive schema match
  const findSchema = (input: string) => {
    return schemaNames.find(s => s.toLowerCase() === input.toLowerCase());
  };

  // If typing just started or no dot yet, show schemas (and columns in SELECT/WHERE context)
  if (parts.length === 1) {
    const prefix = parts[0].toLowerCase();

    // Add matching schemas
    for (const schemaName of schemaNames) {
      if (schemaName.toLowerCase().startsWith(prefix) || prefix === '') {
        completions.push({
          label: schemaName,
          type: 'namespace',
          detail: 'schema',
          boost: 3,
        });
      }
    }

    // In SELECT or WHERE context, load columns from tables referenced in FROM clause
    if (sqlContext === 'select' || sqlContext === 'where') {
      // Parse table references from the query
      const tableRefs = parseTableReferences(context.state.doc);
      console.log('[Autocomplete] Table references from FROM clause:', tableRefs);

      // Load columns for each referenced table
      for (const ref of tableRefs) {
        const matchedSchema = findSchema(ref.schema);
        if (matchedSchema) {
          try {
            const columns = await fetchColumns(matchedSchema, ref.table);
            console.log('[Autocomplete] Columns for', ref.schema + '.' + ref.table, ':', columns.map(c => c.name));

            for (const col of columns) {
              if (col.name.toLowerCase().startsWith(prefix) || prefix === '') {
                completions.push({
                  label: col.name,
                  type: 'property',
                  detail: `${col.type} (${ref.table})`,
                  boost: 2,
                });
              }
            }
          } catch (e) {
            console.log('[Autocomplete] Error loading columns:', e);
          }
        }
      }
    }
  }

  // If we have schema.something - fetch tables and show them
  if (parts.length === 2) {
    const firstPart = parts[0];
    const secondPart = parts[1].toLowerCase();

    const matchedSchema = findSchema(firstPart);
    if (matchedSchema) {
      // Fetch tables on demand
      const schemaData = await fetchTables(matchedSchema);

      for (const table of schemaData.tables) {
        if (table.name.toLowerCase().startsWith(secondPart) || secondPart === '') {
          completions.push({
            label: table.name,
            type: 'class',
            detail: 'table',
            boost: 2,
          });
        }
      }
      for (const view of schemaData.views) {
        if (view.name.toLowerCase().startsWith(secondPart) || secondPart === '') {
          completions.push({
            label: view.name,
            type: 'interface',
            detail: 'view',
            boost: 2,
          });
        }
      }
    }
  }

  // If we have schema.table.column - fetch columns and show them (only in SELECT/WHERE context)
  if (parts.length === 3 && (sqlContext === 'select' || sqlContext === 'where')) {
    const schemaName = parts[0];
    const tableName = parts[1];
    const columnPrefix = parts[2].toLowerCase();

    console.log('[Autocomplete] 3 parts - schema:', schemaName, 'table:', tableName, 'prefix:', columnPrefix);

    const matchedSchema = findSchema(schemaName);
    console.log('[Autocomplete] Matched schema:', matchedSchema);

    if (matchedSchema) {
      // Fetch tables to find the actual table name (case-sensitive)
      const schemaData = await fetchTables(matchedSchema);
      console.log('[Autocomplete] Tables in schema:', schemaData.tables.map(t => t.name));

      const allTables = [...schemaData.tables, ...schemaData.views];
      const matchedTable = allTables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
      console.log('[Autocomplete] Matched table:', matchedTable?.name);

      if (matchedTable) {
        // Fetch columns on demand
        const columns = await fetchColumns(matchedSchema, matchedTable.name);
        console.log('[Autocomplete] Columns:', columns.map(c => c.name));

        for (const col of columns) {
          if (col.name.toLowerCase().startsWith(columnPrefix) || columnPrefix === '') {
            completions.push({
              label: col.name,
              type: 'property',
              detail: col.type,
              boost: 3,
            });
          }
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const uniqueCompletions = completions.filter(c => {
    const key = `${c.label}-${c.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log('[Autocomplete] Total completions:', uniqueCompletions.length);

  if (uniqueCompletions.length === 0) return null;

  // Calculate the correct 'from' position based on what we're completing
  // For schema.table.column, we want to replace only the column part
  let fromPos = word.from;
  if (parts.length === 2) {
    // After schema., replace just the table part
    fromPos = word.from + parts[0].length + 1; // +1 for the dot
  } else if (parts.length === 3) {
    // After schema.table., replace just the column part
    fromPos = word.from + parts[0].length + 1 + parts[1].length + 1; // +1 for each dot
  }

  console.log('[Autocomplete] from position:', fromPos, 'word.from:', word.from);

  return {
    from: fromPos,
    options: uniqueCompletions,
    validFor: /^[\w"]*$/,
  };
}

// Custom pastel theme for CodeMirror
const pastelTheme = EditorView.theme({
  '&': {
    backgroundColor: '#fafbfc',
    color: '#2c3e50',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', Monaco, Consolas, monospace",
    fontSize: '13px',
    lineHeight: '1.6',
    padding: '8px 0',
  },
  '.cm-cursor': {
    borderLeftColor: '#2c3e50',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#a8d4f0 !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: '#a8d4f0 !important',
  },
  '.cm-activeLine': {
    backgroundColor: '#f5f7f9',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#eef1f5',
  },
  '.cm-gutters': {
    backgroundColor: '#f5f7f9',
    color: '#8392a5',
    borderRight: '1px solid #e5e9ef',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
  },
  '.cm-foldGutter': {
    width: '16px',
  },
  '.cm-tooltip': {
    backgroundColor: '#fff',
    border: '1px solid #e5e9ef',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
    },
    '& > ul > li': {
      padding: '4px 8px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: '#a8d4f0',
      color: '#2c3e50',
    },
  },
  '.cm-matchingBracket': {
    backgroundColor: '#b8e6c9',
    outline: 'none',
  },
});

// Compartment for dynamic SQL configuration updates
const sqlCompartment = new Compartment();

export default function SQLEditor({ tabId, initialContent }: SQLEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Use refs to store latest values without triggering re-renders
  const tabIdRef = useRef(tabId);
  const callbacksRef = useRef({
    updateTabContent: useEditorStore.getState().updateTabContent,
    executeQuery: useEditorStore.getState().executeQuery,
    setTabDirty: useEditorStore.getState().setTabDirty,
    addToast: useUIStore.getState().addToast,
    getQueryById: useQueryStore.getState().getQueryById,
    updateQuery: useQueryStore.getState().updateQuery,
  });

  // Get schema data for autocomplete
  const { schemas, schemaTables, tableColumns, activeConnectionId } = useConnectionStore();

  // Keep refs up to date
  useEffect(() => {
    tabIdRef.current = tabId;
  }, [tabId]);

  // Subscribe to store changes to keep callbacks current
  useEffect(() => {
    const unsubEditor = useEditorStore.subscribe((state) => {
      callbacksRef.current.updateTabContent = state.updateTabContent;
      callbacksRef.current.executeQuery = state.executeQuery;
      callbacksRef.current.setTabDirty = state.setTabDirty;
    });
    const unsubUI = useUIStore.subscribe((state) => {
      callbacksRef.current.addToast = state.addToast;
    });
    const unsubQuery = useQueryStore.subscribe((state) => {
      callbacksRef.current.getQueryById = state.getQueryById;
      callbacksRef.current.updateQuery = state.updateQuery;
    });
    return () => {
      unsubEditor();
      unsubUI();
      unsubQuery();
    };
  }, []);

  const getDialect = useCallback(() => {
    const connections = useConnectionStore.getState().connections;
    const tabs = useEditorStore.getState().tabs;
    const currentActiveConnectionId = useConnectionStore.getState().activeConnectionId;
    const activeTab = tabs.find((t) => t.id === tabIdRef.current);
    const activeConnection = connections.find((c) => c.id === (activeTab?.connectionId || currentActiveConnectionId));

    switch (activeConnection?.config.type) {
      case 'postgresql':
        return PostgreSQL;
      case 'mysql':
        return MySQL;
      default:
        return StandardSQL;
    }
  }, []);

  // Build the SQL extension (dialect only - completions handled separately)
  const buildSqlExtension = useCallback(() => {
    return sql({
      dialect: getDialect(),
    });
  }, [getDialect]);

  const handleRunQuery = useCallback(async () => {
    const connections = useConnectionStore.getState().connections;
    const tabs = useEditorStore.getState().tabs;
    const activeConnectionId = useConnectionStore.getState().activeConnectionId;
    const activeTab = tabs.find((t) => t.id === tabIdRef.current);
    const activeConnection = connections.find((c) => c.id === (activeTab?.connectionId || activeConnectionId));

    if (!activeConnection || activeConnection.status !== 'connected') {
      callbacksRef.current.addToast({ type: 'warning', message: 'Please connect to a database first' });
      return;
    }
    const content = viewRef.current?.state.doc.toString() || '';
    if (!content.trim()) {
      callbacksRef.current.addToast({ type: 'warning', message: 'No query to execute' });
      return;
    }
    await callbacksRef.current.executeQuery(tabIdRef.current, content, activeConnection.id, activeConnection.config.name);
  }, []);

  const handleSaveQuery = useCallback(async () => {
    const tabs = useEditorStore.getState().tabs;
    const tab = tabs.find((t) => t.id === tabIdRef.current);
    if (!tab?.queryFileId) {
      callbacksRef.current.addToast({ type: 'info', message: 'Create a new query in the sidebar to save' });
      return;
    }
    const queryFile = callbacksRef.current.getQueryById(tab.queryFileId);
    if (queryFile) {
      await callbacksRef.current.updateQuery({
        ...queryFile,
        content: viewRef.current?.state.doc.toString() || '',
        connectionId: tab.connectionId,
      });
      callbacksRef.current.setTabDirty(tabIdRef.current, false);
      callbacksRef.current.addToast({ type: 'success', message: 'Query saved' });
    }
  }, []);

  const handleFormatQuery = useCallback(() => {
    const connections = useConnectionStore.getState().connections;
    const tabs = useEditorStore.getState().tabs;
    const activeConnectionId = useConnectionStore.getState().activeConnectionId;
    const activeTab = tabs.find((t) => t.id === tabIdRef.current);
    const activeConnection = connections.find((c) => c.id === (activeTab?.connectionId || activeConnectionId));

    const content = viewRef.current?.state.doc.toString() || '';
    try {
      const dialect = activeConnection?.config.type === 'postgresql' ? 'postgresql' :
                      activeConnection?.config.type === 'mysql' ? 'mysql' : 'sql';
      const formatted = format(content, {
        language: dialect,
        tabWidth: 2,
        keywordCase: 'upper',
      });
      viewRef.current?.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: formatted,
        },
      });
      callbacksRef.current.addToast({ type: 'success', message: 'Query formatted' });
    } catch {
      callbacksRef.current.addToast({ type: 'error', message: 'Failed to format query' });
    }
  }, []);

  // Listen for format-query event from toolbar
  useEffect(() => {
    const handleFormatEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ tabId: string }>;
      if (customEvent.detail.tabId === tabIdRef.current) {
        handleFormatQuery();
      }
    };

    window.addEventListener('format-query', handleFormatEvent);
    return () => window.removeEventListener('format-query', handleFormatEvent);
  }, [handleFormatQuery]);

  // Update SQL configuration when schema data changes
  useEffect(() => {
    if (!viewRef.current) return;

    // Reconfigure the SQL extension with updated schema
    viewRef.current.dispatch({
      effects: sqlCompartment.reconfigure(buildSqlExtension()),
    });
  }, [activeConnectionId, schemas, schemaTables, tableColumns, buildSqlExtension]);

  // Initialize editor only once per tabId
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up existing view if any
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const customKeymap = keymap.of([
      {
        key: 'Mod-Enter',
        run: () => {
          handleRunQuery();
          return true;
        },
      },
      {
        key: 'Mod-s',
        run: () => {
          handleSaveQuery();
          return true;
        },
      },
      {
        key: 'Mod-Shift-f',
        run: () => {
          handleFormatQuery();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        foldGutter(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle),
        sqlCompartment.of(buildSqlExtension()),
        autocompletion({
          override: [schemaCompletionSource],
          activateOnTyping: true,
          defaultKeymap: true,
        }),
        pastelTheme,
        customKeymap,
        keymap.of([
          // Tab to accept first completion
          { key: 'Tab', run: acceptCompletion },
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            callbacksRef.current.updateTabContent(tabIdRef.current, update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Focus the editor
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // Only recreate when tabId changes - initialContent is only used for initial state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}

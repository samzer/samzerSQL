import { useEffect } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';

export default function HistoryPanel() {
  const { history, loadHistory, createTab, clearHistory } = useEditorStore();
  const { addToast } = useUIStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = async () => {
    await clearHistory();
    addToast({ type: 'success', message: 'History cleared' });
  };

  const handleUseQuery = (query: string, connectionId: string) => {
    createTab({ content: query, connectionId });
  };

  if (history.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-pastel-text-muted">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No query history yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-pastel-border-light bg-pastel-bg-secondary">
        <span className="text-xs text-pastel-text-muted">
          {history.length} quer{history.length === 1 ? 'y' : 'ies'} in history
        </span>
        <button
          onClick={handleClear}
          className="text-xs text-pastel-text-muted hover:text-pastel-status-error-text transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-auto">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="px-3 py-2 border-b border-pastel-border-light hover:bg-pastel-bg-hover group"
          >
            {/* Meta info */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xs text-pastel-text-muted">
                {new Date(entry.executedAt).toLocaleString()}
              </span>
              <span className="text-2xs text-pastel-text-disabled">|</span>
              <span className="text-2xs text-pastel-text-muted">{entry.connectionName}</span>
              <span className="text-2xs text-pastel-text-disabled">|</span>
              {entry.error ? (
                <span className="text-2xs text-pastel-status-error-text">Error</span>
              ) : (
                <>
                  <span className="text-2xs text-pastel-status-success-text">
                    {entry.rowCount} row{entry.rowCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-2xs text-pastel-text-disabled">|</span>
                  <span className="text-2xs text-pastel-text-muted">{entry.executionTime}ms</span>
                </>
              )}
            </div>

            {/* Query preview */}
            <div className="flex items-start justify-between gap-2">
              <pre className="flex-1 text-xs font-mono text-pastel-text-primary truncate">
                {entry.query.slice(0, 200)}
                {entry.query.length > 200 && '...'}
              </pre>

              {/* Use query button */}
              <button
                onClick={() => handleUseQuery(entry.query, entry.connectionId)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 px-2 py-1 text-2xs bg-pastel-accent-blue hover:bg-pastel-accent-blue-hover text-pastel-accent-blue-text rounded transition-opacity"
              >
                Use
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

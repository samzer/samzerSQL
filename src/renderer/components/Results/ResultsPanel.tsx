import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';
import DataTable from './DataTable';
import HistoryPanel from './HistoryPanel';
import { exportToCSV, exportToJSON, copyToClipboard } from '../../utils/export';

export default function ResultsPanel() {
  const { tabs, activeTabId } = useEditorStore();
  const { resultsTab, setResultsTab, addToast } = useUIStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const result = activeTab?.result;

  const hasData = result && !result.error && result.rows.length > 0;

  const handleExportCSV = () => {
    if (!hasData || !result) return;
    exportToCSV(result.columns, result.rows, `query-results-${Date.now()}.csv`);
    addToast({ type: 'success', message: 'Exported to CSV' });
  };

  const handleExportJSON = () => {
    if (!hasData || !result) return;
    exportToJSON(result.rows, `query-results-${Date.now()}.json`);
    addToast({ type: 'success', message: 'Exported to JSON' });
  };

  const handleCopy = async () => {
    if (!hasData || !result) return;
    await copyToClipboard(result.columns, result.rows);
    addToast({ type: 'success', message: 'Copied to clipboard' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center border-b border-pastel-border-light bg-pastel-bg-secondary">
        <TabButton
          label="Results"
          isActive={resultsTab === 'results'}
          onClick={() => setResultsTab('results')}
          badge={result?.rowCount}
        />
        <TabButton
          label="Messages"
          isActive={resultsTab === 'messages'}
          onClick={() => setResultsTab('messages')}
          hasError={!!result?.error}
        />
        <TabButton
          label="History"
          isActive={resultsTab === 'history'}
          onClick={() => setResultsTab('history')}
        />

        {/* Stats and Export buttons */}
        {result && !result.error && resultsTab === 'results' && (
          <div className="ml-auto flex items-center gap-2 px-3">
            {hasData && (
              <div className="flex items-center gap-1">
                <ExportButton onClick={handleCopy} title="Copy to Clipboard">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </ExportButton>
                <ExportButton onClick={handleExportCSV} title="Export CSV">
                  CSV
                </ExportButton>
                <ExportButton onClick={handleExportJSON} title="Export JSON">
                  JSON
                </ExportButton>
              </div>
            )}
            <span className="text-xs text-pastel-text-muted">
              {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} in{' '}
              {result.executionTime < 1000
                ? `${result.executionTime}ms`
                : `${(result.executionTime / 1000).toFixed(2)}s`}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {resultsTab === 'results' && <ResultsContent result={result} isExecuting={activeTab?.isExecuting} />}
        {resultsTab === 'messages' && <MessagesContent result={result} />}
        {resultsTab === 'history' && <HistoryPanel />}
      </div>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  hasError?: boolean;
}

function TabButton({ label, isActive, onClick, badge, hasError }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 text-sm font-medium border-b-2 transition-colors
        ${isActive
          ? 'text-pastel-text-primary border-pastel-accent-blue'
          : 'text-pastel-text-muted border-transparent hover:text-pastel-text-primary hover:bg-pastel-bg-hover'
        }
      `}
    >
      <span className="flex items-center gap-2">
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 text-2xs rounded-full bg-pastel-accent-blue text-pastel-accent-blue-text">
            {badge > 9999 ? '9999+' : badge}
          </span>
        )}
        {hasError && (
          <span className="w-2 h-2 rounded-full bg-pastel-status-error" />
        )}
      </span>
    </button>
  );
}

interface ExportButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ExportButton({ onClick, title, children }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="px-1.5 py-0.5 text-2xs font-medium text-pastel-text-muted hover:text-pastel-text-primary hover:bg-pastel-bg-hover rounded transition-colors"
    >
      {children}
    </button>
  );
}

interface ResultsContentProps {
  result?: import('../../../shared/types').QueryResult;
  isExecuting?: boolean;
}

function ResultsContent({ result, isExecuting }: ResultsContentProps) {
  if (isExecuting) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-pastel-text-muted">
        <svg className="w-8 h-8 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-sm">Executing query...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-pastel-text-muted">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Run a query to see results</p>
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="max-w-lg text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pastel-status-error flex items-center justify-center">
            <svg className="w-6 h-6 text-pastel-status-error-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm text-pastel-status-error-text">{result.error}</p>
        </div>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-pastel-text-muted">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm">Query executed successfully</p>
          <p className="text-xs text-pastel-text-disabled mt-1">No rows returned</p>
        </div>
      </div>
    );
  }

  return <DataTable columns={result.columns} rows={result.rows} />;
}

interface MessagesContentProps {
  result?: import('../../../shared/types').QueryResult;
}

function MessagesContent({ result }: MessagesContentProps) {
  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-pastel-text-muted">
        <p className="text-sm">No messages</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 font-mono text-sm">
      {result.error ? (
        <div className="text-pastel-status-error-text">
          <span className="font-semibold">ERROR: </span>
          {result.error}
        </div>
      ) : (
        <div className="text-pastel-status-success-text">
          Query executed successfully.
          {result.rowCount > 0 && ` ${result.rowCount} row${result.rowCount !== 1 ? 's' : ''} returned.`}
          {` (${result.executionTime}ms)`}
        </div>
      )}
    </div>
  );
}

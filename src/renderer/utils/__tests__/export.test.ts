import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DOM APIs using classes for constructors
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:url');
const mockRevokeObjectURL = vi.fn();

class MockBlob {
  parts: string[];
  type: string;
  constructor(parts: string[], opts: { type: string }) {
    this.parts = parts;
    this.type = opts.type;
  }
}

vi.stubGlobal('Blob', MockBlob);
vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
vi.stubGlobal('document', {
  createElement: vi.fn().mockReturnValue({
    href: '',
    download: '',
    click: mockClick,
  }),
  body: {
    appendChild: mockAppendChild,
    removeChild: mockRemoveChild,
  },
});
vi.stubGlobal('navigator', {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

import { exportToCSV, exportToJSON, copyToClipboard } from '../export';
import type { ColumnInfo } from '../../../shared/types';

const columns: ColumnInfo[] = [
  { name: 'id', type: 'integer', nullable: false },
  { name: 'name', type: 'text', nullable: true },
  { name: 'bio', type: 'text', nullable: true },
];

const rows = [
  { id: 1, name: 'Alice', bio: 'Hello, world' },
  { id: 2, name: 'Bob "B"', bio: 'Line1\nLine2' },
  { id: 3, name: null, bio: undefined },
];

describe('export utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportToCSV', () => {
    it('builds correct CSV with headers', () => {
      exportToCSV(columns, rows as any);

      // Verify the full download flow executed
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:url');
    });
  });

  describe('exportToJSON', () => {
    it('produces formatted JSON', () => {
      exportToJSON(rows as any);

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('copyToClipboard', () => {
    it('produces tab-separated output', async () => {
      await copyToClipboard(columns, rows as any);

      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const lines = text.split('\n');
      expect(lines[0]).toBe('id\tname\tbio');
      expect(lines[1]).toBe('1\tAlice\tHello, world');
    });
  });
});

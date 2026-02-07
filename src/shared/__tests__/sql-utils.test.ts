import { describe, it, expect } from 'vitest';
import { splitStatements } from '../sql-utils';

describe('splitStatements', () => {
  it('returns a single statement without semicolon', () => {
    expect(splitStatements('SELECT 1')).toEqual(['SELECT 1']);
  });

  it('returns a single statement with semicolon', () => {
    expect(splitStatements('SELECT 1;')).toEqual(['SELECT 1']);
  });

  it('splits multiple statements', () => {
    expect(splitStatements('SELECT 1; SELECT 2; SELECT 3')).toEqual([
      'SELECT 1',
      'SELECT 2',
      'SELECT 3',
    ]);
  });

  it('ignores semicolons inside single-quoted strings', () => {
    expect(splitStatements("SELECT 'a;b'")).toEqual(["SELECT 'a;b'"]);
  });

  it('ignores semicolons inside double-quoted identifiers', () => {
    expect(splitStatements('SELECT "col;name" FROM t')).toEqual([
      'SELECT "col;name" FROM t',
    ]);
  });

  it('ignores semicolons inside line comments', () => {
    expect(splitStatements('SELECT 1 -- comment;\nSELECT 2')).toEqual([
      'SELECT 1 -- comment;\nSELECT 2',
    ]);
  });

  it('ignores semicolons inside block comments', () => {
    expect(splitStatements('SELECT 1 /* ; */ + 2')).toEqual([
      'SELECT 1 /* ; */ + 2',
    ]);
  });

  it('skips empty statements between semicolons', () => {
    expect(splitStatements('SELECT 1;; ;SELECT 2')).toEqual([
      'SELECT 1',
      'SELECT 2',
    ]);
  });

  it('handles trailing whitespace', () => {
    expect(splitStatements('SELECT 1;  \n  ')).toEqual(['SELECT 1']);
  });

  it('returns empty array for empty input', () => {
    expect(splitStatements('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(splitStatements('   \n\t  ')).toEqual([]);
  });

  it('handles mixed comments and strings', () => {
    const sql = `
      SELECT 'hello; world' FROM t; -- comment;
      INSERT INTO t VALUES ("a;b", /* ; */ 1);
      SELECT 3
    `;
    const result = splitStatements(sql);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("'hello; world'");
    expect(result[1]).toContain('"a;b"');
    expect(result[1]).toContain('/* ; */');
    expect(result[2]).toBe('SELECT 3');
  });
});

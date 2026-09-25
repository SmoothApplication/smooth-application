// Shared helpers for the ported statement-engine tests — not itself a test file.
import type { ParsedTxn } from '../types';

export function txn(
  input: { narration: string; credit?: number; debit?: number; dateISO: string; balance?: number }
): ParsedTxn {
  return {
    date: new Date(input.dateISO),
    credit: input.credit || 0,
    debit: input.debit || 0,
    balance: input.balance || 0,
    narration: input.narration,
  };
}

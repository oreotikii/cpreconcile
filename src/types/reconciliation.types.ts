// Reconciliation Status Constants
export const ReconciliationStatus = {
  MATCHED: 'MATCHED',
  PARTIAL_MATCH: 'PARTIAL_MATCH',
  UNMATCHED: 'UNMATCHED',
  DISCREPANCY: 'DISCREPANCY',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
} as const;

export type ReconciliationStatusType = typeof ReconciliationStatus[keyof typeof ReconciliationStatus];

import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from '@tanstack/react-table';

export const applicationTableFeatures = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

export type ApplicationTableFeatures = typeof applicationTableFeatures;

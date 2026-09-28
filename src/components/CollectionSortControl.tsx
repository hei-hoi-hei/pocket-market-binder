import type { CollectionSortMode } from '@/utils/collectionSorting';

export interface CollectionSortOption {
  value: CollectionSortMode;
  label: string;
}

interface Props {
  value: CollectionSortMode;
  options: readonly CollectionSortOption[];
  onChange: (value: CollectionSortMode) => void;
}

export function CollectionSortControl({ value, options, onChange }: Props) {
  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <label htmlFor="collection-sort" className="shrink-0 text-xs font-semibold text-leather-500">
        Sort
      </label>
      <select
        id="collection-sort"
        value={value}
        onChange={(event) => {
          const option = options.find(({ value: optionValue }) => optionValue === event.currentTarget.value);
          if (option) onChange(option.value);
        }}
        className="min-h-11 min-w-0 max-w-full rounded-lg border border-parchment-300 bg-white px-3 py-2 text-sm text-leather-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-leather-400 sm:w-auto"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

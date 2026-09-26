import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { useDebounce } from '@/utils/use-debounce';
import { Spinner } from '@/components/ui';
import { cn } from '@/utils';

/**
 * SearchBar — keyword + location + remote toggle. Debounced auto-search (300 ms) plus explicit submit.
 */
export default function SearchBar({ onSearch, initialQuery = '', initialLocation = '', isFetching = false }) {
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [isRemote, setIsRemote] = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const debouncedLocation = useDebounce(location, 300);
  const debouncedRemote = useDebounce(isRemote, 300);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; } // initial params are already loaded
    onSearch({ q: debouncedQuery, where: debouncedRemote ? 'remote' : debouncedLocation });
  }, [debouncedQuery, debouncedLocation, debouncedRemote]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({ q: query, where: isRemote ? 'remote' : location });
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex flex-col gap-1.5 rounded-r24 border border-line-2 bg-white p-1.5 md:flex-row md:items-center md:rounded-full"
    >
      <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-4 py-3 md:py-2.5">
        <Search size={18} className="flex-shrink-0 text-faint" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Role, skill or company"
          aria-label="Keywords"
          className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear keywords" className="rounded-full p-1 text-faint hover:bg-stone-2 hover:text-ink">
            <X size={15} />
          </button>
        )}
      </label>
      <span className="hidden h-7 w-px bg-line md:block" aria-hidden="true" />
      <label className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-full px-4 py-3 md:py-2.5', isRemote && 'opacity-50')}>
        <MapPin size={18} className="flex-shrink-0 text-faint" aria-hidden="true" />
        <input
          type="text"
          value={isRemote ? 'Remote' : location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={isRemote}
          placeholder="City or region"
          aria-label="Location"
          className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
        {location && !isRemote && (
          <button type="button" onClick={() => setLocation('')} aria-label="Clear location" className="rounded-full p-1 text-faint hover:bg-stone-2 hover:text-ink">
            <X size={15} />
          </button>
        )}
      </label>
      <div className="flex items-center justify-between gap-2 px-2 pb-1 md:px-0 md:pb-0">
        <button type="button" className="chip-toggle" aria-pressed={isRemote} onClick={() => setIsRemote((r) => !r)}>
          Remote only
        </button>
        <button type="submit" className="btn btn-ink min-w-[108px]" disabled={isFetching}>
          {isFetching ? <Spinner size={15} /> : 'Search'}
        </button>
      </div>
    </form>
  );
}

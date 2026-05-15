"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Search, FileText, BrainCircuit } from "lucide-react";
import { searchMeetings } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface SearchResults {
  meetings: Array<{ id: string; title: string; status: string; created_at: string }>;
  topics: Array<{ meeting_id: string; title: string; status: string }>;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await searchMeetings(q.trim());
      setResults(data);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch(query);
  }

  const hasResults = results && (results.meetings.length > 0 || results.topics.length > 0);
  const noResults = results && results.meetings.length === 0 && results.topics.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h2>Search</h2>
        <p className="text-gray-500 mt-1">Search across your meetings and topics</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search meetings and topics... (press Enter)"
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          autoFocus
        />
        {query && (
          <button
            onClick={() => handleSearch(query)}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700 transition-colors"
          >
            Search
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-10 text-gray-400 text-sm">Searching...</div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && noResults && (
        <div className="text-center py-10 text-gray-400">
          <p>No results found for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {!loading && hasResults && (
        <div className="space-y-8">
          {results.meetings.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-gray-900">
                <FileText size={16} className="text-gray-500" />
                Meetings
                <span className="text-sm text-gray-500 font-normal">({results.meetings.length})</span>
              </h3>
              {results.meetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-900 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate">{m.title}</span>
                    <span className="ml-3 shrink-0 px-2.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                      meeting
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(m.created_at)}</p>
                </Link>
              ))}
            </div>
          )}

          {results.topics.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-gray-900">
                <BrainCircuit size={16} className="text-gray-500" />
                Topics
                <span className="text-sm text-gray-500 font-normal">({results.topics.length})</span>
              </h3>
              {results.topics.map((t, i) => (
                <Link
                  key={i}
                  href={`/meetings/${t.meeting_id}`}
                  className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-900 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate">{t.title}</span>
                    <span className="ml-3 shrink-0 px-2.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                      topic
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

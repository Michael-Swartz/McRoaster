'use client';

import { useState } from 'react';
import type { RoastSession } from '@/types/roastHistory';
import { formatDuration, formatRoastDate } from '@/types/roastHistory';

interface RoastHistoryBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  savedRoasts: RoastSession[];
  onDeleteRoast: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateRating: (id: string, rating: number) => void;
  onExportRoast: (id: string) => string | null;
  onClearAll: () => void;
  storageUsed: number;
  maxStorage: number;
}

function StarRating({
  rating,
  onChange,
  readonly = false,
}: {
  rating: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          className={`text-lg ${
            star <= (rating || 0)
              ? 'text-yellow-400'
              : 'text-zinc-600'
          } ${readonly ? 'cursor-default' : 'hover:text-yellow-300 cursor-pointer'}`}
        >
          {star <= (rating || 0) ? '\u2605' : '\u2606'}
        </button>
      ))}
    </div>
  );
}

export function RoastHistoryBrowser({
  isOpen,
  onClose,
  savedRoasts,
  onDeleteRoast,
  onUpdateNotes,
  onUpdateRating,
  onExportRoast,
  onClearAll,
  storageUsed,
  maxStorage,
}: RoastHistoryBrowserProps) {
  const [selectedRoast, setSelectedRoast] = useState<RoastSession | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  if (!isOpen) return null;

  const storagePercent = (storageUsed / maxStorage) * 100;

  const handleSelectRoast = (roast: RoastSession) => {
    setSelectedRoast(roast);
    setNotesValue(roast.notes);
    setEditingNotes(false);
  };

  const handleSaveNotes = () => {
    if (selectedRoast) {
      onUpdateNotes(selectedRoast.id, notesValue);
      setSelectedRoast({ ...selectedRoast, notes: notesValue });
      setEditingNotes(false);
    }
  };

  const handleExport = (id: string) => {
    const json = onExportRoast(id);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roast-${id.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleDelete = (id: string) => {
    onDeleteRoast(id);
    setConfirmDelete(null);
    if (selectedRoast?.id === id) {
      setSelectedRoast(null);
    }
  };

  const handleClearAll = () => {
    onClearAll();
    setConfirmClearAll(false);
    setSelectedRoast(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-xl font-semibold text-zinc-100">Roast History</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Roast List */}
          <div className="w-1/3 border-r border-zinc-700 overflow-y-auto">
            {savedRoasts.length === 0 ? (
              <div className="p-4 text-zinc-500 text-sm text-center">
                No saved roasts yet
              </div>
            ) : (
              <div className="divide-y divide-zinc-700">
                {savedRoasts.map((roast) => (
                  <button
                    key={roast.id}
                    onClick={() => handleSelectRoast(roast)}
                    className={`w-full p-3 text-left hover:bg-zinc-700/50 transition-colors ${
                      selectedRoast?.id === roast.id ? 'bg-zinc-700/50' : ''
                    }`}
                  >
                    <div className="text-zinc-200 text-sm font-medium">
                      {formatRoastDate(roast.startTime)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-zinc-400 text-xs">
                        {formatDuration(roast.totalRoastTime)}
                      </span>
                      {roast.firstCrackTime && (
                        <span className="text-yellow-500 text-xs">FC</span>
                      )}
                      {roast.rating && (
                        <StarRating rating={roast.rating} readonly />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Roast Details */}
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedRoast ? (
              <div className="space-y-4">
                {/* Roast Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Date</label>
                    <div className="text-zinc-200">
                      {formatRoastDate(selectedRoast.startTime)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Duration</label>
                    <div className="text-zinc-200 mono-display">
                      {formatDuration(selectedRoast.totalRoastTime)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Preheat Temp</label>
                    <div className="text-zinc-200 mono-display">
                      {selectedRoast.preheatSetpoint}C
                    </div>
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Roast Temp</label>
                    <div className="text-zinc-200 mono-display">
                      {selectedRoast.roastSetpoint}C
                    </div>
                  </div>
                  {selectedRoast.firstCrackTime && (
                    <div>
                      <label className="block text-zinc-500 text-xs mb-1">First Crack</label>
                      <div className="text-yellow-400 mono-display">
                        {formatDuration(selectedRoast.firstCrackTime)}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-zinc-500 text-xs mb-1">Data Points</label>
                    <div className="text-zinc-200">
                      {selectedRoast.temperatureData.length}
                    </div>
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-zinc-500 text-xs mb-1">Rating</label>
                  <StarRating
                    rating={selectedRoast.rating}
                    onChange={(rating) => {
                      onUpdateRating(selectedRoast.id, rating);
                      setSelectedRoast({ ...selectedRoast, rating });
                    }}
                  />
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-500 text-xs">Notes</label>
                    {!editingNotes && (
                      <button
                        onClick={() => setEditingNotes(true)}
                        className="text-blue-400 text-xs hover:text-blue-300"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        className="w-full h-24 px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-200 text-sm resize-none focus:outline-none focus:border-blue-500"
                        placeholder="Add notes about this roast..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNotes}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNotes(false);
                            setNotesValue(selectedRoast.notes);
                          }}
                          className="px-3 py-1 bg-zinc-700 text-zinc-300 text-sm rounded hover:bg-zinc-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-zinc-300 text-sm min-h-[60px]">
                      {selectedRoast.notes || (
                        <span className="text-zinc-500 italic">No notes</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-zinc-700">
                  <button
                    onClick={() => handleExport(selectedRoast.id)}
                    className="px-4 py-2 bg-zinc-700 text-zinc-200 text-sm rounded hover:bg-zinc-600 transition-colors"
                  >
                    Export JSON
                  </button>
                  {confirmDelete === selectedRoast.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(selectedRoast.id)}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-500"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-4 py-2 bg-zinc-700 text-zinc-300 text-sm rounded hover:bg-zinc-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(selectedRoast.id)}
                      className="px-4 py-2 bg-red-900/50 text-red-400 text-sm rounded hover:bg-red-900/70 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Select a roast to view details
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 flex items-center justify-between">
          <div className="text-zinc-500 text-xs">
            <div className="flex items-center gap-2">
              <span>Storage:</span>
              <div className="w-32 h-2 bg-zinc-700 rounded overflow-hidden">
                <div
                  className={`h-full ${storagePercent > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(storagePercent, 100)}%` }}
                />
              </div>
              <span>{(storageUsed / 1024).toFixed(1)} KB / {(maxStorage / 1024 / 1024).toFixed(0)} MB</span>
            </div>
          </div>
          {savedRoasts.length > 0 && (
            confirmClearAll ? (
              <div className="flex gap-2">
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-500"
                >
                  Confirm Clear All
                </button>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className="px-4 py-2 bg-zinc-700 text-zinc-300 text-sm rounded hover:bg-zinc-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="text-red-400 text-xs hover:text-red-300"
              >
                Clear All History
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

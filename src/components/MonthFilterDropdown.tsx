import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Calendar } from 'lucide-react';

interface MonthFilterDropdownProps {
  selectedMonths: string[];
  onChange: (months: string[]) => void;
}

// Generate last 24 months list (current + 23 prior)
const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - i);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    options.push({ value, label: i === 0 ? `${label} (Current)` : label });
  }
  return options;
};

const MONTH_OPTIONS = generateMonthOptions();

// Current Financial Year months (April → current month)
const getCurrentFYMonths = (): string[] => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based
  const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;

  const months: string[] = [];
  for (let m = 4; m <= 12; m++) {
    const val = `${fyStartYear}-${String(m).padStart(2, '0')}`;
    if (MONTH_OPTIONS.some(o => o.value === val)) months.push(val);
  }
  for (let m = 1; m <= 3; m++) {
    const val = `${fyStartYear + 1}-${String(m).padStart(2, '0')}`;
    if (MONTH_OPTIONS.some(o => o.value === val)) months.push(val);
  }
  // Only include months up to and including current month
  return months.filter(val => val <= `${currentYear}-${String(currentMonth).padStart(2, '0')}`);
};

const getLastNMonths = (n: number): string[] => {
  return MONTH_OPTIONS.slice(0, n).map(o => o.value);
};

const MonthFilterDropdown: React.FC<MonthFilterDropdownProps> = ({ selectedMonths, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value: string) => {
    if (selectedMonths.includes(value)) {
      onChange(selectedMonths.filter(m => m !== value));
    } else {
      onChange([...selectedMonths, value]);
    }
  };

  const allMonthValues = MONTH_OPTIONS.map(o => o.value);

  // Compose display label
  let triggerLabel = '';
  if (selectedMonths.length === 0) {
    triggerLabel = 'All Months (Overall)';
  } else if (selectedMonths.length === 1) {
    triggerLabel = MONTH_OPTIONS.find(o => o.value === selectedMonths[0])?.label || selectedMonths[0];
  } else {
    triggerLabel = `${selectedMonths.length} Months Selected`;
  }

  return (
    <div ref={ref} className="relative" style={{ minWidth: 220 }}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md transition-all text-sm font-medium text-gray-700 w-full"
      >
        <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{triggerLabel}</span>
        {selectedMonths.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">
            {selectedMonths.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-72 overflow-hidden">

          {/* Quick Presets */}
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Select</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { onChange([]); setOpen(false); }}
                className="px-2 py-1.5 text-xs rounded-lg bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-700 font-medium transition-colors"
              >
                Overall (All)
              </button>
              <button
                onClick={() => { onChange([MONTH_OPTIONS[0].value]); setOpen(false); }}
                className="px-2 py-1.5 text-xs rounded-lg bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-700 font-medium transition-colors"
              >
                Current Month
              </button>
              <button
                onClick={() => { onChange(getLastNMonths(3)); setOpen(false); }}
                className="px-2 py-1.5 text-xs rounded-lg bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-700 font-medium transition-colors"
              >
                Last 3 Months
              </button>
              <button
                onClick={() => { onChange(getLastNMonths(6)); setOpen(false); }}
                className="px-2 py-1.5 text-xs rounded-lg bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-700 font-medium transition-colors"
              >
                Last 6 Months
              </button>
              <button
                onClick={() => { onChange(getCurrentFYMonths()); setOpen(false); }}
                className="col-span-2 px-2 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
              >
                Current Financial Year
              </button>
            </div>
          </div>

          {/* Select All / Clear All */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <button
              onClick={() => onChange(allMonthValues)}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Select All
            </button>
            <button
              onClick={() => onChange([])}
              className="text-xs text-red-500 hover:underline font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear All
            </button>
          </div>

          {/* Month Checkboxes */}
          <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
            {MONTH_OPTIONS.map(({ value, label }) => {
              const checked = selectedMonths.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => toggle(value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors ${checked ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className="flex-1 text-left">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {selectedMonths.length === 0 ? 'Showing all data' : `${selectedMonths.length} month(s) selected`}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthFilterDropdown;

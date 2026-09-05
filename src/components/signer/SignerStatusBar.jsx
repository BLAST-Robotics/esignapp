'use client';

export default function SignerStatusBar({ status, itemsLeft, allDone, onSelectField, onPrimary }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 safe-area-bottom transition-all duration-300"
      style={{ colorScheme: 'light' }}
    >
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
          {status.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => onSelectField(s.id)}
              className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap px-2.5 py-1.5 rounded-lg transition-all ${s.done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${s.done ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'}`}
              >
                {s.done ? '\u2713' : status.findIndex((x) => x.id === s.id) + 1}
              </span>
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap active:scale-[0.98] bg-blue-600/90 text-white hover:bg-blue-700 cursor-pointer`}
          onClick={onPrimary}
        >
          {allDone ? 'Review & Submit' : `${itemsLeft} field${itemsLeft !== 1 ? 's' : ''} remaining`}
        </button>
      </div>
    </div>
  );
}
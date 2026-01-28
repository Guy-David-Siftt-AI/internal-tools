"use client";

interface JsonInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export default function JsonInput({ value, onChange, onClear }: JsonInputProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Input (paste your JSON here)
        </label>
        <button
          onClick={onClear}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          Clear
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Paste your JSON here...

Examples of what can be fixed:
• {name: "test"} - unquoted keys
• {'name': 'test'} - single quotes
• {"name": "test",} - trailing commas
• // comments - JavaScript comments`}
        className="flex-1 w-full p-4 font-mono text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-zinc-400 dark:placeholder-zinc-500"
        spellCheck={false}
      />
    </div>
  );
}

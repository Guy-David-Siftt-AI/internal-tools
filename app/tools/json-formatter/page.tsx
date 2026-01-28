import JsonFormatter from "@/components/json-formatter/JsonFormatter";

export const metadata = {
  title: "JSON Formatter - Internal Tools",
  description: "Format, validate, and fix invalid JSON",
};

export default function JsonFormatterPage() {
  return (
    <div className="h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            JSON Formatter
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Paste your JSON to format, validate, and auto-fix common issues.
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <JsonFormatter />
        </div>
      </div>
    </div>
  );
}

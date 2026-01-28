import ToolCard from "@/components/ToolCard";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Internal Tools
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          A collection of useful development and productivity tools.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ToolCard
          title="JSON Formatter"
          description="Format, validate, and fix invalid JSON. Handles common issues like unquoted keys, trailing commas, and single quotes."
          href="/tools/json-formatter"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          }
        />
      </div>
    </div>
  );
}

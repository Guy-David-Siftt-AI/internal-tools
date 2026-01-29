import UnderwritingMapper from "@/components/underwriting-mapper/UnderwritingMapper";

export const metadata = {
  title: "Underwriting Mapper - Internal Tools",
  description: "Analyze Excel underwriting models and generate JSON mapping files",
};

export default function UnderwritingMapperPage() {
  return (
    <div className="h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Underwriting Mapper
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload an Excel underwriting model to automatically generate JSON mapping files.
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <UnderwritingMapper />
        </div>
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="relative h-9 w-9">
        <div className="absolute inset-0 rounded-full border-2 border-border" />
        <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    </div>
  );
}
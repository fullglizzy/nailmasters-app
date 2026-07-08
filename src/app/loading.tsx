export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      </div>
    </div>
  );
}

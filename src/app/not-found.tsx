import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="font-display text-8xl text-primary/20">
          404
        </div>
        <h1 className="font-display text-2xl">Страница не найдена</h1>
        <p className="text-muted-foreground">
          Запрашиваемая страница не существует или была перемещена.
        </p>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}

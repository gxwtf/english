import Link from 'next/link';

export function Footer() {
  return (
    <footer className="pb-safe px-safe bg-muted border-t border-gray-200 dark:border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <Link
            href="https://gxwtf.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            前往广坊主站
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            京ICP备2025107534号-1
          </Link>
        </div>
      </div>
    </footer>
  );
}

// Cabecera de cada módulo: queda fija arriba y acompaña al hacer scroll.
export function StickyHeader({
    maxW = 'max-w-7xl',
    children,
}: {
    maxW?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200">
            <div className={`${maxW} mx-auto px-4 sm:px-6 lg:px-8 py-4`}>{children}</div>
        </div>
    );
}

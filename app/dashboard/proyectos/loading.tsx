export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200" />
                    <div className="space-y-1.5">
                        <div className="h-5 w-28 bg-slate-200 rounded-lg" />
                        <div className="h-3 w-44 bg-slate-100 rounded-lg" />
                    </div>
                </div>
                <div className="h-9 w-36 bg-slate-200 rounded-xl" />
            </div>
            <div className="grid grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="border border-slate-100 rounded-2xl px-5 py-4 space-y-2">
                        <div className="h-7 w-10 bg-slate-200 rounded" />
                        <div className="h-3 w-20 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0">
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 w-48 bg-slate-200 rounded" />
                            <div className="h-3 w-32 bg-slate-100 rounded" />
                        </div>
                        <div className="h-5 w-20 bg-slate-100 rounded-full" />
                        <div className="h-4 w-24 bg-slate-100 rounded" />
                        <div className="h-4 w-24 bg-slate-100 rounded" />
                        <div className="w-8 h-8 rounded-full bg-slate-100" />
                    </div>
                ))}
            </div>
        </div>
    );
}

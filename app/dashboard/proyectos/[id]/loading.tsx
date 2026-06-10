export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4 animate-pulse">
            <div className="h-3 w-32 bg-slate-100 rounded" />
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                        <div className="h-6 w-64 bg-slate-200 rounded-lg" />
                        <div className="h-3 w-96 bg-slate-100 rounded-lg" />
                    </div>
                    <div className="h-7 w-28 bg-slate-100 rounded-xl" />
                </div>
                <div className="flex gap-6">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-3 w-28 bg-slate-100 rounded" />
                    ))}
                </div>
            </div>
            <div className="flex gap-2">
                <div className="h-10 w-28 bg-slate-100 rounded-2xl" />
                <div className="h-10 w-36 bg-slate-100 rounded-2xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="h-28 bg-slate-100 rounded-2xl" />
                <div className="h-28 bg-slate-100 rounded-2xl" />
            </div>
        </div>
    );
}

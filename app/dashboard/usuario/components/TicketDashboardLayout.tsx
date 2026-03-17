'use client';

interface Props {
    kpis: React.ReactNode;
    dataTable: React.ReactNode;
    charts?: React.ReactNode;
}

export default function TicketDashboardLayout({ kpis, dataTable, charts }: Props) {
    return (
        <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-8">

            {/* Row 1: KPI Cards */}
            <div>
                {kpis}
            </div>

            {/* Row 2: Ticket Data Table */}
            <div>
                {dataTable}
            </div>

            {/* Row 3: Charts */}
            {charts && (
                <div>
                    {charts}
                </div>
            )}
        </div>
    );
}

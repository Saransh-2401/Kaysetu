/**
 * Excel Export Service for Sales Manager Dashboard
 * Uses xlsx-js-style for full cell-level styling (bold, colors, borders)
 */

// @ts-ignore
import XLSXStyle from 'xlsx-js-style';

export interface ExportDateRange {
    startDate: string;
    endDate: string;
}

// ─── Theme Colors ─────────────────────────────────────────────────────────────
const PRIMARY = '1565C0';   // Dark Blue header
const PRIMARY_L = 'E3F2FD';   // Light Blue alt row
const ACCENT = 'FF8F00';   // Amber for subheadings
const WHITE = 'FFFFFF';
const GREY_BG = 'F5F5F5';
const GREY_TEXT = '616161';
const GREEN_BG = 'E8F5E9';
const RED_BG = 'FFEBEE';
const AMBER_BG = 'FFF8E1';

// ─── Style definitions ────────────────────────────────────────────────────────
const border = {
    top: { style: 'thin', color: { rgb: 'CFD8DC' } },
    bottom: { style: 'thin', color: { rgb: 'CFD8DC' } },
    left: { style: 'thin', color: { rgb: 'CFD8DC' } },
    right: { style: 'thin', color: { rgb: 'CFD8DC' } },
};

function hdr(text: string): any {
    return {
        v: text, t: 's',
        s: {
            font: { bold: true, color: { rgb: WHITE }, sz: 11 },
            fill: { fgColor: { rgb: PRIMARY } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border,
        },
    };
}

function subHdr(text: string): any {
    return {
        v: text, t: 's',
        s: {
            font: { bold: true, color: { rgb: WHITE }, sz: 11 },
            fill: { fgColor: { rgb: ACCENT } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border,
        },
    };
}

function title(text: string): any {
    return {
        v: text, t: 's',
        s: {
            font: { bold: true, sz: 14, color: { rgb: '1A237E' } },
            fill: { fgColor: { rgb: WHITE } },
            alignment: { horizontal: 'left', vertical: 'center' },
        },
    };
}

function cell(value: any, rowIdx: number, opts?: { bold?: boolean; color?: string; align?: string }): any {
    const isAlt = rowIdx % 2 === 0;
    return {
        v: value ?? '-', t: typeof value === 'number' ? 'n' : 's',
        s: {
            font: { sz: 10, bold: opts?.bold, color: { rgb: opts?.color || '212121' } },
            fill: { fgColor: { rgb: isAlt ? GREY_BG : WHITE } },
            alignment: { horizontal: opts?.align || 'left', vertical: 'center', wrapText: false },
            border,
        },
    };
}

function statusCell(value: string, rowIdx: number): any {
    const v = (value || '').toLowerCase();
    let bg = GREY_BG;
    let color = GREY_TEXT;
    if (['approved', 'fulfilled', 'won', 'paid', 'completed'].some(s => v.includes(s))) { bg = GREEN_BG; color = '2E7D32'; }
    else if (['pending', 'in_progress', 'active', 'partial'].some(s => v.includes(s))) { bg = AMBER_BG; color = 'E65100'; }
    else if (['rejected', 'cancelled', 'lost', 'overdue'].some(s => v.includes(s))) { bg = RED_BG; color = 'C62828'; }
    return {
        v: value || '-', t: 's',
        s: {
            font: { sz: 10, bold: true, color: { rgb: color } },
            fill: { fgColor: { rgb: rowIdx % 2 === 0 ? bg : WHITE } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border,
        },
    };
}

function numCell(value: number, rowIdx: number): any {
    return {
        v: value || 0, t: 'n',
        s: {
            font: { sz: 10, color: { rgb: '212121' } },
            fill: { fgColor: { rgb: rowIdx % 2 === 0 ? GREY_BG : WHITE } },
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: '#,##0.00',
            border,
        },
    };
}

function empty(): any {
    return { v: '', t: 's', s: { fill: { fgColor: { rgb: WHITE } } } };
}

function setColWidths(ws: any, widths: number[]) {
    ws['!cols'] = widths.map(w => ({ wch: w }));
}

function autoFitRows(ws: any, rowCount: number) {
    ws['!rows'] = [{ hpx: 30 }, { hpx: 22 }, ...Array(rowCount).fill({ hpx: 20 })];
}

function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Sheet Builders ───────────────────────────────────────────────────────────

function buildKPISheet(salesOverview: any, crmAnalytics: any, fieldSales: any, rangeLabel: string) {
    const rows: any[][] = [
        [title('Sales Manager Dashboard — KPI Summary'), empty(), empty()],
        [{ v: `Period: ${rangeLabel}`, t: 's', s: { font: { sz: 10, color: { rgb: GREY_TEXT }, italic: true }, fill: { fgColor: { rgb: WHITE } } } }, empty(), empty()],
        [empty(), empty(), empty()],
        [subHdr('SALES OVERVIEW'), subHdr(''), subHdr('')],
        [hdr('Metric'), hdr('Value'), hdr('Unit')],
        [cell('Total Revenue', 0), numCell(salesOverview?.total_sales?.total_amount || 0, 0), cell('₹', 0, { align: 'center' })],
        [cell('Total Orders', 1), cell(salesOverview?.total_sales?.count || 0, 1), cell('orders', 1, { align: 'center' })],
        [cell('Period Revenue', 0), numCell(salesOverview?.period_sales?.total_amount || 0, 0), cell('₹', 0, { align: 'center' })],
        [cell('Period Orders', 1), cell(salesOverview?.period_sales?.count || 0, 1), cell('orders', 1, { align: 'center' })],
        [empty(), empty(), empty()],
        [subHdr('CRM & PIPELINE'), subHdr(''), subHdr('')],
        [hdr('Metric'), hdr('Value'), hdr('Unit')],
        [cell('Total Leads', 0), cell(crmAnalytics?.leads_funnel?.total || 0, 0), cell('leads', 0, { align: 'center' })],
        [cell('Qualified Leads', 1), cell(crmAnalytics?.leads_funnel?.qualified || 0, 1), cell('leads', 1, { align: 'center' })],
        [cell('Converted Leads', 0), cell(crmAnalytics?.leads_funnel?.converted || 0, 0), cell('leads', 0, { align: 'center' })],
        [cell('Conversion Rate', 1), cell(`${crmAnalytics?.leads_funnel?.conversion_rate || 0}%`, 1), cell('%', 1, { align: 'center' })],
        [cell('Won Opportunities', 0), cell(crmAnalytics?.opportunities?.won || 0, 0), cell('deals', 0, { align: 'center' })],
        [cell('Win Rate', 1), cell(`${crmAnalytics?.opportunities?.win_rate || 0}%`, 1), cell('%', 1, { align: 'center' })],
        [cell('Pipeline Value', 0), numCell(crmAnalytics?.opportunities?.pipeline_value || 0, 0), cell('₹', 0, { align: 'center' })],
        [empty(), empty(), empty()],
        [subHdr('FIELD SALES'), subHdr(''), subHdr('')],
        [hdr('Metric'), hdr('Value'), hdr('Unit')],
        [cell('Total Visits', 0), cell(fieldSales?.overview?.total_visits || 0, 0), cell('visits', 0, { align: 'center' })],
        [cell('Completed Visits', 1), cell(fieldSales?.overview?.completed_visits || 0, 1), cell('visits', 1, { align: 'center' })],
        [cell('Completion Rate', 0), cell(`${fieldSales?.overview?.completion_rate || 0}%`, 0), cell('%', 0, { align: 'center' })],
    ];

    const ws: any = {};
    rows.forEach((row, r) => {
        row.forEach((c, col) => {
            const ref = XLSXStyle.utils.encode_cell({ r, c: col });
            ws[ref] = c;
        });
    });
    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 2 } });
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 2 } },
        { s: { r: 20, c: 0 }, e: { r: 20, c: 2 } },
    ];
    setColWidths(ws, [32, 20, 12]);
    autoFitRows(ws, rows.length);
    return ws;
}

function buildOrdersSheet(orders: any[]) {
    const headers = ['Order No.', 'Customer', 'Distributor', 'Agent', 'Order Date', 'Subtotal (₹)', 'Tax (₹)', 'Discount (₹)', 'Advance (₹)', 'Total (₹)', 'Fulfillment', 'Payment'];
    const ws: any = {};

    // Title row
    ws[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = title('Sales Orders Report');
    for (let c = 1; c < headers.length; c++) ws[XLSXStyle.utils.encode_cell({ r: 0, c })] = empty();

    // Header row
    headers.forEach((h, c) => { ws[XLSXStyle.utils.encode_cell({ r: 1, c })] = hdr(h); });

    // Data rows
    orders.forEach((o, idx) => {
        const r = idx + 2;
        const row = [
            cell(o.order_number, idx),
            cell(o.customer_name, idx),
            cell(o.distributor_name, idx),
            cell(o.assigned_agent_name, idx),
            cell(formatDate(o.order_date), idx, { align: 'center' }),
            numCell(o.subtotal || 0, idx),
            numCell(o.tax_amount || 0, idx),
            numCell(o.discount_amount || 0, idx),
            numCell(o.advance_amount || 0, idx),
            numCell(o.total || 0, idx),
            statusCell(o.fulfillment_status || '-', idx),
            statusCell(o.payment_status || '-', idx),
        ];
        row.forEach((c, col) => { ws[XLSXStyle.utils.encode_cell({ r, c: col })] = c; });
    });

    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: orders.length + 1, c: headers.length - 1 } });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    setColWidths(ws, [14, 20, 20, 18, 13, 14, 11, 13, 13, 14, 14, 14]);
    autoFitRows(ws, orders.length);
    return ws;
}

function buildRequestsSheet(requests: any[]) {
    const headers = ['Request No.', 'Distributor', 'Request Date', 'Items', 'Status', 'Payment Status'];
    const ws: any = {};
    ws[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = title('Distributor Stock Requests');
    for (let c = 1; c < headers.length; c++) ws[XLSXStyle.utils.encode_cell({ r: 0, c })] = empty();
    headers.forEach((h, c) => { ws[XLSXStyle.utils.encode_cell({ r: 1, c })] = hdr(h); });

    requests.forEach((req, idx) => {
        const r = idx + 2;
        const row = [
            cell(req.request_number, idx),
            cell(req.distributor_name, idx),
            cell(formatDate(req.request_date), idx, { align: 'center' }),
            cell(req.items?.length ?? 0, idx, { align: 'center' }),
            statusCell(req.status || '-', idx),
            statusCell(req.payment_status || '-', idx),
        ];
        row.forEach((c, col) => { ws[XLSXStyle.utils.encode_cell({ r, c: col })] = c; });
    });

    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: requests.length + 1, c: headers.length - 1 } });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    setColWidths(ws, [18, 24, 15, 8, 16, 16]);
    autoFitRows(ws, requests.length);
    return ws;
}

function buildLeaderboardSheet(agents: any[]) {
    const headers = ['Rank', 'Agent Name', 'Role', 'Revenue (₹)', 'Visits', 'Target (₹)', 'Progress (%)'];
    const ws: any = {};
    ws[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = title('Team Leaderboard');
    for (let c = 1; c < headers.length; c++) ws[XLSXStyle.utils.encode_cell({ r: 0, c })] = empty();
    headers.forEach((h, c) => { ws[XLSXStyle.utils.encode_cell({ r: 1, c })] = hdr(h); });

    agents.forEach((a, idx) => {
        const r = idx + 2;
        const prog = a.progress || 0;
        const progColor = prog >= 100 ? '2E7D32' : prog > 50 ? '1565C0' : 'E65100';
        const row = [
            cell(`#${idx + 1}`, idx, { bold: true, align: 'center' }),
            cell(a.name, idx, { bold: true }),
            cell(a.role, idx),
            numCell(a.sales || 0, idx),
            cell(a.visits ?? 0, idx, { align: 'center' }),
            numCell(a.target || 0, idx),
            cell(`${prog}%`, idx, { bold: true, color: progColor, align: 'center' }),
        ];
        row.forEach((c, col) => { ws[XLSXStyle.utils.encode_cell({ r, c: col })] = c; });
    });

    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: agents.length + 1, c: headers.length - 1 } });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    setColWidths(ws, [7, 24, 18, 16, 10, 16, 13]);
    autoFitRows(ws, agents.length);
    return ws;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function exportDashboardReport(
    salesOverview: any,
    crmAnalytics: any,
    fieldSalesAnalytics: any,
    recentOrders: any[],
    stockRequests: any[],
    dateRange: ExportDateRange
) {
    const rangeLabel = `${dateRange.startDate}  →  ${dateRange.endDate}`;
    const agents: any[] = fieldSalesAnalytics?.overview?.agent_performance || [];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, buildKPISheet(salesOverview, crmAnalytics, fieldSalesAnalytics, rangeLabel), '📊 KPI Summary');
    XLSXStyle.utils.book_append_sheet(wb, buildOrdersSheet(recentOrders), '📦 Sales Orders');
    XLSXStyle.utils.book_append_sheet(wb, buildRequestsSheet(stockRequests), '🏭 Stock Requests');
    XLSXStyle.utils.book_append_sheet(wb, buildLeaderboardSheet(agents), '🏆 Leaderboard');

    const fileName = `SalesReport_${dateRange.startDate}_to_${dateRange.endDate}.xlsx`;
    XLSXStyle.writeFile(wb, fileName);
}

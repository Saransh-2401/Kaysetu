import { apiClient, API_BASE_URL } from './api-client';
import { tokenManager } from './api-client';

export interface BOMItem {
    id?: number;
    raw_material: number;
    raw_material_name?: string;
    raw_material_code?: string;
    raw_material_unit?: string;
    quantity: number;
    rate?: number;
    amount?: number;
    raw_material_role: string;
    ratio_percentage: string;
    quantity_display: string;
    source_warehouse?: number;
}

export interface BOMOperation {
    id?: number;
    operation_name: string;
    workstation: number;
    workstation_name?: string;
    time_in_mins: number;
    operating_cost: number;
    description?: string;
}

export interface BillOfMaterials {
    id: number;
    bom_number: string;
    item: number;
    item_name?: string;
    quantity: number;
    is_active: boolean;
    is_default: boolean;
    total_material_cost: number;
    total_operation_cost: number;
    total_cost: number;
    description: string;
    raw_materials: BOMItem[];
    operations: BOMOperation[];
    created_at?: string;
    updated_at?: string;
}

export interface ProductionPlanItem {
    id?: number;
    item: number;
    item_name?: string;
    sales_order?: number;
    planned_qty: number;
    produced_qty?: number;
    priority: 'low' | 'medium' | 'high';
    work_order_progress?: number;
    work_order_id?: number;
}

export interface ExecutionLog {
    id: string;
    item_type: 'work_order' | 'job_card';
    timestamp: string;
    description: string;
    status: string;
    reference_no: string;
}

export interface ProductionPlan {
    id?: number;
    plan_number?: string;
    batch_no?: string;
    from_date: string;
    to_date: string;
    status?: string;
    stock_status?: string;
    source?: string;
    progress?: number;
    items?: ProductionPlanItem[];
    has_material_requests?: boolean;
    sales_order_numbers?: string[];
    stock_request_numbers?: string[];
    execution_logs?: ExecutionLog[];
}

export interface MaterialCheckResult {
    item_id: number;
    item_name: string;
    item_code: string;
    qty_needed: number;
    available_qty: number;
    shortage: number;
    is_available: boolean;
    uom: string;
}

export interface WorkOrder {
    id: number;
    work_order_number: string;
    production_plan?: number | null;
    plan_number?: string;
    item: number;
    item_name: string;
    bom: number;
    bom_number: string;
    quantity_to_produce: number;
    produced_quantity: number;
    source_warehouse: number;
    target_warehouse: number;
    planned_start_date: string;
    actual_start_date?: string;
    expected_delivery_date: string;
    status: string;
    priority: string;
    completion_percentage?: number;
    job_cards?: JobCard[];
    execution_logs?: ExecutionLog[];
    created_at?: string;
    updated_at?: string;
}

export interface JobCard {
    id: number;
    job_card_number: string;
    work_order: number;
    work_order_number: string;
    operation: number;
    operation_name: string;
    workstation: number;
    workstation_name: string;
    assigned_to?: number;
    assigned_to_name?: string;
    start_time?: string;
    end_time?: string;
    for_quantity: number;
    completed_quantity: number;
    status: string;
    remarks?: string;
}

export const productionService = {
    // ===== Bill Of Materials =====
    async getBOMs(params?: Record<string, any>) {
        return apiClient.get<{ results: BillOfMaterials[] }>('/t/prod/bom/', params);
    },

    async getBOM(id: number) {
        return apiClient.get<BillOfMaterials>(`/t/prod/bom/${id}/`);
    },

    async createBOM(data: Partial<BillOfMaterials>) {
        return apiClient.post<BillOfMaterials>('/t/prod/bom/', data);
    },

    async updateBOM(id: number, data: Partial<BillOfMaterials>) {
        return apiClient.patch<BillOfMaterials>(`/t/prod/bom/${id}/`, data);
    },

    async deleteBOM(id: number) {
        return apiClient.delete(`/t/prod/bom/${id}/`);
    },

    // ===== Workstations =====
    async getWorkstations(params?: Record<string, any>) {
        return apiClient.get<{ results: any[] }>('/t/prod/workstations/', params);
    },

    // ===== Production Plans =====
    async getProductionPlans(params?: Record<string, any>) {
        return apiClient.get<{ results: ProductionPlan[] }>('/t/prod/plans/', params);
    },

    async getProductionPlan(id: number | string) {
        return apiClient.get<ProductionPlan>(`/t/prod/plans/${id}/`);
    },

    async createProductionPlan(data: Partial<ProductionPlan>) {
        return apiClient.post<ProductionPlan>('/t/prod/plans/', data);
    },

    async checkMaterialAvailability(items: { item_id: number, quantity: number }[]) {
        return apiClient.post<MaterialCheckResult[]>('/t/prod/plans/check_material_availability/', { items });
    },

    async startProduction(id: number) {
        return apiClient.post<{ message: string, plan_status: string }>(`/t/prod/plans/${id}/start_production/`, {});
    },

    async stopProduction(id: number) {
        return apiClient.post<{ message: string, plan_status: string }>(`/t/prod/plans/${id}/stop_production/`, {});
    },

    async updatePlan(id: number, data: Partial<ProductionPlan>) {
        return apiClient.patch<ProductionPlan>(`/t/prod/plans/${id}/`, data);
    },

    // ===== Work Orders =====
    async getWorkOrders(params?: Record<string, any>) {
        return apiClient.get<{ results: WorkOrder[] }>('/t/prod/work-orders/', params);
    },

    // ===== Job Cards =====
    async getJobCards(params?: Record<string, any>) {
        return apiClient.get<{ results: JobCard[] }>('/t/prod/job-cards/', params);
    },

    async completeJobCard(id: number, quantity?: number) {
        return apiClient.post<{ message: string }>(`/t/prod/job-cards/${id}/complete/`, { quantity });
    },

    async printJobCard(id: number) {
        const token = tokenManager.getAccessToken();
        const response = await fetch(`${API_BASE_URL}/production/work-orders/${id}/print_job_card/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error("Failed to download PDF");
        return response.blob();
    },
};

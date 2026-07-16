import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDRFError(error: any): string {
  if (!error) return "An unknown error occurred.";

  // If it's our custom APIError or a standard Error, try to get details
  if (error instanceof Error) {
    const apiError = error as any;
    if (apiError.details) {
      return formatDRFError(apiError.details);
    }
    return error.message;
  }

  if (typeof error === 'string') return error;

  if (Array.isArray(error)) {
    return error.map(item => formatDRFError(item)).join(', ');
  }

  if (typeof error === 'object' && error !== null) {
    // 1. Support for project-specific structure { success: false, error: { message, details } }
    if (error.success === false && error.error && typeof error.error === 'object') {
      return formatDRFError(error.error);
    }

    // 2. Look for explicit message fields first
    const priorityKeys = ['message', 'detail', 'error', 'non_field_errors'];
    for (const key of priorityKeys) {
      const val = error[key];
      if (val) {
        if (typeof val === 'string') {
          // Clean up Python-style ErrorDetail if it still exists
          if (val.includes('ErrorDetail(')) {
            return val.replace(/^ErrorDetail\(string=['"](.*)['"], code=['"].*['"]\)$/, '$1');
          }
          return val;
        }
        if (Array.isArray(val)) return formatDRFError(val);
        if (typeof val === 'object') {
          // If the nested object has a 'message' or 'string' property, use it
          if (val.string && typeof val.string === 'string') return val.string;
          if (val.message && typeof val.message === 'string') return val.message;
          // If the nested object is an error detail object
          if (val.error && typeof val.error === 'string') return val.error;
          return formatDRFError(val);
        }
      }
    }

    // 2. Aggregation fallback for field-specific errors
    // Filter out metadata keys like IDs, dates, codes which shouldn't be in a user toast
    const metadataKeys = ['code', 'status', 'existing_visit_id', 'existing_visit_date', 'existing_visit_time', 'id'];

    const messages = Object.entries(error)
      .filter(([key]) => !metadataKeys.includes(key))
      .map(([key, value]) => {
        let valStr = '';
        if (typeof value === 'string') {
          valStr = value;
        } else if (Array.isArray(value)) {
          valStr = value.join(', ');
        } else if (typeof value === 'object' && value !== null) {
          // Handle cases where the value is an object (common in complex DRF errors)
          const obj = value as any;
          valStr = obj.string || obj.message || JSON.stringify(obj);
        } else {
          valStr = String(value);
        }

        // Clean up common Python-style string representations if they leaked through
        valStr = valStr.replace(/^ErrorDetail\(string=['"](.*)['"], code=['"].*['"]\)$/, '$1');

        if (key === 'non_field_errors' || key === 'detail' || key === 'error' || key === 'message') {
          return valStr;
        }

        // Convert snake_case key to Title Case for better readability
        const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return `${label}: ${valStr}`;
      });

    if (messages.length > 0) {
      // If we have multiple messages, and one of them is highly likely the primary one, prefer it
      if (messages.length > 1) {
        // This is a heuristic: if we have "message" and others, just return "message"
        // (Wait, the loop above already takes care of priority keys, so we only get here if they weren't in priorityKeys)
      }
      return messages.join(' | ');
    }
  }

  return String(error);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return String(date);
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(date);
  }
}

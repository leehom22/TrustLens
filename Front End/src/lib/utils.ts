import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Helper for Badge Colors (History Pages)---
export const getRiskColor = (level: string) => {
  switch (level) {
    case 'High': return 'bg-red-50 text-red-600 border-red-100';
    case 'Medium': return 'bg-yellow-50 text-yellow-600 border-yellow-100';
    case 'Low': return 'bg-green-50 text-green-600 border-green-100';
    default: return 'bg-gray-50 text-gray-600';
  }
};

export const formatDateTime = (timestamp: string | undefined | null) => {
  if (!timestamp) return "N/A";

  const date = new Date(timestamp);

  // Check if the date is actually valid to prevent "Invalid Date" errors
  if (isNaN(date.getTime())) return "Invalid Date";

  return date.toLocaleString('en-US', {
    month: 'short',    // "Feb"
    day: 'numeric',    // "8"
    year: 'numeric',   // "2026"
    hour: 'numeric',   // "5"
    minute: '2-digit', // "39"
    hour12: true       // AM/PM format
  });
};
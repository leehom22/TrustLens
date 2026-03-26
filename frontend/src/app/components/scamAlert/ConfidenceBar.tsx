import {  RISK_CONFIG } from "@/lib/scamAlert";

const ConfidenceBar = ({ value, riskLevel }: { value: number; riskLevel: RiskLevel }) => {
    const config = RISK_CONFIG[riskLevel];
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${config?.bar}`}
                    style={{ width: `${value}%` }}
                />
            </div>
            <span className="text-xs font-semibold text-gray-700 w-8 text-right">{value}</span>
        </div>
    );
}

export default ConfidenceBar
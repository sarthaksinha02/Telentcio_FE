import { Loader2 } from "lucide-react";

export default function Loader({ size = "medium", className = "" }) {
    const sizeClasses = {
        small: "w-4 h-4",
        medium: "w-8 h-8",
        large: "w-12 h-12",
    };

    return (
        <div className={`flex justify-center items-center ${className}`}>
            <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size] || sizeClasses.medium}`} />
        </div>
    );
}

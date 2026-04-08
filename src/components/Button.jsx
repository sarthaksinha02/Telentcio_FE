import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const MotionButton = motion.button;

const Button = ({
    children,
    isLoading = false,
    variant = 'primary',
    className = '',
    disabled,
    type = 'button',
    ...props
}) => {
    const baseStyles = "relative flex items-center justify-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed";

    const variants = {
        primary: "text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 shadow-lg shadow-blue-500/30",
        secondary: "text-blue-600 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500 border border-transparent",
        outline: "text-slate-700 bg-transparent border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 focus:ring-slate-500",
        danger: "text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-lg shadow-red-500/30",
        success: "text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 shadow-lg shadow-emerald-500/30",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
    };

    const [internalLoading, setInternalLoading] = React.useState(false);

    const handleClick = async (e) => {
        if (disabled || isLoading || internalLoading) return;

        if (props.onClick) {
            const result = props.onClick(e);
            if (result instanceof Promise) {
                setInternalLoading(true);
                try {
                    await result;
                } finally {
                    setInternalLoading(false);
                }
            }
        }
    };

    const isEffectiveLoading = isLoading || internalLoading;

    return (
        <MotionButton
            whileHover={{ scale: disabled || isEffectiveLoading ? 1 : 1.01 }}
            whileTap={{ scale: disabled || isEffectiveLoading ? 1 : 0.99 }}
            type={type}
            disabled={disabled || isEffectiveLoading}
            className={`${baseStyles} ${variants[variant] || variants.primary} ${className}`}
            onClick={handleClick}
            {...props}
        >
            {isEffectiveLoading && (
                <Loader2 className="absolute h-5 w-5 animate-spin" />
            )}
            <span className={`flex items-center gap-2 ${isEffectiveLoading ? 'opacity-0' : 'opacity-100'}`}>
                {children}
            </span>
        </MotionButton>
    );
};

export default Button;

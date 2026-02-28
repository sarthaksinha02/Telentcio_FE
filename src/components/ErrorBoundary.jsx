import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        const isChunkLoadError =
            error?.name === 'ChunkLoadError' ||
            error?.message?.includes('Failed to fetch dynamically imported module');

        if (isChunkLoadError && import.meta.env.PROD) {
            // Prevent infinite reload loops in production
            const reloadCount = parseInt(sessionStorage.getItem('chunk-reload-count') || '0', 10);
            if (reloadCount < 2) {
                sessionStorage.setItem('chunk-reload-count', (reloadCount + 1).toString());
                window.location.reload();
            }
        }
    }

    render() {
        if (this.state.hasError) {
            const isChunkLoadError =
                this.state.error?.name === 'ChunkLoadError' ||
                this.state.error?.message?.includes('Failed to fetch dynamically imported module');

            // In local development, re-throw the dynamic import error so Vite's
            // native Error Overlay handles it naturally without breaking HMR or showing our fallback UI.
            if (isChunkLoadError && !import.meta.env.PROD) {
                throw this.state.error;
            }

            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">A new version is available</h2>
                    <p className="text-slate-600 mb-6 text-center max-w-md">
                        We've just released an update! Please refresh the page to load the latest application version.
                    </p>
                    <button
                        onClick={() => {
                            sessionStorage.removeItem('chunk-reload-count');
                            window.location.reload();
                        }}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                    >
                        Refresh Now
                    </button>
                </div>
            );
        }

        // Reset reload count if successful
        sessionStorage.removeItem('chunk-reload-count');
        return this.props.children;
    }
}

export default ErrorBoundary;

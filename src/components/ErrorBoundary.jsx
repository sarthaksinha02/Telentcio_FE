import React from 'react';

// ErrorBoundary only shows a fallback UI in production.
// In development, all errors bubble up normally so Vite's error overlay works as expected.
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, isChunkLoadError: false };
    }

    static getDerivedStateFromError(error) {
        const isChunkLoad =
            error?.name === 'ChunkLoadError' ||
            error?.message?.includes('Failed to fetch dynamically imported module');

        // Only activate the boundary in production to avoid interfering with Vite HMR
        if (!import.meta.env.PROD) {
            return {}; // do nothing in development — let Vite handle it
        }

        return { hasError: true, isChunkLoadError: isChunkLoad };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);

        const isChunkLoad =
            error?.name === 'ChunkLoadError' ||
            error?.message?.includes('Failed to fetch dynamically imported module');

        if (isChunkLoad && import.meta.env.PROD) {
            const reloadCount = parseInt(sessionStorage.getItem('chunk-reload-count') || '0', 10);
            if (reloadCount < 2) {
                sessionStorage.setItem('chunk-reload-count', (reloadCount + 1).toString());
                window.location.reload();
            }
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.state.isChunkLoadError) {
                return (
                    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">A new version is available</h2>
                        <p className="text-slate-600 mb-6 text-center max-w-md">
                            We've just released an update. Please refresh the page to continue.
                        </p>
                        <button
                            onClick={() => { sessionStorage.removeItem('chunk-reload-count'); window.location.reload(); }}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                        >
                            Refresh Now
                        </button>
                    </div>
                );
            }
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
                    <p className="text-slate-600 mb-6 text-center max-w-md">
                        An unexpected error occurred. Try refreshing or returning to the dashboard.
                    </p>
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition"
                    >
                        Go to Dashboard
                    </button>
                </div>
            );
        }

        sessionStorage.removeItem('chunk-reload-count');
        return this.props.children;
    }
}

export default ErrorBoundary;

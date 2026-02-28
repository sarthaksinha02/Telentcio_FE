import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        const isChunkLoadError =
            error?.name === 'ChunkLoadError' ||
            error?.message?.includes('Failed to fetch dynamically imported module');

        if (isChunkLoadError) {
            // Prevent infinite reload loops
            const reloadCount = parseInt(sessionStorage.getItem('chunk-reload-count') || '0', 10);
            if (reloadCount < 2) {
                sessionStorage.setItem('chunk-reload-count', (reloadCount + 1).toString());
                window.location.reload();
            }
        }
    }

    render() {
        if (this.state.hasError) {
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

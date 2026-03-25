import React from 'react';
import { ShieldAlert } from 'lucide-react';

const InvalidWorkspace = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8 space-y-6 animate-fade-in-up">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Workspace Not Found</h1>
                    <p className="text-slate-500">
                        The workspace URL you are trying to access does not exist or has been suspended.
                    </p>
                </div>
                <div className="pt-6 border-t border-slate-100">
                    <p className="text-sm text-slate-400">
                        Please check the URL or contact your administrator for assistance.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InvalidWorkspace;

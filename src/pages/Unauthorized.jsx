import React from 'react';
import { ShieldAlert, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full rounded-lg shadow-xl p-8 text-center space-y-6">
                <div className="flex justify-center">
                    <div className="h-24 w-24 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                        <ShieldAlert size={48} />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-slate-800">Unauthorized Access</h1>
                <p className="text-slate-500">
                    You do not have permission to view this page. If you believe this is an error, please contact your administrator.
                </p>

                <div className="pt-4">
                    <Link to="/" className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                        <Home size={18} />
                        <span>Return to Dashboard</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;

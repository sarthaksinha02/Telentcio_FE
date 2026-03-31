import React, { useState, useRef, useCallback } from 'react';
import * as ExcelJS from 'exceljs';
import { X, Upload, FileText, CheckCircle, XCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const BulkCandidateImport = ({ hiringRequestId, isOpen, onClose, onImportSuccess }) => {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
    const [importResults, setImportResults] = useState(null);
    const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'preview', 'summary'
    
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
            processFile(droppedFile);
        } else {
            toast.error('Please upload a valid Excel file (.xlsx or .xls)');
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const extractNumeric = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val !== 'string') return 0;
        const matches = val.match(/(\d+(\.\d+)?)/);
        return matches ? parseFloat(matches[1]) : 0;
    };

    const mapSource = (source) => {
        if (!source) return 'Other';
        const s = source.toLowerCase().trim();
        if (s.includes('naukri')) return 'Job Portal';
        if (s.includes('referral')) return 'Referral';
        if (s.includes('linkedin')) return 'LinkedIn';
        if (s.includes('consultancy')) return 'Consultancy';
        if (s.includes('internal')) return 'Internal Database';
        return 'Other';
    };

    const mapStatus = (round1) => {
        if (!round1) return 'Interested';
        const r = round1.toLowerCase().trim();
        if (r.includes('not interested')) return 'Not Interested';
        if (r.includes('not relevant')) return 'Not Relevant';
        if (r.includes('interested')) return 'Interested';
        return 'Interested';
    };

    const processFile = async (file) => {
        setIsParsing(true);
        setFile(file);
        try {
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new Error('No worksheets found in the Excel file');
            }
            
            const rows = [];
            const row1 = worksheet.getRow(1);
            const headers = {};
            row1.eachCell((cell, colNumber) => {
                const val = cell.value?.toString().toLowerCase().trim();
                if (val) headers[val] = colNumber;
            });

            // Improved Column Mapping (Case-insensitive)
            const columnMapping = {
                candidateName: ['name', 'candidate name', 'full name', 'name of candidate', 'candidate'],
                email: ['email', 'email id', 'email address', 'email id'],
                mobile: ['mobile no.', 'mobile', 'phone', 'contact', 'mobile no', 'mobile number'],
                qualification: ['qualification', 'degree', 'education', 'qual'],
                currentLocation: ['current location', 'location', 'city'],
                preferredLocation: ['preferred location', 'pref location'],
                source: ['source', 'recruitment source'],
                profilePulledBy: ['profile pulled by', 'sourcing recruiter', 'pulled by'],
                calledBy: ['calling by', 'called by'],
                rate: ['rate', 'billing rate'],
                totalExperience: ['total experience', 'experience', 'exp', 'relevant expe'],
                currentCompany: ['company', 'current company', 'organization'],
                currentCTC: ['cctc', 'current ctc', 'ctc'],
                expectedCTC: ['ectc', 'expected ctc', 'exp ctc'],
                noticePeriod: ['notice period', 'np'],
                tatToJoin: ['tat', 'tat to join'],
                inHandOffer: ['any offer in hand', 'offer in hand', 'counter offer'],
                status: ['round 1', 'status', 'initial status'],
                remark: ['remarks', 'remark', 'comments']
            };

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip headers

                const getCellValue = (keys) => {
                    // 1. Try exact matches first
                    for (const key of keys) {
                        const colIndex = headers[key];
                        if (colIndex) {
                            const cell = row.getCell(colIndex);
                            const val = cell.value;
                            if (val === null || val === undefined) continue;
                            if (typeof val === 'object') {
                                return val.result || val.text || val.richText?.[0]?.text || null;
                            }
                            return val;
                        }
                    }
                    
                    // 2. Fallback for Name: look for any header containing 'name' but not other specific things
                    if (keys.includes('name')) {
                        const nameHeader = Object.keys(headers).find(h => 
                            (h.includes('name') && !h.includes('company') && !h.includes('referral') && !h.includes('profile'))
                        );
                        if (nameHeader) {
                            const colIndex = headers[nameHeader];
                            const cell = row.getCell(colIndex);
                            return cell.value && typeof cell.value === 'object' ? (cell.value.result || cell.value.text || null) : cell.value;
                        }
                    }
                    return null;
                };

                const mappedRow = {
                    candidateName: getCellValue(columnMapping.candidateName),
                    email: getCellValue(columnMapping.email),
                    mobile: getCellValue(columnMapping.mobile)?.toString(),
                    qualification: getCellValue(columnMapping.qualification),
                    currentLocation: getCellValue(columnMapping.currentLocation),
                    preferredLocation: getCellValue(columnMapping.preferredLocation),
                    source: mapSource(getCellValue(columnMapping.source)),
                    profilePulledBy: getCellValue(columnMapping.profilePulledBy),
                    calledBy: getCellValue(columnMapping.calledBy),
                    rate: extractNumeric(getCellValue(columnMapping.rate)),
                    totalExperience: extractNumeric(getCellValue(columnMapping.totalExperience)),
                    currentCompany: getCellValue(columnMapping.currentCompany),
                    currentCTC: extractNumeric(getCellValue(columnMapping.currentCTC)),
                    expectedCTC: extractNumeric(getCellValue(columnMapping.expectedCTC)),
                    noticePeriod: extractNumeric(getCellValue(columnMapping.noticePeriod)),
                    tatToJoin: extractNumeric(getCellValue(columnMapping.tatToJoin)),
                    inHandOffer: getCellValue(columnMapping.inHandOffer)?.toString().toLowerCase() === 'yes',
                    status: mapStatus(getCellValue(columnMapping.status)),
                    remark: getCellValue(columnMapping.remark),
                    hiringRequestId: hiringRequestId,
                    resumeUrl: 'bulk-imported-placeholder',
                    resumePublicId: 'bulk-imported-placeholder'
                };

                // Basic Validation
                const errors = [];
                if (!mappedRow.candidateName) errors.push('Name missing');
                if (!mappedRow.email) errors.push('Email missing');
                else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mappedRow.email)) errors.push('Invalid Email');
                if (!mappedRow.mobile) errors.push('Mobile missing');
                if (mappedRow.totalExperience === 0 && !getCellValue(columnMapping.totalExperience)) errors.push('Experience missing');

                rows.push({
                    data: mappedRow,
                    isValid: errors.length === 0,
                    errors: errors,
                    rowNumber: rowNumber
                });
            });

            setPreviewData(rows);
            setActiveTab('preview');
        } catch (error) {
            console.error('Error parsing Excel:', error);
            toast.error('Failed to parse Excel file. Please ensure it is a valid .xlsx file.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleImportAll = async () => {
        const validRows = previewData.filter(row => row.isValid);
        if (validRows.length === 0) {
            toast.error('No valid rows to import');
            return;
        }

        setImporting(true);
        setProgress({ current: 0, total: validRows.length, success: 0, failed: 0 });
        
        const results = { imported: [], failed: [] };

        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            try {
                // Add a small 100ms delay between requests to prevent blocking the event loop
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                await api.post('/ta/candidates', row.data);
                results.imported.push(row);
                setProgress(prev => ({ ...prev, current: i + 1, success: prev.success + 1 }));
            } catch (error) {
                console.error(`Failed to import row ${row.rowNumber}:`, error);
                results.failed.push({
                    ...row,
                    apiError: error.response?.data?.message || 'Server error'
                });
                setProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }));
            }
        }

        setImportResults(results);
        setImporting(false);
        setActiveTab('summary');
        if (results.imported.length > 0) {
            onImportSuccess();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Bulk Import Candidates</h2>
                        <p className="text-sm text-slate-500">Import multiple candidates from an Excel sheet</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'upload' && (
                        <div 
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 p-12 transition-all hover:border-blue-400 hover:bg-blue-50/30 group"
                        >
                            <div className="p-6 bg-white rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Upload size={48} className="text-blue-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Drag and drop your Excel file here</h3>
                            <p className="text-slate-500 text-center mb-8 max-w-sm">
                                Support .xlsx and .xls files. Make sure headers match the required structure.
                            </p>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".xlsx, .xls"
                                className="hidden"
                            />
                            
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isParsing}
                                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {isParsing ? <Loader className="animate-spin" size={20} /> : <FileText size={20} />}
                                {isParsing ? 'Parsing File...' : 'Browse Files'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex gap-4">
                                    <div className="text-sm">
                                        <span className="text-slate-500">Total Rows:</span>
                                        <span className="ml-2 font-bold text-slate-800">{previewData.length}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-slate-500">Valid:</span>
                                        <span className="ml-2 font-bold text-green-600">{previewData.filter(r => r.isValid).length}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-slate-500">Invalid:</span>
                                        <span className="ml-2 font-bold text-red-600">{previewData.filter(r => !r.isValid).length}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setActiveTab('upload')}
                                        className="px-4 py-2 text-slate-600 font-bold hover:bg-white rounded-lg transition-colors"
                                    >
                                        Change File
                                    </button>
                                    <button 
                                        onClick={handleImportAll}
                                        disabled={importing || previewData.filter(r => r.isValid).length === 0}
                                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all shadow-md"
                                    >
                                        {importing ? <Loader className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                        Import Valid Rows
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto max-h-[50vh]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-100 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Row</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Candidate Name</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Mobile</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Experience</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewData.map((row, idx) => (
                                                <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{row.rowNumber}</td>
                                                    <td className="px-4 py-3">
                                                        {row.isValid ? (
                                                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full w-fit">
                                                                <CheckCircle size={12} /> Ready
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full w-fit">
                                                                    <AlertCircle size={12} /> Invalid
                                                                </span>
                                                                <span className="text-[10px] text-red-500 leading-tight">{row.errors.join(', ')}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.data.candidateName || <span className="text-red-400 italic">Missing</span>}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{row.data.email || <span className="text-red-400 italic">Missing</span>}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{row.data.mobile || <span className="text-red-400 italic">Missing</span>}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{row.data.totalExperience} yrs</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'summary' && importResults && (
                        <div className="space-y-6 py-8 flex flex-col items-center">
                            <div className="p-6 bg-emerald-50 rounded-full mb-2">
                                <CheckCircle size={64} className="text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800">Import Completed!</h3>
                            
                            <div className="grid grid-cols-2 gap-8 w-full max-w-md">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center">
                                    <div className="text-4xl font-black text-green-600 mb-1">{importResults.imported.length}</div>
                                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Imported</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center">
                                    <div className="text-4xl font-black text-red-600 mb-1">{importResults.failed.length}</div>
                                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Failed</div>
                                </div>
                            </div>

                            {importResults.failed.length > 0 && (
                                <div className="w-full mt-4">
                                    <h4 className="font-bold text-slate-700 mb-2">Failed Rows Detail</h4>
                                    <div className="border border-red-100 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-red-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-xs font-bold text-red-600 uppercase">Row</th>
                                                    <th className="px-4 py-2 text-xs font-bold text-red-600 uppercase">Candidate</th>
                                                    <th className="px-4 py-2 text-xs font-bold text-red-600 uppercase">Error Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-50">
                                                {importResults.failed.map((fail, idx) => (
                                                    <tr key={idx} className="text-sm">
                                                        <td className="px-4 py-2 font-medium text-slate-600">{fail.rowNumber}</td>
                                                        <td className="px-4 py-2 text-slate-600">{fail.data.candidateName}</td>
                                                        <td className="px-4 py-2 text-red-500 font-medium">{fail.apiError}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={onClose}
                                className="mt-8 flex items-center gap-2 px-10 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg"
                            >
                                Done & Close
                            </button>
                        </div>
                    )}
                </div>

                {/* Progress Bar (Visible only when importing) */}
                {importing && (
                    <div className="px-6 py-4 bg-slate-100 border-t border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-slate-700">Importing Data...</span>
                            <span className="text-sm font-bold text-blue-600">{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                        <div className="flex gap-4 mt-2">
                            <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                <CheckCircle size={12} /> {progress.success} Successful
                            </span>
                            <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                                <XCircle size={12} /> {progress.failed} Failed
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkCandidateImport;

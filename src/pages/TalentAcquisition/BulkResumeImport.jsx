import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, XCircle, AlertCircle, Loader, ArrowRight, FileArchive, Settings } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import JSZip from 'jszip';

const BulkResumeImport = ({ hiringRequestId, isOpen, onClose, onImportSuccess }) => {
    const fileInputRef = useRef(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    
    const [filesQueue, setFilesQueue] = useState([]); // Raw files waiting to be parsed
    const [parsedData, setParsedData] = useState([]); // Results from parsing
    const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'review', 'summary'
    
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
    const [existingCandidates, setExistingCandidates] = useState([]);

    useEffect(() => {
        if (isOpen && hiringRequestId) {
            const fetchExisting = async () => {
                try {
                    const response = await api.get(`/ta/candidates/${hiringRequestId}`);
                    if (Array.isArray(response.data?.candidates)) {
                        setExistingCandidates(response.data.candidates);
                    } else if (Array.isArray(response.data)) {
                        setExistingCandidates(response.data);
                    }
                } catch (error) {
                    console.error('Error fetching existing candidates:', error);
                }
            };
            fetchExisting();
        }
    }, [isOpen, hiringRequestId]);

    const checkIsExisting = (email, mobile) => {
        if (!email && !mobile) return false;
        return existingCandidates.some(c => 
            (email && c.email?.toLowerCase() === email.toLowerCase().trim()) || 
            (mobile && c.mobile?.trim() === (typeof mobile === 'string' ? mobile.trim() : mobile))
        );
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            processSelectedFiles(files);
        }
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            processSelectedFiles(files);
        }
        // clear input so same file can be selected again
        e.target.value = null;
    };

    const processSelectedFiles = async (files) => {
        setIsExtracting(true);
        let extractedFiles = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.name.endsWith('.zip')) {
                    const zip = new JSZip();
                    const contents = await zip.loadAsync(file);
                    
                    const zipPromises = [];
                    contents.forEach((relativePath, zipEntry) => {
                        if (!zipEntry.dir && (relativePath.endsWith('.pdf') || relativePath.endsWith('.docx') || relativePath.endsWith('.doc'))) {
                            zipPromises.push(
                                zipEntry.async('blob').then(blob => {
                                    // Extract filename from path
                                    const fileName = relativePath.split('/').pop();
                                    return new File([blob], fileName, { type: relativePath.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                                })
                            );
                        }
                    });
                    const unzippedFiles = await Promise.all(zipPromises);
                    extractedFiles = [...extractedFiles, ...unzippedFiles];
                } else if (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
                    extractedFiles.push(file);
                } else {
                    toast.error(`Ignored unsupported file: ${file.name}`);
                }
            }
            
            if (extractedFiles.length > 0) {
                setFilesQueue(extractedFiles);
                await startParsing(extractedFiles);
            } else {
                toast.error('No supported resumes found.');
            }
        } catch (error) {
            console.error('Extraction error:', error);
            toast.error('Failed to extract files. Ensure ZIP is not currupted.');
        } finally {
            setIsExtracting(false);
        }
    };

    const startParsing = async (filesToParse) => {
        setActiveTab('review');
        setIsParsing(true);
        setProgress({ current: 0, total: filesToParse.length, success: 0, failed: 0 });
        
        let newParsedData = [];

        for (let i = 0; i < filesToParse.length; i++) {
            const file = filesToParse[i];
            try {
                const formData = new FormData();
                formData.append('resume', file);
                
                const response = await api.post('/ta/candidates/parse-resume', formData);
                
                if (response.data && response.data.data) {
                    const extracted = response.data.data;
                    newParsedData.push({
                        id: `temp_${Date.now()}_${i}`,
                        file: file,
                        fileName: file.name,
                        candidateName: extracted.candidateName || '',
                        email: extracted.email || '',
                        mobile: extracted.mobile || '',
                        totalExperience: extracted.totalExperience || '',
                        niceToHaveSkills: extracted.niceToHaveSkills || [],
                        isValid: !!(extracted.candidateName && extracted.email && extracted.mobile),
                        isExisting: checkIsExisting(extracted.email, extracted.mobile),
                        importStatus: 'pending' // pending, success, failed
                    });
                    setProgress(p => ({ ...p, current: i + 1, success: p.success + 1 }));
                } else {
                    throw new Error('Invalid response');
                }
            } catch (error) {
                console.error(`Error parsing ${file.name}:`, error);
                // Even if parsing fails, we add it to the list so user can manually enter data
                newParsedData.push({
                     id: `temp_${Date.now()}_${i}`,
                     file: file,
                     fileName: file.name,
                     candidateName: '',
                     email: '',
                     mobile: '',
                     totalExperience: '',
                     niceToHaveSkills: [],
                     isValid: false,
                     isExisting: false,
                     importStatus: 'pending',
                     error: 'Parsing Failed'
                });
                setProgress(p => ({ ...p, current: i + 1, failed: p.failed + 1 }));
            }
        }
        
        setParsedData(newParsedData);
        setIsParsing(false);
    };

    const handleDataChange = (index, field, value) => {
        setParsedData(prev => prev.map((row, i) => {
            if (i !== index) return row;
            
            const updatedRow = { 
                ...row, 
                [field]: value,
                // Reset status to pending so user can retry after editing
                importStatus: row.importStatus === 'failed' ? 'pending' : row.importStatus
            };

            // Re-validate and check existing status
            updatedRow.isValid = !!(updatedRow.candidateName && updatedRow.email && updatedRow.mobile);
            updatedRow.isExisting = checkIsExisting(updatedRow.email, updatedRow.mobile);
            
            return updatedRow;
        }));
    };

    const removeRow = (index) => {
        const newData = [...parsedData];
        newData.splice(index, 1);
        setParsedData(newData);
        if (newData.length === 0) {
            setActiveTab('upload');
            setFilesQueue([]);
        }
    };

    const startImporting = async () => {
        // Exclude invalid or already failed rows
        const validData = parsedData.filter(d => d.isValid && d.importStatus === 'pending');
        if (validData.length === 0) {
            toast.error('No valid candidates to import. Ensure Name, Email, and Phone are filled.');
            return;
        }

        setIsImporting(true);
        setActiveTab('summary');
        setProgress({ current: 0, total: validData.length, success: 0, failed: 0 });

        let anySuccess = false;

        for (let i = 0; i < validData.length; i++) {
            const dataItem = validData[i];
            
            try {
                // 1. Upload Resume
                const resumeFormData = new FormData();
                resumeFormData.append('resume', dataItem.file);
                const uploadRes = await api.post(`/ta/candidates/upload-resume/${hiringRequestId}`, resumeFormData);
                
                const { resumeUrl, resumePublicId } = uploadRes.data;

                // 2. Create/Update Candidate
                const candidatePayload = {
                    hiringRequestId,
                    candidateName: dataItem.candidateName,
                    email: dataItem.email,
                    mobile: dataItem.mobile,
                    totalExperience: dataItem.totalExperience ? Number(dataItem.totalExperience) : 0,
                    resumeUrl,
                    resumePublicId,
                    niceToHaveSkills: dataItem.niceToHaveSkills,
                    source: 'Direct Upload'
                };

                const createRes = await api.post('/ta/candidates', candidatePayload);
                
                // Update specific row in parsedData
                setParsedData(prev => prev.map(d => 
                    d.id === dataItem.id 
                        ? { ...d, importStatus: 'success', isUpdate: createRes.data.isUpdate } 
                        : d
                ));
                
                anySuccess = true;
                setProgress(p => ({ ...p, current: i + 1, success: p.success + 1 }));
            } catch (error) {
                console.error(`Error importing ${dataItem.fileName}:`, error);
                
                setParsedData(prev => prev.map(d => 
                    d.id === dataItem.id 
                        ? { ...d, importStatus: 'failed', error: error.response?.data?.message || 'Server error' } 
                        : d
                ));
                
                setProgress(p => ({ ...p, current: i + 1, failed: p.failed + 1 }));
            }
        }

        setIsImporting(false);
        if (anySuccess) {
            toast.success(`Successfully processed resumes!`);
            if (onImportSuccess) onImportSuccess();
        }
    };

    const resetImport = () => {
        setFilesQueue([]);
        setParsedData([]);
        setProgress({ current: 0, total: 0, success: 0, failed: 0 });
        setActiveTab('upload');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <FileArchive size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Bulk Resume Import</h2>
                            <p className="text-sm text-slate-500">Upload multiple PDF/DOCX or ZIP files</p>
                        </div>
                    </div>
                    {!isParsing && !isImporting && (
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Progress Bar Header */}
                    {(isParsing || isImporting) && (
                        <div className="mb-6 p-4 border border-blue-100 bg-blue-50 rounded-xl">
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-medium text-blue-800">
                                    {isParsing ? 'Parsing Resumes...' : 'Importing Candidates...'}
                                </p>
                                <p className="text-sm font-medium text-blue-600">
                                    {progress.current} / {progress.total}
                                </p>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
                                ></div>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs font-medium text-slate-600">
                                <span className={isImporting ? 'text-emerald-600' : ''}>✅ Success: {progress.success}</span>
                                <span className={isImporting && progress.failed > 0 ? 'text-red-600' : ''}>❌ Failed: {progress.failed}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'upload' && (
                        <div className="space-y-6">
                            <div
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer text-center ${
                                    isExtracting ? 'border-amber-300 bg-amber-50' : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50'
                                }`}
                                onClick={() => !isExtracting && fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.zip"
                                    multiple
                                />
                                {isExtracting ? (
                                    <>
                                        <Loader className="w-12 h-12 text-amber-500 mb-4 animate-spin" />
                                        <h3 className="text-lg font-semibold text-amber-700">Extracting ZIP...</h3>
                                        <p className="text-amber-600/80 mt-1">Please wait while we unpack your files</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-slate-200">
                                            <Upload className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Click to upload or drag & drop</h3>
                                        <p className="text-slate-500 mb-4">You can select multiple PDF, DOCX, or upload a ZIP folder containing resumes</p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {(activeTab === 'review' || activeTab === 'summary') && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-slate-800">
                                    {activeTab === 'review' ? 'Verify Parsed Data' : 'Import Summary'}
                                </h3>
                                {activeTab === 'review' && (
                                    <div className="text-sm px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                                        Found {parsedData.length} resumes
                                    </div>
                                )}
                            </div>

                            {activeTab === 'summary' && !isImporting && (
                                <div className="grid grid-cols-3 gap-4 mb-6 animate-in slide-in-from-top-2 duration-300">
                                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                                        <div className="text-2xl font-black text-emerald-600 mb-0.5">
                                            {parsedData.filter(d => d.importStatus === 'success' && !d.isUpdate).length}
                                        </div>
                                        <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">Newly Added</div>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center">
                                        <div className="text-2xl font-black text-blue-600 mb-0.5">
                                            {parsedData.filter(d => d.importStatus === 'success' && d.isUpdate).length}
                                        </div>
                                        <div className="text-[10px] font-bold text-blue-800 uppercase tracking-tight">Updated</div>
                                    </div>
                                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-center">
                                        <div className="text-2xl font-black text-rose-600 mb-0.5">
                                            {parsedData.filter(d => d.importStatus === 'failed').length}
                                        </div>
                                        <div className="text-[10px] font-bold text-rose-800 uppercase tracking-tight">Failed</div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-700 font-medium">
                                        <tr>
                                            <th className="px-4 py-3 border-b">File Name</th>
                                            <th className="px-4 py-3 border-b">Type</th>
                                            <th className="px-4 py-3 border-b">Candidate Name</th>
                                            <th className="px-4 py-3 border-b">Email</th>
                                            <th className="px-4 py-3 border-b">Mobile</th>
                                            {activeTab === 'review' && <th className="px-4 py-3 border-b border-l text-center w-12">Action</th>}
                                            {activeTab === 'summary' && <th className="px-4 py-3 border-b">Status</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {parsedData.map((row, index) => (
                                            <tr key={index} className={row.isValid ? 'hover:bg-slate-50/50' : 'bg-red-50/30'}>
                                                <td className="px-4 py-3 max-w-[180px] truncate font-medium text-slate-800" title={row.fileName}>
                                                    {row.fileName}
                                                    {row.error && activeTab === 'review' && <p className="text-xs text-red-500 mt-1">{row.error}</p>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {row.isExisting ? (
                                                        <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded text-[10px]">UPDATE</span>
                                                    ) : (
                                                        <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">NEW</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {activeTab === 'review' ? (
                                                        <input 
                                                            type="text" 
                                                            value={row.candidateName} 
                                                            onChange={(e) => handleDataChange(index, 'candidateName', e.target.value)}
                                                            className={`w-full px-2 py-1 border rounded text-sm ${!row.candidateName ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:border-blue-500'}`}
                                                            placeholder="Required"
                                                        />
                                                    ) : row.candidateName}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {activeTab === 'review' ? (
                                                        <input 
                                                            type="email" 
                                                            value={row.email} 
                                                            onChange={(e) => handleDataChange(index, 'email', e.target.value)}
                                                            className={`w-full px-2 py-1 border rounded text-sm ${!row.email ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:border-blue-500'}`}
                                                            placeholder="Required"
                                                        />
                                                    ) : row.email}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {activeTab === 'review' ? (
                                                        <input 
                                                            type="text" 
                                                            value={row.mobile} 
                                                            onChange={(e) => handleDataChange(index, 'mobile', e.target.value)}
                                                            className={`w-full px-2 py-1 border rounded text-sm ${!row.mobile ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:border-blue-500'}`}
                                                            placeholder="Required"
                                                        />
                                                    ) : row.mobile}
                                                </td>
                                                {activeTab === 'review' && (
                                                    <td className="px-4 py-3 border-l text-center">
                                                        <button 
                                                            onClick={() => removeRow(index)}
                                                            className="text-slate-400 hover:text-red-500 p-1"
                                                            title="Remove from import"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </td>
                                                )}
                                                {activeTab === 'summary' && (
                                                    <td className="px-4 py-3">
                                                        {row.importStatus === 'success' ? (
                                                            <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                                                <CheckCircle size={16}/> 
                                                                {row.isUpdate ? 'Updated' : 'Created'}
                                                            </div>
                                                        ) : row.importStatus === 'failed' ? (
                                                            <div className="flex items-center gap-1.5 text-red-600 font-medium" title={row.error}>
                                                                <XCircle size={16}/> Failed
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                                                <Loader size={16} className="animate-spin"/> Pending
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedData.length === 0 && (
                                    <div className="p-8 text-center text-slate-500">No resumes processed.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        disabled={isParsing || isImporting || isExtracting}
                        className="px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {activeTab === 'summary' ? 'Close' : 'Cancel'}
                    </button>
                    
                    {activeTab === 'review' && (
                        <button
                            onClick={startImporting}
                            disabled={isParsing || parsedData.filter(d => d.isValid).length === 0}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
                        >
                            {isParsing ? (
                                <><Loader className="w-5 h-5 animate-spin" /> Parsing Please Wait...</>
                            ) : (
                                <>Confirm & Import <ArrowRight size={18} /></>
                            )}
                        </button>
                    )}
                    
                    {activeTab === 'summary' && !isImporting && (
                        <button
                            onClick={resetImport}
                            className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors"
                        >
                            Import More Resumes
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkResumeImport;

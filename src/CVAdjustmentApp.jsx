import React, { useState } from 'react';
import { Upload, FileText, Briefcase, AlertCircle, CheckCircle, Download, Loader2, Key } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function CVAdjustmentApp() {
    const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
    const [cv, setCV] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setCV(event.target.result);
            };
            reader.readAsText(file);
        }
    };

    const processJobApplication = async () => {
        if (!cv || !jobDescription || !apiKey) {
            setError('Please provide CV, job description, and API key');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        const provider = import.meta.env.VITE_PROVIDER || 'openai';
        const modelName = import.meta.env.VITE_MODEL || 'gemini-1.5-flash';

        try {
            const callAI = async (prompt) => {
                if (provider === 'gemini') {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: modelName });

                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    return response.text();
                } else {
                    const response = await fetch(import.meta.env.VITE_API_ENDPOINT, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: modelName,
                            messages: [{ role: "user", content: prompt }]
                        })
                    });
                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message);
                    return data.choices[0].message.content;
                }
            };

            // Step 1: Analyze fit and extract job details
            const analysisPrompt = `Analyze this job application fit and extract details.

CV:
${cv}

Job Description:
${jobDescription}

Respond in JSON format ONLY with:
{
  "isGoodFit": true/false,
  "fitReason": "brief explanation",
  "positionRole": "exact position title",
  "companyName": "exact company name",
  "companyLocation": "city only",
  "companyWebsite": "URL if found or empty",
  "employmentType": "Full-time/Part-time",
  "salaryEstimate": number (monthly ILS, just the number),
  "lowSalaryWarning": true/false (if <25000),
  "keywords": ["keyword1", "keyword2", ...],
  "suggestedFileName": "CompanyName_Position_Feb2026.docx"
}

For salary: estimate based on the CV experience level and Israeli market rates for this role. Return ONLY the number.`;

            let analysisText = await callAI(analysisPrompt);
            analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const analysis = JSON.parse(analysisText);

            // Step 2: Adjust CV to match keywords
            const cvPrompt = `Adjust this CV to match the job description and include these keywords naturally: ${analysis.keywords.join(', ')}

Original CV:
${cv}

Job Description:
${jobDescription}

Requirements:
- Tailor experience and skills to match job requirements
- Incorporate keywords naturally (avoid obvious keyword stuffing)
- Optimize for ATS (Applicant Tracking Systems)
- Keep the same overall structure and format
- Ensure no repetitive content
- Maintain professional tone
- Keep all dates and factual information accurate

Return ONLY the adjusted CV text, no preamble or explanation.`;

            const adjustedCV = (await callAI(cvPrompt)).trim();

            setResult({
                ...analysis,
                adjustedCV
            });

        } catch (err) {
            setError('Error processing application: ' + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const downloadCV = () => {
        if (!result) return;

        const blob = new Blob([result.adjustedCV], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.suggestedFileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadExcel = () => {
        if (!result) return;

        // Create CSV format for Excel
        const csvContent = `Position Role,Company Name,Company Location,Company Website,Employment Type,Salary (ILS/month)
"${result.positionRole}","${result.companyName}","${result.companyLocation}","${result.companyWebsite}","${result.employmentType}",${result.salaryEstimate}`;

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `JobDetails_${result.companyName}_Feb2026.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Briefcase className="w-8 h-8 text-indigo-600" />
                        <h1 className="text-3xl font-bold text-gray-800">CV Adjustment Tool</h1>
                    </div>
                    <p className="text-gray-600">Automatically adjust your CV to match job descriptions and extract key details</p>
                </div>

                {/* API Key Input */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Key className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-semibold text-gray-800">Gemini API Key</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Required for analysis. Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 underline">Google AI Studio</a>.</p>
                    <input
                        type="password"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="sk-..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* CV Input */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-xl font-semibold text-gray-800">Your CV</h2>
                        </div>

                        <div className="mb-4">
                            <label className="flex items-center justify-center w-full px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg border-2 border-dashed border-indigo-300 cursor-pointer hover:bg-indigo-100 transition">
                                <Upload className="w-4 h-4 mr-2" />
                                <span>Upload CV File</span>
                                <input type="file" className="hidden" accept=".txt,.docx,.pdf" onChange={handleFileUpload} />
                            </label>
                        </div>

                        <textarea
                            className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            placeholder="Or paste your CV text here..."
                            value={cv}
                            onChange={(e) => setCV(e.target.value)}
                        />
                    </div>

                    {/* Job Description Input */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Briefcase className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-xl font-semibold text-gray-800">Job Description</h2>
                        </div>

                        <textarea
                            className="w-full h-80 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            placeholder="Paste the job description here..."
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                        />
                    </div>
                </div>
                {/* Process Button */}
                <div className="flex justify-center mb-6">
                    <button
                        onClick={processJobApplication}
                        disabled={loading || !cv || !jobDescription || !apiKey}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Adjust CV & Extract Details'
                        )}
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="space-y-6">
                        {/* Fit Assessment */}
                        <div className={`rounded-lg shadow-lg p-6 ${result.isGoodFit ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                {result.isGoodFit ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : (
                                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                                )}
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {result.isGoodFit ? 'Good Fit! ✓' : 'Potential Fit'}
                                </h2>
                            </div>
                            <p className="text-gray-700">{result.fitReason}</p>

                            {result.lowSalaryWarning && (
                                <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                                    <p className="text-orange-800 font-semibold">⚠️ Salary below 25,000 ILS/month</p>
                                </div>
                            )}
                        </div>

                        {/* Job Details Table */}
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-800">Job Details</h2>
                                <button
                                    onClick={downloadExcel}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download Excel
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Field</th>
                                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border border-gray-300 px-4 py-2 font-medium">Position Role</td>
                                            <td className="border border-gray-300 px-4 py-2">{result.positionRole}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 px-4 py-2 font-medium">Company Name</td>
                                            <td className="border border-gray-300 px-4 py-2">{result.companyName}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 px-4 py-2 font-medium">Company Location</td>
                                            <td className="border border-gray-300 px-4 py-2">{result.companyLocation}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 px-4 py-2 font-medium">Company Website</td>
                                            <td className="border border-gray-300 px-4 py-2">
                                                {result.companyWebsite ? (
                                                    <a href={result.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                                        {result.companyWebsite}
                                                    </a>
                                                ) : 'N/A'}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 px-4 py-2 font-medium">Employment Type</td>
                                            <td className="border border-gray-300 px-4 py-2">{result.employmentType}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 px-4 py-2 font-medium">Salary Estimate (ILS/month)</td>
                                            <td className="border border-gray-300 px-4 py-2 font-semibold">{result.salaryEstimate.toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 px-4 py-2 font-medium">Suggested File Name</td>
                                            <td className="border border-gray-300 px-4 py-2">{result.suggestedFileName}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Adjusted CV */}
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-800">Adjusted CV</h2>
                                <button
                                    onClick={downloadCV}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download CV
                                </button>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{result.adjustedCV}</pre>
                            </div>

                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    <strong>Note:</strong> This CV has been optimized with keywords: {result.keywords.join(', ')}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

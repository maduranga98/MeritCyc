import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { getFunctions, httpsCallable } from "firebase/functions";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ParsedRow {
  name: string;
  email: string;
  role: string;
  departmentId?: string;
  salaryBandId?: string;
  __isValid: boolean;
  __errors: string[];
}

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<{ sent: number; failed: { row: any; reason: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsedRows: ParsedRow[] = results.data.map((row: any) => {
          const errors: string[] = [];
          if (!row.name) errors.push("Missing name");
          if (!row.email) errors.push("Missing email");
          if (!row.role) {
            errors.push("Missing role");
          } else if (row.role !== "employee" && row.role !== "manager") {
            errors.push("Role must be 'employee' or 'manager'");
          }

          return {
            name: row.name || "",
            email: row.email || "",
            role: row.role || "",
            departmentId: row.departmentId || "",
            salaryBandId: row.salaryBandId || "",
            __isValid: errors.length === 0,
            __errors: errors,
          };
        });

        setRows(parsedRows);
        setStep(2);
      },
      error: (err) => {
        setError(err.message);
      }
    });
  };

  const downloadTemplate = () => {
    const csvContent = "name,email,role,departmentId,salaryBandId\nJohn Doe,john@example.com,employee,dept123,band456\nJane Smith,jane@example.com,manager,,";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "meritcyc_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => r.__isValid).map(r => ({
      name: r.name,
      email: r.email,
      role: r.role,
      departmentId: r.departmentId,
      salaryBandId: r.salaryBandId,
    }));

    if (validRows.length === 0) {
      setError("No valid rows to import.");
      return;
    }

    if (validRows.length > 200) {
      setError("Maximum 200 employees per batch.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStep(3);

    try {
      const functions = getFunctions();
      const bulkImport = httpsCallable(functions, "bulkImportEmployees");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await bulkImport({ employees: validRows });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResults(response.data as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error bulk importing:", err);
      setError(err.message || "Failed to process bulk import.");
      setStep(2); // Go back on critical error
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setRows([]);
    setResults(null);
    setError(null);
    if (results && onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-brand">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-merit-navy">Bulk Import Employees</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="text-center py-10 space-y-6">
              <div className="max-w-md mx-auto">
                <p className="text-merit-slate mb-4">
                  Upload a CSV file containing employee details to send multiple invitations at once.
                </p>

                <div className="flex justify-center mb-6">
                  <button
                    onClick={downloadTemplate}
                    className="text-merit-primary font-medium text-sm hover:underline"
                  >
                    Download CSV Template
                  </button>
                </div>

                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600 font-medium">Click to upload CSV</p>
                  <p className="text-xs text-gray-400 mt-1">Maximum 200 rows</p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-merit-navy">Review Data</h3>
                <div className="text-sm">
                  <span className="text-green-600 font-medium">{rows.filter(r => r.__isValid).length} valid</span>
                  <span className="text-gray-400 mx-2">|</span>
                  <span className="text-red-600 font-medium">{rows.filter(r => !r.__isValid).length} invalid</span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row, i) => (
                      <tr key={i} className={row.__isValid ? "bg-white" : "bg-red-50"}>
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="px-4 py-3">{row.email}</td>
                        <td className="px-4 py-3">{row.role}</td>
                        <td className="px-4 py-3">
                          {row.__isValid ? (
                            <span className="text-green-600 text-xs font-medium px-2 py-1 bg-green-100 rounded-full">Ready</span>
                          ) : (
                            <span className="text-red-600 text-xs" title={row.__errors.join(", ")}>
                              {row.__errors[0]} {row.__errors.length > 1 && `+${row.__errors.length - 1} more`}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={rows.filter(r => r.__isValid).length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-merit-primary hover:bg-merit-primary/90 rounded-md transition-colors disabled:opacity-50"
                >
                  Import {rows.filter(r => r.__isValid).length} Employees
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-10 space-y-6">
              {submitting ? (
                <div>
                  <div className="w-12 h-12 border-4 border-merit-primary/20 border-t-merit-primary rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-merit-slate">Sending invitations...</p>
                </div>
              ) : (
                <div className="max-w-md mx-auto text-left">
                  <div className="bg-green-50 p-6 rounded-lg mb-6 border border-green-100 text-center">
                    <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="text-lg font-bold text-green-800 mb-1">Import Complete</h3>
                    <p className="text-green-600 text-sm">Successfully sent {results?.sent || 0} invitations.</p>
                  </div>

                  {results?.failed && results.failed.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-merit-navy mb-3">Failed Entries ({results.failed.length})</h4>
                      <ul className="text-sm text-red-600 space-y-2 bg-red-50 p-4 rounded-md">
                        {results.failed.map((f, i) => (
                          <li key={i}>
                            <span className="font-medium">{f.row.email || f.row.name || "Unknown row"}:</span> {f.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-8 flex justify-center">
                    <button
                      onClick={handleClose}
                      className="px-6 py-2 text-sm font-medium text-white bg-merit-primary hover:bg-merit-primary/90 rounded-md transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Send,
  Upload,
} from "lucide-react";

const metricCategories = [
  "Sponsored Research",
  "Faculty Roster",
  "Placement & Higher Studies",
  "PhDs Awarded",
];

export default function NodalOfficerSubmission() {
  const [submissionTitle, setSubmissionTitle] = useState("");
  const [metricCategory, setMetricCategory] = useState(metricCategories[0]);
  const [rawDataFile, setRawDataFile] = useState<File | null>(null);
  const [proofDocument, setProofDocument] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <main className="mx-auto max-w-3xl">
        <section className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Submission created
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
            Your data is pending review
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500">
            The submission has been recorded for the assigned department with a
            <span className="font-semibold text-gray-700"> PENDING </span>
            status. DORA will review the data and supporting proof documents.
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-xl border border-gray-100 bg-gray-50 p-4 text-left text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Title</span>
              <span className="font-medium text-gray-900">{submissionTitle}</span>
            </div>
            <div className="mt-3 flex justify-between gap-4">
              <span className="text-gray-500">Category</span>
              <span className="font-medium text-gray-900">{metricCategory}</span>
            </div>
            <div className="mt-3 flex justify-between gap-4">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold text-blue-600">PENDING</span>
            </div>
          </div>
          <div className="mt-8 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Submit Another
            </button>
            <Link
              to="/nodal-officer"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Return to Dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Upload Ranking Data & Proofs
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Submit department-level quantitative metric data and verifiable proof
          documents for institutional ranking verification.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm sm:p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Assigned Department / School
            </label>
            <input
              type="text"
              readOnly
              value="School of Computing and Electrical Engineering (SCEE)"
              className="mt-2 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed outline-none"
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-gray-900">
              Submission Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              required
              placeholder="e.g., Sponsored Projects 2025-2026 Batch A"
              value={submissionTitle}
              onChange={(e) => setSubmissionTitle(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-semibold text-gray-900">
              Metric Category <span className="text-rose-500">*</span>
            </label>
            <select
              id="category"
              value={metricCategory}
              onChange={(e) => setMetricCategory(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {metricCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Raw Metric Data Spreadsheet (.xlsx, .csv) <span className="text-rose-500">*</span>
            </label>
            <div className="mt-2 flex justify-center rounded-xl border border-dashed border-gray-300 px-6 py-8 hover:border-blue-500 transition-colors">
              <div className="text-center">
                <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-400" />
                <div className="mt-4 flex text-sm leading-6 text-gray-600">
                  <label
                    htmlFor="raw-data-upload"
                    className="relative cursor-pointer rounded-md font-semibold text-blue-600 focus-within:outline-none hover:text-blue-500"
                  >
                    <span>Upload a spreadsheet</span>
                    <input
                      id="raw-data-upload"
                      name="raw-data-upload"
                      type="file"
                      accept=".xlsx,.csv"
                      required
                      className="sr-only"
                      onChange={(e) => setRawDataFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  {rawDataFile ? rawDataFile.name : "XLSX or CSV up to 10MB"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Supporting Proof Document (.pdf, .docx) <span className="text-rose-500">*</span>
            </label>
            <div className="mt-2 flex justify-center rounded-xl border border-dashed border-gray-300 px-6 py-8 hover:border-blue-500 transition-colors">
              <div className="text-center">
                <FileText className="mx-auto h-10 w-10 text-gray-400" />
                <div className="mt-4 flex text-sm leading-6 text-gray-600">
                  <label
                    htmlFor="proof-upload"
                    className="relative cursor-pointer rounded-md font-semibold text-blue-600 focus-within:outline-none hover:text-blue-500"
                  >
                    <span>Upload proof file</span>
                    <input
                      id="proof-upload"
                      name="proof-upload"
                      type="file"
                      accept=".pdf,.docx"
                      required
                      className="sr-only"
                      onChange={(e) => setProofDocument(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  {proofDocument ? proofDocument.name : "PDF or DOCX up to 25MB"}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 active:scale-[0.98] transition-all"
            >
              <Send className="h-4 w-4" />
              Submit to DORA
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}

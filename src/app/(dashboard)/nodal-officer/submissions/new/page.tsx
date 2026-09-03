"use client";

import { FormEvent, useState } from "react";
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

export default function NodalOfficerUpload() {
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
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Nodal Officer Portal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          Create data submission
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
          Submit one metric category and its evidence for administrative review.
          This submission is scoped to your assigned department.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <FileText className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Assigned department
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              Department associated with your Nodal Officer account
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold text-gray-900">Submission Title</span>
            <input
              required
              type="text"
              value={submissionTitle}
              onChange={(event) => setSubmissionTitle(event.target.value)}
              placeholder="e.g. Sponsored research contributions 2025-26"
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-sm font-semibold text-gray-900">Metric Category</span>
            <select
              required
              value={metricCategory}
              onChange={(event) => setMetricCategory(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {metricCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-900">Raw Data Upload</span>
            <span className="mt-1 block text-xs text-gray-500">Structured data only: XLSX or CSV</span>
            <span className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-200 px-3 py-3 transition hover:border-blue-400 hover:bg-blue-50/40">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
                {rawDataFile?.name ?? "Choose a structured data file"}
              </span>
              <Upload className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <input
                required
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => setRawDataFile(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-900">Proof Document Upload</span>
            <span className="mt-1 block text-xs text-gray-500">Evidence documents: PDF or DOCX</span>
            <span className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-200 px-3 py-3 transition hover:border-blue-400 hover:bg-blue-50/40">
              <FileText className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
                {proofDocument?.name ?? "Choose an evidence document"}
              </span>
              <Upload className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <input
                required
                type="file"
                accept=".pdf,.docx"
                onChange={(event) => setProofDocument(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </span>
            <span className="mt-2 block text-xs leading-5 text-gray-500">
              Files will be securely stored in the Document Proof Repository for immutable audit tracking.
            </span>
          </label>
        </div>

        <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Submit for review
          </button>
        </div>
      </form>
    </main>
  );
}

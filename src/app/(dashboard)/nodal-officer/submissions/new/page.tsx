"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, FileXls, FilePdf, UploadSimple, ArrowRight, ArrowLeft, DownloadSimple } from '@phosphor-icons/react';
import { useToast } from '@/components/ToastProvider';

const steps = [
  { id: 1, title: 'Faculty Details', desc: 'Sanctioned and actual faculty counts' },
  { id: 2, title: 'Student Intake', desc: 'UG and PG enrollment data' },
  { id: 3, title: 'Proof Documents', desc: 'Supporting PDFs for validation' },
  { id: 4, title: 'Review', desc: 'Final review and submission' }
];

export default function NodalOfficerUpload() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleNext = () => {
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      showToast('Data submitted successfully for administrative review.', 'success');
      // In a real app, router.push('/data-collection')
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900">Data Submission</h1>
        <p className="text-zinc-500 mt-2 max-w-[65ch] leading-relaxed">NIRF 2026 Institutional Data Cycle</p>
      </div>

      {/* Progress Tracker */}
      <div className="bg-white border border-slate-200/50 rounded-2xl p-6 shadow-sm overflow-x-auto">
        <div className="flex items-center min-w-max">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  currentStep > step.id ? 'bg-sage-600 text-white' :
                  currentStep === step.id ? 'bg-sage-100 text-sage-700 ring-2 ring-sage-500/30' :
                  'bg-zinc-100 text-zinc-400'
                }`}>
                  {currentStep > step.id ? <CheckCircle weight="bold" className="w-5 h-5" /> : step.id}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-semibold ${currentStep >= step.id ? 'text-zinc-900' : 'text-zinc-400'}`}>{step.title}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 w-12 sm:w-20 mx-4 rounded-full ${currentStep > step.id ? 'bg-sage-600' : 'bg-zinc-100'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Wizard Content */}
      <div className="bg-white border border-slate-200/50 rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] min-h-[400px] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1"
          >
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">{steps[currentStep - 1].title}</h2>
            <p className="text-zinc-500 text-sm mb-8">{steps[currentStep - 1].desc}</p>

            {/* Step 1 & 2: Excel Data Uploads */}
            {(currentStep === 1 || currentStep === 2) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-zinc-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileXls weight="duotone" className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-semibold text-zinc-900 text-sm">Download Template</p>
                      <p className="text-xs text-zinc-500">Standardized {currentStep === 1 ? 'Faculty' : 'Student'} data format</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => showToast('Template download started.', 'info')}
                    className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-zinc-600 transition-all shadow-sm"
                  >
                    <DownloadSimple weight="bold" className="w-5 h-5" />
                  </button>
                </div>

                <div 
                  onClick={() => showToast('File picker opened.', 'info')}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-sage-400 hover:bg-sage-50/50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-50 group-hover:bg-sage-100 flex items-center justify-center mb-4 transition-colors">
                    <UploadSimple weight="bold" className="w-6 h-6 text-zinc-400 group-hover:text-sage-600" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-zinc-500">Excel files only (XLSX, CSV) up to 10MB</p>
                </div>
              </div>
            )}

            {/* Step 3: PDF Proofs */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div 
                  onClick={() => showToast('File picker opened.', 'info')}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-sage-400 hover:bg-sage-50/50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-50 group-hover:bg-sage-100 flex items-center justify-center mb-4 transition-colors">
                    <FilePdf weight="duotone" className="w-6 h-6 text-zinc-400 group-hover:text-sage-600" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 mb-1">Upload proof documents</p>
                  <p className="text-xs text-zinc-500">PDFs only, multiple files allowed</p>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="p-4 bg-sage-50 border border-sage-200/50 rounded-xl flex gap-4 items-start">
                  <CheckCircle weight="fill" className="w-6 h-6 text-sage-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sage-900 text-sm">All sections completed</p>
                    <p className="text-sage-700 text-sm mt-1">Please review your uploaded files before submitting to the Dean's Office. Once submitted, changes require an explicit correction request.</p>
                  </div>
                </div>
                
                {/* Summary boxes */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="p-4 border border-slate-200 rounded-xl">
                    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Faculty Data</p>
                    <p className="text-sm font-medium text-zinc-900 flex items-center gap-2"><FileXls weight="fill" className="text-green-600"/> faculty_final.xlsx</p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-xl">
                    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Student Data</p>
                    <p className="text-sm font-medium text-zinc-900 flex items-center gap-2"><FileXls weight="fill" className="text-green-600"/> students_2026.xlsx</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between mt-auto">
          <button 
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft weight="bold" /> Back
          </button>
          
          {currentStep < steps.length ? (
            <button 
              onClick={handleNext}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-black active:scale-[0.98] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md"
            >
              Continue <ArrowRight weight="bold" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 active:scale-[0.98] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_8px_16px_-4px_rgba(90,115,89,0.3)] disabled:opacity-70 disabled:cursor-wait"
            >
              {isSubmitting ? 'Submitting...' : 'Submit to DORA'} <CheckCircle weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { PdfUploader } from "@/components/pdf/uploader";
import { ClayCard } from "@/components/ui/clay-card";
import { CourseCatalog } from "@/components/landing/course-catalog";
import { ProgressTrackingDemo } from "@/components/landing/progress-tracking";
import { Testimonials } from "@/components/landing/testimonials";
import { EnrollmentCTA } from "@/components/landing/enrollment-cta";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 sm:px-8">
        
        {/* Hero Section */}
        <header className="relative flex flex-col items-center gap-8 py-16 text-center lg:py-24">
          <div className="relative z-10 max-w-3xl">
            <span className="mb-4 inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-bold tracking-wide text-indigo-600 shadow-sm dark:bg-indigo-900/50 dark:text-indigo-300">
              ✨ Making Learning Magical Again
            </span>
            <h1 className="mb-6 text-5xl font-extrabold leading-tight text-[#1E1B4B] dark:text-slate-100 sm:text-6xl lg:text-7xl">
              Turn Boring PDFs into <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Playful Quizzes</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl">
              Upload any document and watch as AI transforms it into an interactive game. 
              Track your progress, earn achievements, and master any subject in minutes.
            </p>
            
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/dashboard" className="clay-button transform transition-all hover:-translate-y-1">
                Start Learning for Free
              </Link>
            </div>
          </div>

          {/* Decorative Floating Blobs */}
          <div className="absolute top-0 left-0 -z-10 h-72 w-72 rounded-full bg-purple-200/50 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 -z-10 h-96 w-96 rounded-full bg-blue-200/50 blur-3xl animate-pulse delay-700" />
        </header>

        {/* Uploader Section */}
        <section className="relative z-20 -mt-8">
          <ClayCard className="mx-auto max-w-3xl border-4 border-white/60 bg-white/90 backdrop-blur-sm">
            <div className="mb-6 text-center">
              <h3 className="text-xl font-bold text-gray-800">Try it out right now!</h3>
              <p className="text-sm text-gray-500">Drop a PDF below to generate your first quiz pack.</p>
            </div>
            <PdfUploader />
          </ClayCard>
        </section>

        {/* Feature Sections */}
        <CourseCatalog />
        <ProgressTrackingDemo />
        <Testimonials />
        <EnrollmentCTA />

      </main>
      
      {/* Footer */}
      <footer className="border-t border-indigo-100 bg-white/50 py-12 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 text-center text-slate-500">
          <p className="mb-4 font-heading font-bold text-indigo-300 text-xl">AutoQuiz</p>
          <p>© {new Date().getFullYear()} AutoQuiz. Made with 💜 for learners everywhere.</p>
        </div>
      </footer>
    </div>
  );
}

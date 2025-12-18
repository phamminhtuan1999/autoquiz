import React from 'react';
import Link from 'next/link';

export const EnrollmentCTA = () => {
  return (
    <section className="py-24 text-center">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[3rem] bg-indigo-600 px-6 py-16 shadow-2xl sm:px-12">
        {/* Background Decorative Elements */}
        <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-orange-500/20 blur-2xl" />
        
        <div className="relative z-10">
          <h2 className="mb-6 text-3xl font-bold text-white sm:text-5xl">
            Ready to Make Learning Fun?
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-indigo-100">
            Join thousands of students who have transformed their study habits. 
            Upload your first document today and start quizing in seconds!
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/dashboard" className="clay-button bg-white text-indigo-600 !bg-none hover:bg-indigo-50">
              Get Started for Free
            </Link>
            <p className="mt-4 text-sm text-indigo-200 sm:mt-0 sm:ml-4">
              No credit card required • Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

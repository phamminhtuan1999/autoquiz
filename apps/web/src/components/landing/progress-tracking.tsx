import React from 'react';
import { ClayCard } from '@/components/ui/clay-card';

export const ProgressTrackingDemo = () => {
  return (
    <section className="py-20">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <ClayCard className="relative p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-gray-800">Weekly Goal</h4>
                <p className="text-sm text-gray-500">Keep up the momentum!</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-xl">
                🔥
              </div>
            </div>
            
            {/* Progress Bars */}
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold text-gray-600">
                  <span>Quiz Completion</span>
                  <span>85%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 shadow-inner">
                  <div className="h-full w-[85%] rounded-full bg-indigo-500 shadow-sm" />
                </div>
              </div>
              
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold text-gray-600">
                  <span>Accuracy Rate</span>
                  <span>92%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 shadow-inner">
                  <div className="h-full w-[92%] rounded-full bg-green-500 shadow-sm" />
                </div>
              </div>
            </div>

            {/* Daily Streak */}
            <div className="mt-8">
              <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Daily Streak</h5>
              <div className="flex justify-between">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-sm ${i < 5 ? 'bg-indigo-500 text-white' : 'bg-white text-gray-400'}`}>
                      {i < 5 ? '✓' : ''}
                    </div>
                    <span className="text-xs font-medium text-gray-400">{day}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Floating Element */}
            <div className="absolute -right-4 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-2xl bg-white text-3xl shadow-[8px_8px_16px_rgba(79,70,229,0.15)] animate-bounce">
              🏆
            </div>
          </ClayCard>
        </div>
        
        <div className="order-1 text-center lg:order-2 lg:text-left">
          <span className="mb-2 inline-block rounded-full bg-green-100 px-4 py-1 text-sm font-bold text-green-600">
            Track Progress
          </span>
          <h2 className="mb-4 text-3xl font-bold text-[#1E1B4B] sm:text-4xl">
            Watch Your Knowledge <br />
            <span className="text-indigo-600">Grow Visualization</span>
          </h2>
          <p className="text-lg text-slate-600">
            Visualize your learning journey with our playful stats dashboard. 
            Earn badges, maintain streaks, and see exactly how much you&apos;ve improved over time. 
            Learning shouldn&apos;t be boring!
          </p>
        </div>
      </div>
    </section>
  );
};

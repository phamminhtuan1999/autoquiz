import React from 'react';
import { ClayCard } from '@/components/ui/clay-card';

const testimonials = [
  {
    id: 1,
    name: 'Ralph Anthony',
    role: 'English Teacher',
    text: "AutoQuiz turned my 500-page anatomy textbook into bite-sized quizzes. It's properly magic!",
    avatar: '👩🏻‍⚕️',
  },
  {
    id: 2,
    name: 'Allie Pham',
    role: 'Biology Student',
    text: "I used to dread studying for finals. Now I actually look forward to keeping my streak alive.",
    avatar: '👨🏿️️',
  },
  {
    id: 3,
    name: 'Matthew Pham',
    role: 'Software Engineer',
    text: "The best way to learn new topics quickly. The claymorphism design is just the cherry on top!",
    avatar: '👩🏼‍🎨',
  },
];

export const Testimonials = () => {
  return (
    <section className="py-20">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold text-[#1E1B4B] sm:text-4xl">
          Loved by <span className="text-[#10B981]">Learners</span> Everywhere
        </h2>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <ClayCard key={t.id} className="relative mt-8 flex flex-col items-center text-center">
            <div className="absolute -top-8 flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-[4px_4px_10px_rgba(0,0,0,0.1)]">
              {t.avatar}
            </div>
            <div className="pt-8">
              <p className="mb-6 text-lg italic text-slate-600">&quot;{t.text}&quot;</p>
              <h4 className="font-bold text-gray-900">{t.name}</h4>
              <span className="text-sm font-bold uppercase tracking-wide text-indigo-400">{t.role}</span>
            </div>
          </ClayCard>
        ))}
      </div>
    </section>
  );
};

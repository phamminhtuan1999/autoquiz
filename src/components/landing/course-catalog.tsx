import React from 'react';
import { ClayCard } from '@/components/ui/clay-card';

const courses = [
  {
    id: 1,
    title: 'Introduction to Biology',
    lessons: 12,
    color: 'bg-green-100',
    icon: '🧬',
    category: 'Science',
  },
  {
    id: 2,
    title: 'World History 101',
    lessons: 8,
    color: 'bg-yellow-100',
    icon: '🌍',
    category: 'History',
  },
  {
    id: 3,
    title: 'Basic Mathematics',
    lessons: 15,
    color: 'bg-blue-100',
    icon: '📐',
    category: 'Math',
  },
  {
    id: 4,
    title: 'Creative Writing',
    lessons: 10,
    color: 'bg-purple-100',
    icon: '✍️',
    category: 'Arts',
  },
];

export const CourseCatalog = () => {
  return (
    <section className="py-16">
      <div className="mb-10 text-center">
        <span className="mb-2 inline-block rounded-full bg-indigo-100 px-4 py-1 text-sm font-bold text-indigo-600">
          Explore Topics
        </span>
        <h2 className="text-3xl font-bold text-[#1E1B4B] sm:text-4xl">
          Discover Your Next <span className="text-[#F97316]">Adventure</span>
        </h2>
      </div>
      
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {courses.map((course) => (
          <ClayCard key={course.id} className="group relative overflow-hidden transition-all hover:-translate-y-2">
            <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-inner ${course.color}`}>
              {course.icon}
            </div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              {course.category}
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-800">{course.title}</h3>
            <div className="flex items-center justify-between text-sm font-medium text-gray-600">
              <span>{course.lessons} Lessons</span>
              <button className="h-8 w-8 rounded-full bg-white text-indigo-600 shadow-sm transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                →
              </button>
            </div>
          </ClayCard>
        ))}
      </div>
    </section>
  );
};

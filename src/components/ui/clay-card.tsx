import React from 'react';

interface ClayCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const ClayCard: React.FC<ClayCardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      className={`clay-card p-6 ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

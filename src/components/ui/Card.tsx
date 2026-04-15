import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = false,
  onClick
}) => {
  const Component = onClick ? motion.div : 'div';
  
  return (
    <Component
      className={`
        bg-white rounded-2xl shadow-lg border border-gray-100
        ${hover ? 'hover:shadow-xl transition-shadow duration-300 cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      {...(onClick && {
        whileHover: { y: -2 },
        whileTap: { scale: 0.98 }
      })}
    >
      {children}
    </Component>
  );
};

export const CardHeader: React.FC<{ className?: string; children: React.ReactNode }> = ({ 
  className = '', 
  children 
}) => (
  <div className={`p-6 border-b border-gray-100 ${className}`}>
    {children}
  </div>
);

export const CardContent: React.FC<{ className?: string; children: React.ReactNode }> = ({ 
  className = '', 
  children 
}) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);

export const CardFooter: React.FC<{ className?: string; children: React.ReactNode }> = ({ 
  className = '', 
  children 
}) => (
  <div className={`p-6 border-t border-gray-100 ${className}`}>
    {children}
  </div>
);

export default Card;
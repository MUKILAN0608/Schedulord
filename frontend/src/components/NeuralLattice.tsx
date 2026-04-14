import React from 'react';
import { motion } from 'framer-motion';

const NeuralLattice: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-platinum-satin">
      {/* Dynamic Light Sweeps */}
      <motion.div 
        animate={{ 
          x: ['-100%', '200%'],
          opacity: [0, 0.3, 0]
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity, 
          ease: "linear",
          repeatDelay: 2
        }}
        className="absolute inset-0 w-1/2 h-full skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />

      {/* The Neural Lattice Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="neural-grid" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M 120 0 L 0 0 0 120" fill="none" stroke="rgba(212, 175, 55, 0.4)" strokeWidth="0.5"/>
            <circle cx="0" cy="0" r="1.5" fill="#D4AF37" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#neural-grid)" />
      </svg>

      {/* Floating Macro-Nodes (Abstract) */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -40, 0],
            opacity: [0.1, 0.3, 0.1],
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 10 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 1.5
          }}
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 20}%`,
          }}
          className="absolute w-[300px] h-[300px] rounded-full bg-radial-gold opacity-10 blur-[100px]"
        />
      ))}
    </div>
  );
};

export default NeuralLattice;

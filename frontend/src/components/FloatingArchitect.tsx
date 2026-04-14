import React from 'react';
import { motion } from 'framer-motion';

const FloatingArchitect: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-platinum-satin">
      {/* Precision Grid Layer */}
      <div className="absolute inset-0 opacity-[0.08] platinum-grid transition-opacity duration-1000" />

      {/* Floating Platinum Glass Shards */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            x: [0, i % 2 === 0 ? 30 : -30, 0],
            y: [0, i % 3 === 0 ? 50 : -50, 0],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 15 + i * 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            left: `${10 + i * 20}%`,
            top: `${15 + i * 15}%`,
            width: `${150 + i * 50}px`,
            height: `${250 + i * 30}px`,
          }}
          className="absolute bg-white/40 border border-white/60 backdrop-blur-[60px] enterprise-shadow opacity-40 rounded-sm"
        />
      ))}

      {/* Subtle Gold Pulse Nodes */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`node-${i}`}
          animate={{ opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: 4, repeat: Infinity, delay: i * 0.8 }}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          className="absolute w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_15px_#D4AF37]"
        />
      ))}
    </div>
  );
};

export default FloatingArchitect;

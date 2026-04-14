import React from 'react';
import { motion } from 'framer-motion';

const LandingPage: React.FC = () => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white selection:bg-gold selection:text-black pb-0 overflow-x-hidden w-full font-sans">
      
      {/* Hero: Sovereign Glass Section */}
      <section 
        className="relative w-full min-h-screen flex flex-col items-center justify-center text-center px-4 md:px-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.png')" }}
      >
        {/* Subtle Vignette for Depth */}
        <div className="absolute inset-0 vignette-overlay z-0" />

        <div className="relative z-10 flex flex-col items-center w-full max-w-6xl space-y-12">
          {/* 1. Title (Gold Gradient + Stoppable Glow) */}
          <h1 className="text-[11vw] md:text-[7rem] lg:text-[9rem] font-black tracking-[-0.05em] leading-[0.85] title-glow-gold">
            Schedulord
          </h1>

          <div className="space-y-8">
            {/* 2. Prestige Serif Subtitle */}
            <div className="flex justify-center">
               <p className="beautiful-serif-subtitle text-[18px] md:text-3xl lg:text-4xl px-4">
                 The Orchestration Standard for Global Infrastructure
               </p>
            </div>

            {/* 3. Supporting Description (Performance Protocol) */}
            <p className="text-white font-medium text-[14px] md:text-lg lg:text-xl max-w-4xl mx-auto leading-relaxed tracking-wide performance-protocol-text">
              Seamlessly distribute GPUs, servers, and compute resources in real time—ensuring optimal utilization, reduced contention, and scalable performance across high-density environments.
            </p>
          </div>

          {/* 4. CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-8 pt-6">
            <button className="btn-sovereign-primary">
              Get Started
            </button>
            <button className="btn-sovereign-secondary">
              View Demo
            </button>
          </div>
        </div>
      </section>

      {/* Post-Hero Matrix (Kept Clean and Minimal) */}
      <div className="bg-obsidian w-full relative z-20">
        <section className="py-48 px-6 w-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {[
               { t: "Logic Engine", d: "Automated arbitration across distributed cycles." },
               { t: "Predictive Flow", d: "ML-driven spillover and surge forecasting." },
               { t: "Zero Friction", d: "Contested resource resolution natively synced." },
               { t: "Cloud Native", d: "Enterprise durability via Atlas orchestration." }
             ].map((cap, i) => (
               <motion.div 
                 key={i}
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true }}
                 transition={{ delay: i * 0.1 }}
                 className="p-10 glass-cyber-card border-white/10 hover:border-gold/30 transition-all group !rounded-2xl"
               >
                 <h4 className="text-[14px] font-black mb-4 text-gold uppercase tracking-[0.2em]">{cap.t}</h4>
                 <p className="text-[14px] text-white/50 leading-relaxed font-bold">{cap.d}</p>
               </motion.div>
             ))}
          </div>
        </section>

        <footer className="py-24 w-full flex flex-col items-center border-t border-white/5">
           <p className="text-[12px] font-medium uppercase tracking-[1em] text-white/20">
             © 2026 Schedulord — The Decision Standard.
           </p>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;

import React from 'react';
import { motion } from 'framer-motion';
import { SovereignDisplay } from '../components/SovereignDisplay';

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
    <div className="min-h-screen bg-[#020202] text-white selection:bg-gold selection:text-black pb-0 overflow-x-hidden w-full font-sans">
      <nav className="fixed top-0 w-full z-50 px-10 py-8 flex justify-end items-center bg-gradient-to-b from-[#050505]/90 to-transparent backdrop-blur-md">
        <div className="flex gap-10 items-center">
          <a href="#portals" className="nav-signin-btn">Sign In</a>
        </div>
      </nav>
      
      {/* Hero: Sovereign Glass Section */}
      <section 
        className="relative w-full min-h-screen flex flex-col items-center justify-center text-center px-4 md:px-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.png')" }}
      >
        {/* Cinematic Vignette */}
        <div className="absolute inset-0 vignette-overlay z-0" />

        <div className="relative z-10 flex flex-col items-center w-full max-w-6xl space-y-12">
          {/* 1. Title (Polished Satin Gold) */}
          <h1 className="text-[11vw] md:text-[7rem] lg:text-[9rem] font-black tracking-[-0.05em] leading-[0.85] title-glow-gold">
            Schedulord
          </h1>

          <div className="space-y-8">
            {/* Tagline Removed for Pure Aesthetic */}

            {/* 3. Supporting Description (Performance Protocol) */}
            <p className="text-white font-medium text-[14px] md:text-lg lg:text-xl max-w-4xl mx-auto leading-relaxed tracking-wide performance-protocol-text">
              Seamlessly distribute GPUs, servers, and compute resources in real time—ensuring optimal utilization, reduced contention, and scalable performance across high-density environments.
            </p>
          </div>

        </div>
      </section>

      {/* NEW: Architectural Reveal Section */}
      <section id="features" className="relative py-20 px-6 md:px-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Left: Intellectual Layer */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-10"
          >
            <h2 className="text-4xl md:text-6xl font-black title-glow-gold leading-tight">
              Architectural <br/> Integrity
            </h2>
            <p className="text-white/70 text-lg md:text-xl leading-relaxed max-w-xl font-medium">
              Ensure reliable and efficient allocation of GPU and server resources through an intelligent, controlled system. 
              Schedulord integrates automated decision logic with structured workflows to deliver optimized utilization, 
              reduced conflicts, and consistent system performance.
            </p>
          </motion.div>

          {/* Right: Physical Layer (3D Model) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="h-[500px] md:h-[600px] w-full"
          >
            <SovereignDisplay />
          </motion.div>
        </div>
      </section>

      {/* NEW: Sovereign Command Dialogue (Enterprise Chat Style) */}
      <section className="relative py-20 px-6 md:px-20 border-t border-white/5 overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
             <h2 className="text-4xl md:text-6xl font-black title-glow-gold mb-4">
               The Sovereign <br/> Difference
             </h2>
             <p className="beautiful-serif-subtitle text-lg text-white/40 italic">
               How our intelligent orchestration permanently eliminates legacy friction.
             </p>
          </motion.div>

          <div className="chat-messenger">
            {[
              { 
                p: "We're seeing major resource overlaps in the cluster. It's creating total friction and contention.", 
                s: "Conflict-Free protocol active. I've isolated every contested cycle with zero-collision logic.",
                f: "Conflict-Free Allocation"
              },
              { 
                p: "The request backlog is surging and there's no priority handling. Critical tasks are completely stalled.", 
                s: "Intelligence Engine engaged. I've arbitrated all requests based on real-time urgency and authority.",
                f: "Priority Handling"
              },
              { 
                p: "We've lost visibility on infrastructure availability. The current mapping is static and desynced.", 
                s: "Diagnostic Sync active. I've restored perfect availability mapping across the global infrastructure.",
                f: "Availability Awareness"
              },
              { 
                p: "Resource audit shows significant idle-cycle waste. Our compute throughput is way below target.", 
                s: "Maximum Utilization locked. I've engaged automated spillover and decision-driven optimization.",
                f: "Maximum Utilization"
              }
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-8">
                
                {/* Infrastructure Alert (Red) */}
                <div className="flex gap-4 items-end self-start">
                  <div className="messenger-avatar avatar-red border-red-500/20">A</div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, x: -30 }}
                    whileInView={{ opacity: 1, scale: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="messenger-bubble bubble-red-alert"
                  >
                    <span className="feature-tag tag-red italic">Infrastructure Incident</span>
                    <p className="text-[14px] font-medium leading-relaxed">{item.p}</p>
                  </motion.div>
                </div>

                {/* Sovereign Resolution (Gold) */}
                <div className="flex gap-4 items-end self-end">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, x: 30 }}
                    whileInView={{ opacity: 1, scale: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: (i * 0.2) + 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="messenger-bubble bubble-gold-success"
                  >
                    <span className="feature-tag tag-gold">{item.f}</span>
                    <p className="text-[15px] font-black leading-relaxed tracking-tight">{item.s}</p>
                    <div className="mt-3 flex items-center gap-1.5">
                       <div className="flex -space-x-1">
                         <div className="w-3 h-3 bg-gold rounded-full flex items-center justify-center text-black">
                           <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                         </div>
                         <div className="w-3 h-3 bg-gold rounded-full flex items-center justify-center text-black">
                           <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                         </div>
                       </div>
                       <span className="text-[9px] font-black text-gold uppercase tracking-widest opacity-60">Verified Resolution</span>
                    </div>
                  </motion.div>
                  <div className="messenger-avatar avatar-gold border-gold/30">S</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Backdrop Ambient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold/5 rounded-full blur-[120px] pointer-events-none opacity-40" />
      </section>

      {/* EXECUTIVE GATEWAY: Dual Authority Portals */}
      <section id="portals" className="relative py-24 px-6 md:px-20 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
             <h2 className="text-4xl md:text-7xl font-black title-glow-gold mb-8">
               Sovereign <br/> Gateways
             </h2>
             <p className="beautiful-serif-subtitle text-xl text-white/40 italic">
               Select your operational authority to enter the platform.
             </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Admin Portal */}
            <motion.div 
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="gateway-card group"
            >
              <div className="portal-pattern" />
              <span className="gateway-label">Operational Authority</span>
              <h3 className="gateway-title">Admin <br/> Orchestrator</h3>
              <p className="text-white/40 font-medium leading-relaxed max-w-sm">
                Full infrastructure arbitration. Manage logical isolation, priority weighting, and global cluster health.
              </p>
              <a href="/login/admin" className="gateway-btn">Access Command Vault</a>
            </motion.div>

            {/* Client Portal */}
            <motion.div 
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="gateway-card group"
            >
              <div className="portal-pattern" />
              <span className="gateway-label">Resource Optimization</span>
              <h3 className="gateway-title">Client <br/> Dashboard</h3>
              <p className="text-white/40 font-medium leading-relaxed max-w-sm">
                Visualization and utilization reporting. Monitor your allocated cycles and real-time performance ROI.
              </p>
              <a href="/login/client" className="gateway-btn">Enter Resource Portal</a>
            </motion.div>
          </div>
        </div>

        {/* Backdrop Decorative Glows */}
        <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px] pointer-events-none opacity-40" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px] pointer-events-none opacity-40" />
      </section>

    </div>
  );
};

export default LandingPage;

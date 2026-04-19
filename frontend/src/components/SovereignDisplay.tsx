import React, { Suspense, Component, ReactNode, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, Center, PerspectiveCamera, Bounds, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// --- Sovereign Error Boundary (Ultra-Silent) ---
class ThreeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function PhysicalHardware({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

const SovereignRecovery = () => {
  const { gl } = useThree();
  useEffect(() => {
    const handleContextLost = (e: Event) => { e.preventDefault(); };
    const handleContextRestored = () => { window.location.reload(); };
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl]);
  return null;
};

const LoadingState = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-[#050505] z-30 rounded-3xl">
    <div className="w-6 h-6 border border-gold/10 border-t-gold rounded-full animate-spin" />
  </div>
);

export const SovereignDisplay: React.FC = () => {
  return (
    <div className="w-full h-full min-h-[450px] md:min-h-[600px] relative overflow-hidden rounded-3xl bg-[#050505] border border-white/5 shadow-2xl cursor-grab active:cursor-grabbing">
      <ThreeErrorBoundary>
        <Suspense fallback={<LoadingState />}>
          <Canvas 
            dpr={[1, 1.5]} 
            shadows={false}
            gl={{ 
              antialias: true, 
              powerPreference: 'high-performance',
              alpha: false,
              stencil: false,
              depth: true
            }}
            className="rounded-3xl"
          >
            <SovereignRecovery />
            <PerspectiveCamera makeDefault fov={40} position={[0, 0, 18]} />
            <color attach="background" args={['#050505']} />
            
            <ambientLight intensity={1.5} />
            <directionalLight position={[10, 15, 10]} intensity={2.5} color="#ffffff" />
            <pointLight position={[-10, 5, -10]} intensity={1.5} color="#D4AF37" />

            <Bounds fit clip observe>
               <PhysicalHardware url="/dream_computer_setup.glb" />
            </Bounds>

            <OrbitControls 
               makeDefault 
               enableZoom={false} 
               autoRotate={false}
               enableDamping={true}
               dampingFactor={0.05}
            />
          </Canvas>
        </Suspense>
      </ThreeErrorBoundary>

      {/* Decorative Bezel Frames (No interactivity or labels) */}
      <div className="absolute top-0 left-0 w-24 h-24 border-t border-l border-gold/10 rounded-tl-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-24 h-24 border-b border-r border-gold/10 rounded-br-3xl pointer-events-none" />
    </div>
  );
};

useGLTF.preload('/dream_computer_setup.glb');

import React, { Suspense, Component, ReactNode, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, Center, PerspectiveCamera, Bounds, OrbitControls } from '@react-three/drei';

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
  const modelUrl = '/dream_computer_setup.glb';
  const [modelReady, setModelReady] = React.useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(modelUrl, { method: 'HEAD' })
      .then((res) => {
        if (mounted) setModelReady(res.ok);
      })
      .catch(() => {
        if (mounted) setModelReady(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="w-full h-full min-h-[450px] md:min-h-[600px] relative overflow-hidden rounded-3xl bg-[#050505] border border-white/5 shadow-2xl cursor-grab active:cursor-grabbing">
      {modelReady === false && (
        <div className="absolute top-3 left-3 right-3 z-40 rounded border border-red-500/40 bg-red-950/60 px-3 py-2 text-[11px] text-red-200">
          3D model not found at <span className="font-mono">{modelUrl}</span>. Add the file to <span className="font-mono">frontend/public</span>.
        </div>
      )}
      <ThreeErrorBoundary>
        <Suspense fallback={<LoadingState />}>
        <Canvas 
            dpr={[1, 1]} 
            shadows={false}
            frameloop="demand"
            gl={{ 
              antialias: false, 
              powerPreference: 'high-performance',
              alpha: false,
              stencil: false,
              depth: true,
              failIfMajorPerformanceCaveat: false,
            }}
            className="rounded-3xl"
          >
            <SovereignRecovery />
            <PerspectiveCamera makeDefault fov={40} position={[0, 0, 18]} />
            <color attach="background" args={['#050505']} />
            
            <ambientLight intensity={1.2} />
            <directionalLight position={[10, 15, 10]} intensity={2.0} color="#ffffff" />
            <pointLight position={[-10, 5, -10]} intensity={1.2} color="#D4AF37" />

            <Bounds fit clip observe>
               <PhysicalHardware url={modelUrl} />
            </Bounds>

            <OrbitControls 
               makeDefault 
               enableZoom={false} 
               autoRotate={true}
               autoRotateSpeed={0.4}
               enableDamping={true}
               dampingFactor={0.08}
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

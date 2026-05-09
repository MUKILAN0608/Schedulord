import React, { Suspense, Component, ReactNode, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, Center, PerspectiveCamera, Bounds, OrbitControls, Float } from '@react-three/drei';
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
  const safeScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj: any) => {
      if (!obj?.isMesh) return;
      // Preserve original glTF materials/textures so the real model appearance is retained.
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((m: THREE.Material) => m.clone());
        } else {
          obj.material = obj.material.clone();
        }
      }
      obj.castShadow = false;
      obj.receiveShadow = false;
    });
    return clone;
  }, [scene]);
  return (
    <Center>
      <primitive object={safeScene} />
    </Center>
  );
}

function ProceduralFallbackModel() {
  return (
    <Center>
      <Float speed={1.1} rotationIntensity={0.18} floatIntensity={0.3}>
        <group>
          <mesh position={[0, 0, 0]}>
            <icosahedronGeometry args={[2.35, 1]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.35} roughness={0.48} />
          </mesh>
          <mesh rotation={[0.55, 0.2, 0.4]}>
            <torusGeometry args={[3.2, 0.08, 28, 120]} />
            <meshStandardMaterial color="#8fd4ff" emissive="#0e2430" metalness={0.22} roughness={0.58} />
          </mesh>
          <mesh rotation={[-0.42, 0.6, -0.1]}>
            <torusGeometry args={[2.75, 0.06, 24, 90]} />
            <meshStandardMaterial color="#6cb88f" emissive="#102015" metalness={0.2} roughness={0.62} />
          </mesh>
        </group>
      </Float>
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
        if (!mounted) return;
        if (!res.ok) {
          setModelReady(false);
          return;
        }
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        const contentLength = Number(res.headers.get('content-length') || 0);
        const looksLikeModel =
          (contentType.includes('model/gltf-binary') || contentType.includes('application/octet-stream')) &&
          contentLength > 0;
        setModelReady(looksLikeModel);
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
          Model asset missing at <span className="font-mono">{modelUrl}</span>. Rendering safe fallback 3D view.
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
              {modelReady ? <PhysicalHardware url={modelUrl} /> : <ProceduralFallbackModel />}
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


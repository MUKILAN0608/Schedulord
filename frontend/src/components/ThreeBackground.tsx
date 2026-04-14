import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Stage, PresentationControls, Environment, ContactShadows, Bounds, Float } from '@react-three/drei';

function Model(props: any) {
  const { scene } = useGLTF('/setup.glb');
  return <primitive object={scene} {...props} />;
}

const ThreeBackground: React.FC = () => {
  return (
    <div className="w-full h-full bg-transparent">
      <Canvas 
        shadows 
        flat // Better for the White minimalist look
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 20 }}
        gl={{ alpha: true, antialias: true, stencil: false }}
      >
        <Suspense fallback={null}>
          <PresentationControls
            global
            config={{ mass: 1, tension: 200 }}
            snap={{ mass: 2, tension: 1000 }}
            rotation={[0, 0.3, 0]}
            polar={[-Math.PI / 12, Math.PI / 12]}
            azimuth={[-Math.PI / 4, Math.PI / 4]}
          >
            <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.2}>
              <Bounds fit clip observe margin={1}>
                {/* Environment Stage for High-Fidelity Reflections */}
                <Stage 
                  environment="city" 
                  intensity={0.8} 
                  contactShadow={false}
                  adjustCamera={true}
                >
                  <Model />
                </Stage>
              </Bounds>
            </Float>
          </PresentationControls>
          
          <ContactShadows 
            position={[0, -1.2, 0]} 
            opacity={0.06} 
            scale={15} 
            blur={2.5} 
            color="#D4AF37" 
          />
          
          {/* Studio HDRI */}
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ThreeBackground;

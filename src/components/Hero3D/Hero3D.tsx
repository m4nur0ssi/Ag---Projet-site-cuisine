'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
    Float, 
    Environment, 
    Text, 
    ContactShadows, 
    PresentationControls,
    PerspectiveCamera,
    Stars,
    Float as DreiFloat
} from '@react-three/drei';
import * as THREE from 'three';
import styles from './Hero3D.module.css';

function ExtrudedText({ 
    text, 
    position = [0, 0, 0] as [number, number, number], 
    fontSize, 
    color, 
    outlineColor 
}: { 
    text: string, 
    position?: [number, number, number], 
    fontSize: number, 
    color: string, 
    outlineColor: string 
}) {
    return (
        <group position={position}>
            {/* Front Layer - High Emissive for glow */}
            <Text
                fontSize={fontSize}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                maxWidth={5}
                lineHeight={1}
                outlineWidth={0.02}
                outlineColor={outlineColor}
                position={[0, 0, 0.1]}
            >
                {text}
                <meshStandardMaterial 
                    color="#ffffff" 
                    emissive={color} 
                    emissiveIntensity={0.5} 
                    metalness={1} 
                    roughness={0} 
                />
            </Text>
            
            {/* Back Layers for "Extrusion" depth */}
            {[...Array(8)].map((_, i) => (
                <Text
                    key={i}
                    fontSize={fontSize}
                    color={outlineColor}
                    anchorX="center"
                    anchorY="middle"
                    position={[0, 0, -i * 0.03]}
                >
                    {text}
                    <meshStandardMaterial 
                        color={outlineColor} 
                        metalness={0.9} 
                        roughness={0.3} 
                    />
                </Text>
            ))}
        </group>
    );
}

function Scene() {
    return (
        <>
            <Stars radius={50} depth={50} count={3000} factor={4} saturation={0.5} fade speed={1} />
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 10, 10]} intensity={2.5} color="#7f0df2" />
            <pointLight position={[-10, -10, -10]} intensity={1.5} color="#ff196a" />
            <spotLight 
                position={[0, 5, 10]} 
                angle={0.3} 
                penumbra={1} 
                intensity={3} 
                color="#ffffff" 
                castShadow 
            />
            
            <PresentationControls
                global
                config={{ mass: 3, tension: 400 }}
                snap={{ mass: 5, tension: 1200 }}
                rotation={[0, 0, 0]}
                polar={[-Math.PI / 6, Math.PI / 6]}
                azimuth={[-Math.PI / 3, Math.PI / 3]}
            >
                <DreiFloat speed={4} rotationIntensity={1.2} floatIntensity={1.5}>
                    <group position={[0, 0, 0]}>
                        <ExtrudedText 
                            text="RECETTES" 
                            fontSize={0.7} 
                            color="#ff196a" 
                            outlineColor="#ff196a" 
                            position={[0, 0.5, 0]} 
                        />
                        <ExtrudedText 
                            text="MAGIQUES" 
                            fontSize={1.1} 
                            color="#7f0df2" 
                            outlineColor="#7f0df2" 
                            position={[0, -0.6, 0]} 
                        />
                    </group>
                </DreiFloat>
            </PresentationControls>

            <ContactShadows 
                position={[0, -2.5, 0]} 
                opacity={0.4} 
                scale={12} 
                blur={3} 
                far={5} 
                color="#000000" 
            />
            <Environment preset="night" />
        </>
    );
}

export default function Hero3D() {
    return (
        <div className={styles.canvasContainer}>
            <Canvas 
                shadows 
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={35} />
                <Suspense fallback={null}>
                    <Scene />
                </Suspense>
            </Canvas>
        </div>
    );
}

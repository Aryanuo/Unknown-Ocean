import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, Group, Mesh, MeshStandardMaterial, DoubleSide, Color } from 'three'
import { CreatureDNA } from '../../store/usePlayerStore'

interface CreatureProps {
  dna: CreatureDNA
  initialPosition: Vector3
  id: number
  discovered: boolean
}

export function Creature3D({ dna, initialPosition, id, discovered }: CreatureProps) {
  const groupRef = useRef<Group>(null)
  const bodyRef = useRef<Mesh>(null)
  const tailRef = useRef<Mesh>(null)
  
  // Random offsets based on ID to desync animations
  const timeOffset = useRef(id * 13.37).current
  const targetPos = useRef(initialPosition.clone())
  const velocity = useRef(new Vector3((Math.random() - 0.5) * dna.speed, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * dna.speed))
  
  const scale = dna.size * 5

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime + timeOffset

    // 1. Movement logic (simple wander)
    // Slowly change target direction
    if (Math.random() < 0.01) {
      targetPos.current.add(new Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 30
      ))
      // Keep depth somewhat constrained
      targetPos.current.y = Math.min(-10, Math.max(initialPosition.y - 100, targetPos.current.y))
    }

    // Steer towards target
    const currentPos = groupRef.current.position
    const desired = targetPos.current.clone().sub(currentPos)
    const dist = desired.length()
    
    if (dist > 1) {
       desired.normalize().multiplyScalar(dna.speed * 8)
       const steer = desired.sub(velocity.current).clampLength(0, dna.speed * delta * 20)
       velocity.current.add(steer)
    }

    groupRef.current.position.addScaledVector(velocity.current, delta)
    
    if (velocity.current.lengthSq() > 0.01) {
       const lookAt = currentPos.clone().add(velocity.current)
       groupRef.current.lookAt(lookAt)
    }

    // 2. Vertex / Simple Procedural Animation
    // Swimming wiggle
    const swimSpeed = dna.speed * 3
    const wiggle = Math.sin(t * swimSpeed) * 0.3
    
    // Animate Tail
    if (tailRef.current) {
        tailRef.current.rotation.y = wiggle
    }
  })

  // Procedural Materials
  const bodyMaterial = useMemo(() => new MeshStandardMaterial({
    color: dna.primaryColor,
    roughness: 0.2,
    metalness: 0.1,
    emissive: new Color(dna.glowColor),
    emissiveIntensity: dna.glowIntensity > 0.5 ? dna.glowIntensity * 2 : 0,
    transparent: dna.transparency < 1,
    opacity: dna.transparency
  }), [dna])

  const finMaterial = useMemo(() => new MeshStandardMaterial({
    color: dna.secondaryColor,
    roughness: 0.5,
    metalness: 0.0,
    side: DoubleSide,
    transparent: true,
    opacity: 0.8
  }), [dna])

  return (
    <group ref={groupRef} position={initialPosition} scale={[scale, scale, scale]}>
      {/* Discovery indicator */}
      {!discovered && (
          <mesh position={[0, dna.bodyWidth * 1.5, 0]}>
             <sphereGeometry args={[dna.bodyLength * 0.8, 16, 16]} />
             <meshBasicMaterial 
               color="#00b4d8" 
               wireframe 
               transparent 
               opacity={0.3} 
             />
          </mesh>
      )}

      {/* Main Body */}
      <mesh ref={bodyRef}>
        <capsuleGeometry args={[dna.bodyWidth, dna.bodyLength, 8, 16]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>

      {/* Eyes */}
      {Array.from({ length: Math.min(dna.eyeCount, 2) }).map((_, i) => (
        <mesh key={`eye-${i}`} position={[dna.bodyWidth * 0.8 * (i === 0 ? 1 : -1), dna.bodyWidth * 0.5, dna.bodyLength * 0.4]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
        </mesh>
      ))}

      {/* Tail Group */}
      <group position={[0, 0, -dna.bodyLength * 0.5]} ref={tailRef}>
         <mesh position={[0, 0, -dna.bodyLength * 0.25]}>
            <coneGeometry args={[dna.bodyWidth * 0.8, dna.bodyLength * 0.5, 3]} />
            <primitive object={finMaterial} attach="material" />
         </mesh>
      </group>

      {/* Side Fins */}
      {Array.from({ length: Math.min(dna.finCount, 4) }).map((_, i) => {
         const angle = (i / Math.max(1, dna.finCount - 1)) * Math.PI - Math.PI / 2
         const finX = Math.cos(angle) * dna.bodyWidth
         const finZ = Math.sin(angle) * dna.bodyLength * 0.3
         return (
           <mesh key={`fin-${i}`} position={[finX, 0, finZ]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[dna.bodyWidth * 0.8, dna.bodyWidth * 1.5]} />
              <primitive object={finMaterial} attach="material" />
           </mesh>
         )
      })}
    </group>
  )
}

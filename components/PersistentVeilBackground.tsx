'use client';

import { usePathname } from 'next/navigation';
import DarkVeil from '@/components/DarkVeil';
import { GrainCanvas } from '@/components/GrainCanvas';

export function PersistentVeilBackground() {
  const pathname = usePathname();
  const visible = pathname === '/' || pathname === '/dashboard';

  return (
    <>
      <div
        className={`bg-darkveil-shell persistent-veil${visible ? ' is-visible' : ''}`}
        aria-hidden="true"
      >
        <div className="bg-darkveil-blur">
          <DarkVeil
            hueShift={54}
            noiseIntensity={0}
            scanlineIntensity={0}
            speed={0.42}
            warpAmount={0.1}
            resolutionScale={1}
          />
        </div>
      </div>
      <div className={`persistent-grain${visible ? ' is-visible' : ''}`} aria-hidden="true">
        <GrainCanvas />
      </div>
    </>
  );
}

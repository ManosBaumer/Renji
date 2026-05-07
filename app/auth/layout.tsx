import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="r-auth-layout">{children}</div>;
}

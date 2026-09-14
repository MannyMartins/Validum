import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Formularios EPS', description: 'Gestión documental por WhatsApp' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body style={{ fontFamily: 'system-ui', margin: '3rem', maxWidth: 1000 }}>{children}</body></html>; }

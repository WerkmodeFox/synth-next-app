import './globals.css';

export const metadata = {
  title: 'UX Lab Notes',
  description: 'A tiny hardware-style synth keyboard, built with Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

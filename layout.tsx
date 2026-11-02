import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE VICTORS | Community Hub",
  description: "Knowledge is Power. Unity is Strength. Success is Our Mission."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

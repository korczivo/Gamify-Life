import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { HudBar } from "@/components/hud/HudBar";
import { NavLinks } from "@/components/nav/NavLinks";
import { CelebrationProvider } from "@/components/hud/Celebrations";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });
const pricedown = localFont({
  src: "../fonts/pricedown.otf",
  variable: "--font-pricedown",
});
const dseg = localFont({
  src: "../fonts/dseg7-bold.woff2",
  variable: "--font-dseg",
});

export const metadata: Metadata = {
  title: "EMPIRE",
  description: "Grind missions. Run heists. Build the empire.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${oswald.variable} ${pricedown.variable} ${dseg.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <CelebrationProvider>
          <div className="flex min-h-screen">
            <aside className="w-52 shrink-0 border-r border-line bg-panel flex flex-col">
              <div className="px-5 py-6">
                <span className="display-font text-3xl text-gold leading-none">
                  EMPIRE
                </span>
              </div>
              <NavLinks />
              <div className="mt-auto px-5 py-4 text-[11px] text-muted hud-label">
                Los Santos, SA
              </div>
            </aside>
            <div className="flex-1 flex flex-col min-w-0">
              <HudBar />
              <main className="flex-1 p-6">{children}</main>
            </div>
          </div>
        </CelebrationProvider>
      </body>
    </html>
  );
}

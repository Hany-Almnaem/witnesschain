import Link from 'next/link';
import { Shield, Lock, Database, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Preserve Truth.
              <span className="text-primary"> Protect Evidence.</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              WitnessChain is a decentralized platform for preserving human rights
              evidence. Securely store, timestamp, and verify critical documentation
              using Filecoin&apos;s immutable storage.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button asChild size="lg">
                <Link href="/auth/connect">Get Started</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/about">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for Security and Transparency
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every piece of evidence is encrypted, timestamped, and stored on
              decentralized infrastructure.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={Shield}
                title="Privacy First"
                description="End-to-end encryption ensures only authorized parties can access your evidence."
              />
              <FeatureCard
                icon={Lock}
                title="Immutable Storage"
                description="Evidence stored on Filecoin cannot be altered or deleted by any party."
              />
              <FeatureCard
                icon={Database}
                title="Decentralized"
                description="No single point of failure. Your evidence persists across a global network."
              />
              <FeatureCard
                icon={CheckCircle}
                title="Verifiable"
                description="Blockchain timestamps prove when evidence was submitted and by whom."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 py-24 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to preserve evidence?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Connect your wallet to get started. Your identity remains
              pseudonymous and secure.
            </p>
            <div className="mt-10">
              <Button asChild size="lg">
                <Link href="/auth/connect">Connect Wallet</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} WitnessChain. Open source under MIT License.
            </p>
            <div className="flex gap-6">
              <Link
                href="https://github.com/Hany-Almnaem/witnesschain"
                className="text-sm text-muted-foreground hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </Link>
              <Link
                href="/docs"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Documentation
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

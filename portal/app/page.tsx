import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/home/Hero";
import CurvedLoop from "@/components/ui/curved-loop";
import EcosystemFlow from "@/components/home/EcosystemFlow";
import SalesAppShowcase from "@/components/home/SalesAppShowcase";
import ModuleOverview from "@/components/home/ModuleOverview";
import LandingCTA from "@/components/home/LandingCTA";
import ScrollVelocity from "@/components/ui/scroll-velocity";
import { DottedSurface } from "@/components/ui/dotted-surface";

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <CurvedLoop
        marqueeText="Our Portal features thats very impressive and industry level. ✦ "
        speed={2}
        curveAmount={-300}
      />
      <EcosystemFlow />
      <SalesAppShowcase />
      <ModuleOverview />
      <LandingCTA />
      <ScrollVelocity
        texts={['Empowering Global Enterprise Excellence', 'Automated Intelligence Realized']}
        velocity={30}
        damping={50}
        stiffness={400}
        className="opacity-100 transition-all duration-700"
      />
      <Footer />
    </main>
  );
}

import Header from "@/components/marketing/Header";
import Hero from "@/components/marketing/Hero";
import Benefits from "@/components/marketing/Benefits";
import Solutions from "@/components/marketing/Solutions";
import SavingsPreview from "@/components/marketing/SavingsPreview";
import Ecosystem from "@/components/marketing/Ecosystem";
import Projects from "@/components/marketing/Projects";
import Process from "@/components/marketing/Process";
import CTASection from "@/components/marketing/CTASection";
import Footer from "@/components/marketing/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Benefits />
        <Solutions />
        <SavingsPreview />
        <Ecosystem />
        <Projects />
        <Process />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}

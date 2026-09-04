import SolarCalculator from "@/components/SolarCalculator";
import Header from "@/components/marketing/Header";
import Footer from "@/components/marketing/Footer";

export default function CalculatorPage() {
  return (
    <div className="pt-16 lg:pt-20">
      <Header forceSolid />
      <SolarCalculator />
      <Footer />
    </div>
  );
}

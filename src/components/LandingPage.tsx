import React from 'react';
import { ArrowRight, Play, CheckCircle, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PatientSourceGraph } from '@/components/PatientSourceGraph';

interface LandingPageProps {
  onGetStarted: () => void;
  showAuth?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, showAuth = false }) => {
  if (showAuth) {
    // Return simplified auth version
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        <div className="flex min-h-screen">
          <div className="w-1/2 flex items-center justify-center p-6">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <div className="text-2xl font-bold text-primary mb-2">DentalFlow</div>
                <p className="text-muted-foreground">Connect to your patient flow dashboard</p>
              </div>
              {/* AuthForm would go here */}
            </div>
          </div>
          <div className="w-1/2 bg-primary/5 flex items-center justify-center p-12">
            <PatientSourceGraph className="w-full max-w-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="text-2xl font-bold text-primary">DentalFlow</div>
              <nav className="hidden md:flex items-center space-x-6">
                <a href="#services" className="text-muted-foreground hover:text-primary transition-colors">Services</a>
                <a href="#software" className="text-muted-foreground hover:text-primary transition-colors">Software</a>
                <a href="#reviews" className="text-muted-foreground hover:text-primary transition-colors">Reviews</a>
                <a href="#blog" className="text-muted-foreground hover:text-primary transition-colors">Blog</a>
                <a href="#company" className="text-muted-foreground hover:text-primary transition-colors">Company</a>
                <a href="#faqs" className="text-muted-foreground hover:text-primary transition-colors">FAQs</a>
                <a href="#careers" className="text-muted-foreground hover:text-primary transition-colors">Careers</a>
              </nav>
            </div>
            <Button onClick={onGetStarted} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Book Free Demo
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-primary font-medium text-sm uppercase tracking-wide">
                End-To-End Dental Patient Management
              </p>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight">
                Revolutionizing Dental 
                <span className="text-primary"> Patient Flow</span> with Cutting-
                Edge Technology
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                Our comprehensive patient flow management services are designed for dental practices to optimize patient acquisition, streamline operations, and maximize practice growth all while driving efficiency and profitability.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={onGetStarted} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Talk To Our Expert
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                <Play className="mr-2 h-4 w-4" />
                Watch Overview
              </Button>
            </div>
          </div>

          {/* Right Content - Patient Source Graph */}
          <div className="lg:pl-8">
            <PatientSourceGraph className="w-full" />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-border/50 hover:border-primary/30 transition-colors duration-300">
            <CardContent className="p-8">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Manage Your Complete Patient Flow
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Track and optimize every touchpoint in your patient journey from initial contact through treatment completion and follow-up care.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:border-primary/30 transition-colors duration-300">
            <CardContent className="p-8">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Free Yourself from Repetitive and Time-Consuming Tasks
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Automate appointment scheduling, follow-ups, and administrative tasks to focus more on patient care and practice growth.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:border-primary/30 transition-colors duration-300">
            <CardContent className="p-8">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Provide the Best Dental Experience For Your Patients
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Deliver personalized care with data-driven insights, streamlined communication, and seamless appointment management.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 border-y">
        <div className="container mx-auto px-6 py-16">
          <div className="text-center space-y-6">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Ready to Transform Your Practice?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join hundreds of dental practices that have streamlined their patient flow and increased their revenue with our comprehensive management system.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={onGetStarted} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="text-2xl font-bold text-primary">DentalFlow</div>
              <p className="text-muted-foreground">
                Revolutionizing dental practice management with cutting-edge technology.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Services</h4>
              <div className="space-y-2">
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">Patient Management</a>
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">Analytics</a>
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">Automation</a>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Company</h4>
              <div className="space-y-2">
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">About</a>
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">Careers</a>
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">Contact</a>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Support</h4>
              <div className="space-y-2">
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">Help Center</a>
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">Documentation</a>
                <a href="#" className="block text-muted-foreground hover:text-primary transition-colors">Privacy Policy</a>
              </div>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 DentalFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
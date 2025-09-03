import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthForm } from './AuthForm';
import { Building2, BarChart3, Users, Search, ArrowRight, CheckCircle, Globe, MessageSquare, MapPin, Star, TrendingUp } from 'lucide-react';
import { NexoraLogo } from '@/components/NexoraLogo';
import { AnimatedNexoraLogo } from '@/components/AnimatedNexoraLogo';

interface LandingPageProps {
  onGetStarted: () => void;
  showAuth?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, showAuth = false }) => {
  const features = [
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Patient Source Intelligence",
      description: "Track Google, Yelp, referrals, and walk-ins. Organize sources into dental offices, online platforms, and other channels."
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Partner Office Network", 
      description: "Manage relationships with referring practices, specialists, and other dental professionals in your network."
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Growth Analytics",
      description: "Visual reports and trend analysis to understand which sources drive the most valuable patients to your practice."
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Discovery & Outreach",
      description: "Find nearby practices, plan outreach visits, run targeted campaigns, and monitor online reviews."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-connection relative">
      {/* Header */}
      <header className="relative px-6 pt-8">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <NexoraLogo size={32} className="text-connection-primary" />
            <span className="text-2xl font-bold text-connection-text">Nexora</span>
          </div>
          {!showAuth && (
            <Button 
              variant="outline" 
              onClick={onGetStarted}
              className="border-connection-primary/30 text-connection-text hover:bg-connection-primary/10"
            >
              Sign In
            </Button>
          )}
        </nav>
      </header>

      <div className={`flex ${showAuth ? 'min-h-[calc(100vh-100px)] items-center' : ''}`}>
        {/* Main Content */}
        <div className={`${showAuth ? 'w-1/2 px-6' : 'w-full'} relative z-20`}>
          {/* Hero Section */}
          <section className={`${showAuth ? 'px-0' : 'px-6'} pt-20 pb-24`}>
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex justify-center mb-8">
                <AnimatedNexoraLogo size={120} className="text-connection-primary hover-scale" animate={true} />
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-connection-text mb-6 leading-tight">
                <span className="block animate-fade-in hover-scale" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                  Grow Your Practice.
                </span>
                <span className="block text-connection-primary font-light animate-fade-in" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
                  Nurture Your Network.
                </span>
                <span className="block text-2xl font-bold text-connection-text animate-fade-in" style={{ animationDelay: '1.1s', animationFillMode: 'both' }}>
                  with Nexora Dental
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-connection-muted mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '1.1s', animationFillMode: 'both' }}>
                Track referrals, measure patient sources, and grow your dental practice with intelligent network insights that drive organic growth.
              </p>
              
              {!showAuth && (
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '1.4s', animationFillMode: 'both' }}>
                  <Button 
                    size="lg"
                    onClick={onGetStarted}
                    className="bg-connection-primary hover:bg-connection-primary/90 text-white px-8 py-4 text-lg rounded-xl shadow-elegant hover:shadow-glow transition-all group hover-scale"
                  >
                    Start Growing Today
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              )}
            </div>
          </section>
          
          {!showAuth && (
            <>
              {/* Features Section */}
              <section className="px-6 py-24 bg-white/60 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto">
                  <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-connection-text mb-6">
                      Complete Practice Growth Platform
                    </h2>
                    <p className="text-lg text-connection-muted max-w-2xl mx-auto">
                      Everything you need to understand, track, and optimize your patient acquisition and referral network.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {features.map((feature, index) => (
                      <Card key={index} className="group hover:shadow-elegant transition-all duration-300 border-connection-primary/20 hover:border-connection-primary/40 bg-gradient-card">
                        <CardContent className="p-8 text-center">
                          <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-connection-bg flex items-center justify-center text-connection-primary group-hover:bg-connection-primary group-hover:text-white transition-all duration-300 shadow-sm">
                            {feature.icon}
                          </div>
                          <h3 className="text-xl font-semibold text-connection-text mb-4">
                            {feature.title}
                          </h3>
                          <p className="text-connection-muted leading-relaxed">
                            {feature.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </section>

              {/* Benefits Section */}
              <section className="relative z-20 px-6 py-24">
                <div className="max-w-4xl mx-auto">
                  <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-connection-text mb-6">
                      Built for Dental Practices
                    </h2>
                    <p className="text-lg text-connection-muted">
                      Designed specifically for dental professionals who want to grow through relationships and data-driven insights.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                      <ul className="space-y-6">
                        <li className="flex items-start space-x-4">
                          <CheckCircle className="w-6 h-6 text-connection-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-connection-text mb-2">Multi-Channel Tracking</h4>
                            <p className="text-connection-muted">Track patients from Google, Yelp, referrals, walk-ins, and more. Organize by dental offices, online sources, and other channels.</p>
                          </div>
                        </li>
                        <li className="flex items-start space-x-4">
                          <CheckCircle className="w-6 h-6 text-connection-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-connection-text mb-2">Partner Network Management</h4>
                            <p className="text-connection-muted">Manage relationships with referring specialists, general dentists, and other practices in your professional network.</p>
                          </div>
                        </li>
                        <li className="flex items-start space-x-4">
                          <CheckCircle className="w-6 h-6 text-connection-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-connection-text mb-2">Outreach Campaigns</h4>
                            <p className="text-connection-muted">Plan visits, run targeted campaigns, discover nearby practices, and monitor your online reputation—all in one platform.</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                    <div className="relative">
                      <div className="w-full h-64 bg-gradient-glow rounded-2xl flex items-center justify-center relative overflow-hidden border border-connection-primary/20">
                        <div className="flex items-center space-x-4">
                          <Building2 className="w-12 h-12 text-connection-primary opacity-80" />
                          <TrendingUp className="w-16 h-16 text-connection-primary" />
                          <Star className="w-10 h-10 text-connection-primary opacity-60" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="px-6 py-24 bg-connection-bg/30">
                <div className="max-w-4xl mx-auto text-center">
                  <h2 className="text-4xl md:text-5xl font-bold text-connection-text mb-6">
                    Ready to Grow Your Practice?
                  </h2>
                  <p className="text-lg text-connection-muted mb-12 max-w-2xl mx-auto">
                    Join dental practices that are already tracking their patient sources, nurturing professional relationships, 
                    and growing through intelligent network insights.
                  </p>
                  
                  <Button 
                    size="lg"
                    onClick={onGetStarted}
                    className="bg-connection-primary hover:bg-connection-primary/90 text-white px-12 py-6 text-xl shadow-elegant hover:shadow-glow transition-all group rounded-xl"
                  >
                    Start Your Growth Journey
                    <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </section>

              {/* Footer */}
              <footer className="bg-connection-text/95 text-white">
                <div className="max-w-6xl mx-auto px-6 py-16">
                  <div className="grid md:grid-cols-4 gap-8 mb-12">
                    {/* Company Info */}
                    <div className="md:col-span-1">
                      <div className="flex items-center space-x-3 mb-6">
                        <NexoraLogo size={40} className="text-connection-primary" />
                        <span className="text-2xl font-bold">Nexora</span>
                      </div>
                      <p className="text-white/70 mb-6 leading-relaxed">
                        Intelligent business growth platform helping dental practices track, analyze, and optimize their patient acquisition networks.
                      </p>
                      <div className="flex space-x-4">
                        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                          <MessageSquare className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                          <Globe className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                          <Building2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Product */}
                    <div>
                      <h3 className="font-semibold text-lg mb-6">Product</h3>
                      <ul className="space-y-4">
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Features</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Analytics</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Discovery</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Network Management</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Campaigns</Button></li>
                      </ul>
                    </div>

                    {/* Company */}
                    <div>
                      <h3 className="font-semibold text-lg mb-6">Company</h3>
                      <ul className="space-y-4">
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">About Us</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Careers</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Press</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Partners</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Contact</Button></li>
                      </ul>
                    </div>

                    {/* Support */}
                    <div>
                      <h3 className="font-semibold text-lg mb-6">Support</h3>
                      <ul className="space-y-4">
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Help Center</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Documentation</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">API Reference</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Community</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Status</Button></li>
                      </ul>
                    </div>
                  </div>

                  {/* Bottom Bar */}
                  <div className="border-t border-white/20 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                      <div className="text-white/60 text-sm">
                        © 2024 Nexora. All rights reserved.
                      </div>
                      <div className="flex space-x-6 text-sm">
                        <Button variant="ghost" className="text-white/60 hover:text-white p-0 h-auto font-normal">
                          Privacy Policy
                        </Button>
                        <Button variant="ghost" className="text-white/60 hover:text-white p-0 h-auto font-normal">
                          Terms of Service
                        </Button>
                        <Button variant="ghost" className="text-white/60 hover:text-white p-0 h-auto font-normal">
                          Cookie Policy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </footer>
            </>
          )}
        </div>

        {/* Auth Form Side Panel */}
        {showAuth && (
          <div className="w-1/2 flex items-center justify-center p-6 relative">
            <div className="w-full max-w-md bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-connection-primary/20 relative z-10">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <NexoraLogo size={24} className="text-connection-primary" />
                  <span className="text-xl font-semibold text-connection-text">Welcome Back</span>
                </div>
                <p className="text-connection-muted">Access your practice growth dashboard</p>
              </div>
              <AuthForm />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
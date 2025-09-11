import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthForm } from './AuthForm';
import { Building2, BarChart3, Users, Search, ArrowRight, CheckCircle, Globe, MessageSquare, MapPin, Star, TrendingUp, Brain, Bot } from 'lucide-react';
import { NexoraLogo } from '@/components/NexoraLogo';
import { AnimatedNexoraLogo } from '@/components/AnimatedNexoraLogo';
import featureDiscovery from '@/assets/feature-discovery.jpg';
import featureReviews from '@/assets/feature-reviews.jpg';
import featureAIInsights from '@/assets/feature-ai-insights.jpg';
import featurePatientSources from '@/assets/feature-patient-sources.jpg';
import featureAnalytics from '@/assets/feature-analytics.jpg';
import featureCampaigns from '@/assets/feature-campaigns.jpg';

interface LandingPageProps {
  onGetStarted: () => void;
  showAuth?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, showAuth = false }) => {
  const features = [
    {
      image: featureDiscovery,
      title: "Smart Office Discovery",
      description: "Find 100+ dental offices within 50 miles using advanced filters and discovery wizard."
    },
    {
      image: featureReviews,
      title: "Google Reviews Management",
      description: "Monitor all Google reviews across your network in one dashboard with sentiment analysis."
    },
    {
      image: featureAIInsights,
      title: "AI-Powered Insights",
      description: "AI analyzes relationship health and provides actionable practice growth recommendations."
    },
    {
      image: featurePatientSources,
      title: "Patient Source Intelligence",
      description: "Track Google, Yelp, referrals, and walk-ins with multi-channel integration."
    },
    {
      image: featureAnalytics,
      title: "Growth Analytics",
      description: "Visual reports, trend analysis, and performance dashboards for optimization."
    },
    {
      image: featureCampaigns,
      title: "Campaign Management",
      description: "Run targeted outreach campaigns with automated follow-ups and ROI tracking."
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

      <div className={`flex ${showAuth ? 'min-h-[calc(100vh-100px)] items-center flex-col md:flex-row' : ''}`}>
        {/* Main Content */}
        <div className={`${showAuth ? 'hidden md:block md:w-1/2 px-6' : 'w-full'} relative z-20`}>
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
                AI-powered practice growth platform with Google Reviews management, office discovery, and intelligent insights that drive measurable results.
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
              <section className="px-6 py-32">
                <div className="max-w-5xl mx-auto">
                  <div className="text-center mb-20">
                    <p className="text-2xl md:text-3xl text-connection-text max-w-4xl mx-auto leading-relaxed" style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 400 }}>
                      "From discovering offices to managing reviews, leveraging AI insights to tracking patient sources - we bring everything together in one intelligent platform."
                    </p>
                  </div>

                  <div className="space-y-32">
                    {features.map((feature, index) => (
                      <div key={index} className="relative">
                        {/* Connecting line */}
                        {index < features.length - 1 && (
                          <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-px h-16 bg-gradient-to-b from-connection-primary/20 to-transparent" />
                        )}
                        
                        {/* Feature content */}
                        <div className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-16`}>
                          {/* Image */}
                          <div className="w-full lg:w-1/2">
                            <div className="relative overflow-hidden rounded-2xl aspect-video">
                              <img 
                                src={feature.image} 
                                alt={feature.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="w-full lg:w-1/2 text-center lg:text-left">
                            <h3 className="text-3xl md:text-4xl font-bold text-connection-text mb-6">
                              {feature.title}
                            </h3>
                            <p className="text-xl text-connection-muted leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </div>
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
                            <h4 className="font-semibold text-connection-text mb-2">AI-Driven Practice Analysis</h4>
                            <p className="text-connection-muted">AI Assistant analyzes relationship health, identifies growth opportunities, and provides automated insights for better decision making.</p>
                          </div>
                        </li>
                        <li className="flex items-start space-x-4">
                          <CheckCircle className="w-6 h-6 text-connection-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-connection-text mb-2">Google Reviews & Reputation</h4>
                            <p className="text-connection-muted">Monitor all Google reviews across your network, track competitor ratings, and get alerts for new reviews requiring attention.</p>
                          </div>
                        </li>
                        <li className="flex items-start space-x-4">
                          <CheckCircle className="w-6 h-6 text-connection-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-connection-text mb-2">Advanced Office Discovery</h4>
                            <p className="text-connection-muted">Find offices within 50 miles, filter by specialties and ratings, import discovered data, and plan strategic outreach campaigns.</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                    <div className="relative">
                      <div className="w-full h-64 bg-gradient-glow rounded-2xl flex items-center justify-center relative overflow-hidden border border-connection-primary/20">
                        <div className="flex items-center space-x-4">
                          <Bot className="w-12 h-12 text-connection-primary opacity-80" />
                          <Star className="w-16 h-16 text-connection-primary" />
                          <Building2 className="w-10 h-10 text-connection-primary opacity-60" />
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
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">AI Assistant</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Google Reviews</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Office Discovery</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Competitive Intelligence</Button></li>
                        <li><Button variant="ghost" className="text-white/70 hover:text-white p-0 h-auto font-normal justify-start">Growth Analytics</Button></li>
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
          <div className="w-full md:w-1/2 flex items-center justify-center p-4 md:p-6 relative">
            <div className="w-full max-w-sm md:max-w-md bg-white/90 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-connection-primary/20 relative z-10">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <NexoraLogo size={24} className="text-connection-primary" />
                  <span className="text-xl font-semibold text-connection-text">Welcome Back</span>
                </div>
                <p className="text-connection-muted">Access your practice growth dashboard</p>
              </div>
              <AuthForm embedded />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
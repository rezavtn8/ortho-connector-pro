import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthForm } from './AuthForm';
import { Building2, BarChart3, Users, Search, ArrowRight, CheckCircle, Globe, MessageSquare, MapPin, Star, TrendingUp, Brain, Bot } from 'lucide-react';
import { NexoraLogo } from '@/components/NexoraLogo';
import { AnimatedNexoraLogo } from '@/components/AnimatedNexoraLogo';

// Feature images
import featureDiscovery from '@/assets/feature-discovery.jpg';
import featureReviews from '@/assets/feature-reviews.jpg';
import featureAiInsights from '@/assets/feature-ai-insights.jpg';
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
      icon: <Search className="w-8 h-8" />,
      title: "Smart Office Discovery",
      description: "Find 100+ dental offices within 50 miles using advanced filters. Search by specialties, ratings, patient volume, and practice types with our discovery wizard."
    },
    {
      icon: <Star className="w-8 h-8" />,
      title: "Google Reviews Management",
      description: "Monitor all Google reviews across your network in one dashboard. Track competitor ratings, get new review alerts, and analyze review sentiment trends."
    },
    {
      icon: <Bot className="w-8 h-8" />,
      title: "AI-Powered Insights",
      description: "AI analyzes relationship health, identifies outreach priorities, provides competitive intelligence, and generates actionable practice growth recommendations."
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Patient Source Intelligence",
      description: "Track Google, Yelp, referrals, and walk-ins with multi-channel integration. Organize by dental offices, online platforms, and referral sources."
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Growth Analytics",
      description: "Visual reports, trend analysis, and performance dashboards. Track patient acquisition metrics, source effectiveness, and relationship ROI."
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Campaign Management",
      description: "Run targeted outreach campaigns with automated follow-ups. Track engagement rates, measure campaign ROI, and optimize your marketing efforts."
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
              <section className="px-6 py-24 bg-white/60 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto">
                  <div className="text-center mb-16">
                    <p className="text-2xl md:text-3xl text-connection-text max-w-4xl mx-auto leading-relaxed" style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 400 }}>
                      "From discovering offices to managing reviews, leveraging AI insights to tracking patient sources - we bring everything together in one intelligent platform."
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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

              {/* Minimal Feature Explainer */}
              <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto">
                  {/* Feature 1 - Discovery */}
                  <div className="flex flex-col lg:flex-row items-center gap-8 mb-12">
                    <div className="lg:w-1/2">
                      <img 
                        src={featureDiscovery} 
                        alt="Office Discovery Dashboard" 
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>
                    <div className="lg:w-1/2">
                      <h3 className="text-2xl font-medium text-connection-primary mb-4">Smart Office Discovery</h3>
                      <p className="text-connection-muted text-lg leading-relaxed">Find 100+ dental offices within 50 miles using advanced search filters and intelligent matching.</p>
                    </div>
                  </div>

                  {/* Connecting Line */}
                  <div className="w-px h-8 bg-connection-primary/20 mx-auto mb-12"></div>

                  {/* Feature 2 - Reviews (Right aligned) */}
                  <div className="flex flex-col lg:flex-row-reverse items-center gap-8 mb-12">
                    <div className="lg:w-1/2">
                      <img 
                        src={featureReviews} 
                        alt="Google Reviews Dashboard" 
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>
                    <div className="lg:w-1/2">
                      <h3 className="text-2xl font-medium text-connection-primary mb-4">Google Reviews Management</h3>
                      <p className="text-connection-muted text-lg leading-relaxed">Monitor reviews across your network with automated alerts and sentiment analysis tracking.</p>
                    </div>
                  </div>

                  {/* Connecting Line */}
                  <div className="w-px h-8 bg-connection-primary/20 mx-auto mb-12"></div>

                  {/* Feature 3 - AI Insights */}
                  <div className="flex flex-col lg:flex-row items-center gap-8 mb-12">
                    <div className="lg:w-1/2">
                      <img 
                        src={featureAiInsights} 
                        alt="AI Insights Dashboard" 
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>
                    <div className="lg:w-1/2">
                      <h3 className="text-2xl font-medium text-connection-primary mb-4">AI-Powered Intelligence</h3>
                      <p className="text-connection-muted text-lg leading-relaxed">Get actionable insights and growth recommendations powered by advanced AI analysis.</p>
                    </div>
                  </div>

                  {/* Connecting Line */}
                  <div className="w-px h-8 bg-connection-primary/20 mx-auto mb-12"></div>

                  {/* Feature 4 - Patient Sources (Right aligned) */}
                  <div className="flex flex-col lg:flex-row-reverse items-center gap-8 mb-12">
                    <div className="lg:w-1/2">
                      <img 
                        src={featurePatientSources} 
                        alt="Patient Sources Tracking" 
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>
                    <div className="lg:w-1/2">
                      <h3 className="text-2xl font-medium text-connection-primary mb-4">Patient Source Intelligence</h3>
                      <p className="text-connection-muted text-lg leading-relaxed">Track and analyze patient acquisition from Google, Yelp, referrals, and walk-ins in one place.</p>
                    </div>
                  </div>

                  {/* Connecting Line */}
                  <div className="w-px h-8 bg-connection-primary/20 mx-auto mb-12"></div>

                  {/* Feature 5 - Analytics */}
                  <div className="flex flex-col lg:flex-row items-center gap-8 mb-12">
                    <div className="lg:w-1/2">
                      <img 
                        src={featureAnalytics} 
                        alt="Growth Analytics Dashboard" 
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>
                    <div className="lg:w-1/2">
                      <h3 className="text-2xl font-medium text-connection-primary mb-4">Growth Analytics</h3>
                      <p className="text-connection-muted text-lg leading-relaxed">Visualize performance trends and track ROI with comprehensive analytics dashboards.</p>
                    </div>
                  </div>

                  {/* Connecting Line */}
                  <div className="w-px h-8 bg-connection-primary/20 mx-auto mb-12"></div>

                  {/* Feature 6 - Campaigns (Right aligned) */}
                  <div className="flex flex-col lg:flex-row-reverse items-center gap-8">
                    <div className="lg:w-1/2">
                      <img 
                        src={featureCampaigns} 
                        alt="Campaign Management Interface" 
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>
                    <div className="lg:w-1/2">
                      <h3 className="text-2xl font-medium text-connection-primary mb-4">Campaign Management</h3>
                      <p className="text-connection-muted text-lg leading-relaxed">Run targeted outreach campaigns with automated follow-ups and engagement tracking.</p>
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
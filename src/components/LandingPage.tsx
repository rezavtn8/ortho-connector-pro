import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthForm } from './AuthForm';
import { PatientSourceGraph } from './PatientSourceGraph';
import { Activity, TrendingUp, Users, Search, ArrowRight, CheckCircle, Globe, MessageSquare, MapPin } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  showAuth?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, showAuth = false }) => {
  const features = [
    {
      icon: <Activity className="w-8 h-8" />,
      title: "Patient Source Tracking",
      description: "Google, Yelp, Word-of-mouth, Referring offices — track every patient's journey to your practice."
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Monthly Trends", 
      description: "Understand what's working and what's not with clear analytics and trend visualization."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Outreach Tools",
      description: "Stay in touch with key sources and nurture your most valuable professional relationships."
    },
    {
      icon: <Search className="w-8 h-8" />,
      title: "Visual Dashboard",
      description: "See the full network in one view with interactive maps and connection insights."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-connection relative">
      {/* Header */}
      <header className="relative px-6 pt-8">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity size={32} className="text-connection-primary" />
            <span className="text-2xl font-bold text-connection-text">PatientFlow</span>
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
              <h1 className="text-5xl md:text-6xl font-bold text-connection-text mb-6 leading-tight">
                Track the Source.
                <span className="block text-connection-primary font-light">Understand the Growth.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-connection-muted mb-12 max-w-3xl mx-auto leading-relaxed">
                Every patient has a path — visualize where they came from and optimize what brings them to your practice.
              </p>
              
              {!showAuth && (
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button 
                    size="lg"
                    onClick={onGetStarted}
                    className="bg-connection-primary hover:bg-connection-primary/90 text-white px-8 py-4 text-lg rounded-xl shadow-elegant hover:shadow-glow transition-all group"
                  >
                    Explore Patient Flow
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              )}
            </div>
          </section>
          
          {!showAuth && (
            <>
              {/* Patient Source Graph Section */}
              <section className="relative z-20 px-6 py-16">
                <div className="max-w-5xl mx-auto">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-connection-text mb-4">
                      Visualize Your Patient Network
                    </h2>
                    <p className="text-lg text-connection-muted max-w-2xl mx-auto">
                      See how patients flow to your practice from every source — from Google searches to professional referrals. Click or hover any source to highlight its connection.
                    </p>
                  </div>
                  
                  <PatientSourceGraph className="mx-auto" />
                  
                  {/* Interactive callout */}
                  <div className="mt-8 text-center">
                    <p className="text-sm text-connection-muted/80 italic">
                      💡 Try hovering over any source above to see its connection light up
                    </p>
                  </div>
                </div>
              </section>

              {/* Features Section */}
              <section className="px-6 py-24 bg-white/60 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto">
                  <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-connection-text mb-6">
                      Connected Intelligence
                    </h2>
                    <p className="text-lg text-connection-muted max-w-2xl mx-auto">
                      Transform scattered patient data into a clear network of sources and connections 
                      that drive your practice growth.
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
                      See the Full Picture
                    </h2>
                    <p className="text-lg text-connection-muted">
                      Transform scattered patient data into meaningful connections and actionable growth insights.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                      <ul className="space-y-6">
                        <li className="flex items-start space-x-4">
                          <CheckCircle className="w-6 h-6 text-connection-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-connection-text mb-2">Source Intelligence</h4>
                            <p className="text-connection-muted">Automatically track and categorize every patient source from Google searches to professional referrals.</p>
                          </div>
                        </li>
                        <li className="flex items-start space-x-4">
                          <CheckCircle className="w-6 h-6 text-connection-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-connection-text mb-2">Connection Mapping</h4>
                            <p className="text-connection-muted">Visualize your referral network and discover the most valuable relationships driving your growth.</p>
                          </div>
                        </li>
                        <li className="flex items-start space-x-4">
                          <CheckCircle className="w-6 h-6 text-connection-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-connection-text mb-2">Smart Outreach</h4>
                            <p className="text-connection-muted">Get prompted to follow up with key sources and maintain the relationships that matter most.</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                    <div className="relative">
                      <div className="w-full h-64 bg-gradient-glow rounded-2xl flex items-center justify-center relative overflow-hidden border border-connection-primary/20">
                        <Activity className="w-16 h-16 text-connection-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="px-6 py-24 bg-connection-bg/30">
                <div className="max-w-4xl mx-auto text-center">
                  <h2 className="text-4xl md:text-5xl font-bold text-connection-text mb-6">
                    Ready to Connect?
                  </h2>
                  <p className="text-lg text-connection-muted mb-12 max-w-2xl mx-auto">
                    Join practices that are already mapping their patient sources and building 
                    stronger referral networks with data-driven insights.
                  </p>
                  
                  <Button 
                    size="lg"
                    onClick={onGetStarted}
                    className="bg-connection-primary hover:bg-connection-primary/90 text-white px-12 py-6 text-xl shadow-elegant hover:shadow-glow transition-all group rounded-xl"
                  >
                    Map Your Network
                    <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Auth Form Side Panel */}
        {showAuth && (
          <div className="w-1/2 flex items-center justify-center p-6 relative">
            <div className="w-full max-w-md bg-white/90 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-connection-primary/20 relative z-10">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <Activity size={24} className="text-connection-primary" />
                  <span className="text-xl font-semibold text-connection-text">Welcome Back</span>
                </div>
                <p className="text-connection-muted">Connect to your patient flow dashboard</p>
              </div>
              <AuthForm />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
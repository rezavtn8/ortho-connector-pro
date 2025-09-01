import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VineDecoration } from './VineDecoration';
import { LeafIcon } from './LeafIcon';
import { Network, TrendingUp, Users, Target, ArrowRight, CheckCircle } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const features = [
    {
      icon: <Target className="w-8 h-8" />,
      title: "Track Referrals",
      description: "Monitor monthly office referrals with precision and identify your strongest professional connections."
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Measure Patient Sources", 
      description: "See what drives Google, Yelp, and walk-ins to understand your marketing effectiveness."
    },
    {
      icon: <Network className="w-8 h-8" />,
      title: "Visualize Growth",
      description: "Map your network and see it flourish over time with beautiful, intuitive analytics."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Strengthen Connections",
      description: "Follow up and grow your most valuable relationships with automated insights and reminders."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-vine relative overflow-hidden">
      {/* Decorative Vines */}
      <VineDecoration position="left" className="opacity-30" />
      <VineDecoration position="right" className="opacity-30" />
      <VineDecoration position="top" className="opacity-20" />
      
      {/* Header */}
      <header className="relative z-20 px-6 pt-8">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LeafIcon size={32} className="text-leaf" />
            <span className="text-2xl font-bold text-sage-dark">GrowthVine</span>
          </div>
          <Button 
            variant="outline" 
            onClick={onGetStarted}
            className="border-sage-medium text-sage-dark hover:bg-sage-light"
          >
            Sign In
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-20 px-6 pt-20 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-bold text-sage-dark mb-6 leading-tight">
            Grow with
            <span className="block text-leaf">Intention.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-sage-dark/80 mb-12 max-w-3xl mx-auto leading-relaxed">
            Track the sources behind every patient. Nurture the network that grows your practice.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg"
              onClick={onGetStarted}
              className="bg-leaf hover:bg-leaf/90 text-white px-8 py-4 text-lg shadow-elegant group"
            >
              Explore the Network
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Floating leaves decoration */}
          <div className="absolute top-1/2 left-1/4 animate-float" style={{ animationDelay: '0s' }}>
            <LeafIcon size={20} className="text-leaf opacity-40" />
          </div>
          <div className="absolute top-1/3 right-1/4 animate-float" style={{ animationDelay: '2s' }}>
            <LeafIcon size={16} className="text-leaf opacity-30" />
          </div>
          <div className="absolute bottom-1/4 left-1/3 animate-float" style={{ animationDelay: '4s' }}>
            <LeafIcon size={18} className="text-leaf opacity-35" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-20 px-6 py-24 bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-sage-dark mb-6">
              Your Practice, Naturally Growing
            </h2>
            <p className="text-lg text-sage-dark/70 max-w-2xl mx-auto">
              Like vines that find the best path to sunlight, discover the connections 
              that help your practice flourish.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-elegant transition-all duration-300 border-sage-light/50 hover:border-leaf/30 bg-gradient-card">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-sage-light flex items-center justify-center text-leaf group-hover:bg-leaf group-hover:text-white transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-sage-dark mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-sage-dark/70 leading-relaxed">
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
            <h2 className="text-4xl md:text-5xl font-bold text-sage-dark mb-6">
              Cultivate Success
            </h2>
            <p className="text-lg text-sage-dark/70">
              Transform scattered data into meaningful insights that drive sustainable practice growth.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <ul className="space-y-6">
                <li className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-leaf flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-sage-dark mb-2">Organic Growth Tracking</h4>
                    <p className="text-sage-dark/70">Watch your referral network expand naturally with clear visualization of connection strength.</p>
                  </div>
                </li>
                <li className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-leaf flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-sage-dark mb-2">Intelligent Insights</h4>
                    <p className="text-sage-dark/70">Discover patterns in patient sources and referral behaviors you never noticed before.</p>
                  </div>
                </li>
                <li className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-leaf flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-sage-dark mb-2">Relationship Nurturing</h4>
                    <p className="text-sage-dark/70">Automated reminders help you maintain and strengthen your most valuable professional connections.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="w-full h-64 bg-sage-light/30 rounded-2xl flex items-center justify-center relative overflow-hidden">
                <Network className="w-24 h-24 text-leaf opacity-60" />
                {/* Decorative vine overlay */}
                <VineDecoration position="right" className="opacity-20 scale-75" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-20 px-6 py-24 bg-sage-light/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-sage-dark mb-6">
            Ready to Grow?
          </h2>
          <p className="text-lg text-sage-dark/70 mb-12 max-w-2xl mx-auto">
            Join practices that are already seeing organic growth through intelligent 
            referral tracking and relationship management.
          </p>
          
          <Button 
            size="lg"
            onClick={onGetStarted}
            className="bg-leaf hover:bg-leaf/90 text-white px-12 py-6 text-xl shadow-elegant group"
          >
            Start Growing Today
            <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      {/* Bottom vine decoration */}
      <VineDecoration position="bottom" className="opacity-20" />
    </div>
  );
};
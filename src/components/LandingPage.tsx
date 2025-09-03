import React, { useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthForm } from './AuthForm';
import { AnimatedNexoraLogo } from '@/components/AnimatedNexoraLogo';
import { FloatingElements } from '@/components/FloatingElements';
import { CountUpNumber } from '@/components/CountUpNumber';
import { 
  BarChart3, 
  Star, 
  Network, 
  Play, 
  ArrowRight, 
  Users, 
  TrendingUp, 
  Shield,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  showAuth?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, showAuth = false }) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
    
    onGetStarted();
  };

  const features = [
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "360° Practice Intelligence",
      description: "AI-powered scoring shows you exactly which referring dentists drive growth and who needs attention",
      gradient: "from-connection-primary to-connection-secondary"
    },
    {
      icon: <Star className="w-8 h-8" />,
      title: "Google Review Domination", 
      description: "Automated review requests at the perfect moment. Watch your Google rating soar.",
      gradient: "from-connection-accent to-connection-primary"
    },
    {
      icon: <Network className="w-8 h-8" />,
      title: "Smart Referral Tracking",
      description: "Finally know if that lunch meeting or gift basket actually brought in patients",
      gradient: "from-connection-secondary to-connection-accent"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-connection animate-mesh-gradient relative overflow-hidden">
      <FloatingElements />
      
      {/* Header */}
      <header className="relative px-6 pt-8 z-20">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div 
            className="flex items-center space-x-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <AnimatedNexoraLogo size={40} className="text-connection-primary" animate={true} />
            <span className="text-2xl font-bold text-connection-text">NexoraDental</span>
          </motion.div>
          {!showAuth && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Button 
                variant="outline" 
                onClick={onGetStarted}
                className="glass-morphism border-connection-primary/30 text-connection-text hover:bg-connection-primary/10 hover:border-connection-primary/50 transition-all duration-300"
              >
                Sign In
              </Button>
            </motion.div>
          )}
        </nav>
      </header>

      <div className={`flex ${showAuth ? 'min-h-[calc(100vh-100px)] items-center' : ''} relative z-10`}>
        {/* Main Content */}
        <div className={`${showAuth ? 'w-1/2 px-6' : 'w-full'} relative`}>
          {/* Hero Section */}
          <section className={`${showAuth ? 'px-0' : 'px-6'} pt-20 pb-16`}>
            <div className="max-w-5xl mx-auto text-center">
              <motion.div 
                className="flex justify-center mb-12"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <AnimatedNexoraLogo size={140} className="text-connection-primary drop-shadow-2xl" animate={true} />
              </motion.div>
              
              <motion.h1 
                className="text-6xl md:text-7xl font-bold text-connection-text mb-6 leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                Command Your
                <br />
                <span className="text-transparent bg-gradient-to-r from-connection-primary to-connection-accent bg-clip-text">
                  Practice Growth
                </span>
              </motion.h1>
              
              <motion.p 
                className="text-xl md:text-2xl text-connection-muted mb-12 max-w-4xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                The intelligent platform that masters referrals, reviews, and relationships for ambitious dental practices
              </motion.p>
              
              {!showAuth && (
                <motion.div 
                  className="flex flex-col sm:flex-row gap-6 justify-center items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                >
                  <Button 
                    size="lg"
                    onClick={handleButtonClick}
                    className="relative overflow-hidden bg-gradient-to-r from-connection-primary to-connection-secondary hover:from-connection-secondary hover:to-connection-primary text-white px-10 py-6 text-xl rounded-2xl shadow-elegant hover:shadow-glow transition-all duration-300 group border-0"
                  >
                    {ripples.map(ripple => (
                      <span
                        key={ripple.id}
                        className="absolute bg-white/20 rounded-full animate-ripple"
                        style={{
                          left: ripple.x - 2,
                          top: ripple.y - 2,
                          width: 4,
                          height: 4,
                        }}
                      />
                    ))}
                    Start Your 30-Day Free Trial
                    <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  
                  <Button 
                    variant="outline"
                    size="lg"
                    className="glass-card border-connection-primary/30 text-connection-text hover:bg-connection-primary/5 px-10 py-6 text-xl rounded-2xl transition-all duration-300 group hover:border-connection-primary/50"
                  >
                    <Play className="mr-3 w-6 h-6 group-hover:scale-110 transition-transform" />
                    See It In Action
                  </Button>
                </motion.div>
              )}
            </div>
          </section>
          
          {!showAuth && (
            <>
              {/* Trust Indicators Bar */}
              <section className="px-6 py-16 bg-gradient-glass rounded-3xl mx-6 mb-16 glass-card">
                <div className="max-w-5xl mx-auto">
                  <div className="grid md:grid-cols-3 gap-8 text-center">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                      viewport={{ once: true }}
                    >
                      <div className="text-4xl font-bold text-connection-primary mb-2">
                        <CountUpNumber end={500} suffix="+" />
                      </div>
                      <p className="text-connection-muted">Dental Practices Trust NexoraDental</p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      viewport={{ once: true }}
                    >
                      <div className="text-4xl font-bold text-connection-primary mb-2">
                        <CountUpNumber end={156} />
                      </div>
                      <p className="text-connection-muted">New Patients Per Month Average</p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                      viewport={{ once: true }}
                    >
                      <div className="text-4xl font-bold text-connection-primary mb-2 flex items-center justify-center gap-2">
                        <CountUpNumber end={4.7} />
                        <Star className="w-8 h-8 fill-current text-yellow-400" />
                      </div>
                      <p className="text-connection-muted">Average Google Rating Achieved</p>
                    </motion.div>
                  </div>
                </div>
              </section>

              {/* Features Section */}
              <section className="px-6 py-24">
                <div className="max-w-6xl mx-auto">
                  <motion.div 
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                  >
                    <h2 className="text-5xl md:text-6xl font-bold text-connection-text mb-6">
                      Where Smart Dentists
                      <br />
                      <span className="text-transparent bg-gradient-to-r from-connection-primary to-connection-accent bg-clip-text">
                        Build Empires
                      </span>
                    </h2>
                    <p className="text-xl text-connection-muted max-w-3xl mx-auto leading-relaxed">
                      One intelligent platform to master patient referrals, dominate Google reviews, 
                      and track every marketing dollar's impact. Join 500+ practices growing with NexoraDental.
                    </p>
                  </motion.div>

                  <div className="grid md:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.2 }}
                        viewport={{ once: true }}
                        whileHover={{ 
                          y: -10,
                          rotateX: 5,
                          rotateY: 5,
                        }}
                        className="perspective-1000"
                      >
                        <Card className="group glass-card border-connection-primary/20 hover:border-connection-primary/40 transition-all duration-500 hover:shadow-glow relative overflow-hidden">
                          <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                          <CardContent className="p-8 text-center relative z-10">
                            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white group-hover:scale-110 transition-all duration-500 shadow-elegant`}>
                              {feature.icon}
                            </div>
                            <h3 className="text-2xl font-bold text-connection-text mb-4 group-hover:text-connection-primary transition-colors">
                              {feature.title}
                            </h3>
                            <p className="text-connection-muted leading-relaxed text-lg">
                              {feature.description}
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="px-6 py-24 bg-gradient-glass rounded-3xl mx-6 mb-16 glass-card relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-connection-primary/5 to-connection-accent/5" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                  >
                    <Sparkles className="w-16 h-16 text-connection-accent mx-auto mb-6 animate-pulse" />
                    <h2 className="text-5xl md:text-6xl font-bold text-connection-text mb-6">
                      Ready to Dominate?
                    </h2>
                    <p className="text-xl text-connection-muted mb-8 max-w-2xl mx-auto leading-relaxed">
                      No credit card required • 30-day money-back guarantee • Cancel anytime
                    </p>
                    
                    <Button 
                      size="lg"
                      onClick={handleButtonClick}
                      className="relative overflow-hidden bg-gradient-to-r from-connection-primary to-connection-secondary hover:from-connection-secondary hover:to-connection-primary text-white px-12 py-6 text-xl shadow-elegant hover:shadow-glow transition-all duration-300 group rounded-2xl border-0"
                    >
                      Start Your Empire Today
                      <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </motion.div>
                </div>
              </section>

              {/* Footer */}
              <footer className="bg-connection-text/95 text-white rounded-t-3xl">
                <div className="max-w-6xl mx-auto px-6 py-16">
                  <div className="grid md:grid-cols-4 gap-8 mb-12">
                    <div className="md:col-span-1">
                      <div className="flex items-center space-x-3 mb-6">
                        <AnimatedNexoraLogo size={40} className="text-connection-primary" animate={true} />
                        <span className="text-2xl font-bold">NexoraDental</span>
                      </div>
                      <p className="text-white/70 mb-6 leading-relaxed">
                        The intelligent platform that masters referrals, reviews, and relationships for ambitious dental practices.
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-lg mb-6">Features</h3>
                      <ul className="space-y-3 text-white/70">
                        <li className="hover:text-white transition-colors cursor-pointer">Practice Intelligence</li>
                        <li className="hover:text-white transition-colors cursor-pointer">Review Management</li>
                        <li className="hover:text-white transition-colors cursor-pointer">Referral Tracking</li>
                        <li className="hover:text-white transition-colors cursor-pointer">Analytics Dashboard</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-lg mb-6">Company</h3>
                      <ul className="space-y-3 text-white/70">
                        <li className="hover:text-white transition-colors cursor-pointer">About Us</li>
                        <li className="hover:text-white transition-colors cursor-pointer">Success Stories</li>
                        <li className="hover:text-white transition-colors cursor-pointer">Support</li>
                        <li className="hover:text-white transition-colors cursor-pointer">Contact</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-lg mb-6">Legal</h3>
                      <ul className="space-y-3 text-white/70">
                        <li className="hover:text-white transition-colors cursor-pointer">Privacy Policy</li>
                        <li className="hover:text-white transition-colors cursor-pointer">Terms of Service</li>
                        <li className="hover:text-white transition-colors cursor-pointer">Cookie Policy</li>
                        <li className="hover:text-white transition-colors cursor-pointer">HIPAA Compliance</li>
                      </ul>
                    </div>
                  </div>

                  <div className="border-t border-white/20 pt-8 text-center">
                    <p className="text-white/60">
                      © 2024 NexoraDental. All rights reserved. Built for dental practices that refuse to settle.
                    </p>
                  </div>
                </div>
              </footer>
            </>
          )}
        </div>

        {/* Auth Form Side Panel */}
        {showAuth && (
          <motion.div 
            className="w-1/2 flex items-center justify-center p-6 relative"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, type: "spring", damping: 20 }}
          >
            <div className="w-full max-w-md glass-card rounded-3xl p-10 shadow-glass border border-connection-primary/20 relative z-10">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center space-x-3 mb-6">
                  <AnimatedNexoraLogo size={32} className="text-connection-primary" animate={true} />
                  <span className="text-2xl font-bold text-connection-text">Welcome Back</span>
                </div>
                <p className="text-connection-muted text-lg">Access your practice growth dashboard</p>
              </div>
              <AuthForm />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
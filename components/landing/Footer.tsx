"use client";

import { animate, motion, useMotionValue, useSpring } from "motion/react";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const svgViewBox = { width: 440, height: 80 };

  const x = useMotionValue(svgViewBox.width / 2);
  const y = useMotionValue(svgViewBox.height / 2);

  const springConfig = { damping: 200, stiffness: 300, mass: 0.5 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const loopingAnimX = useRef<ReturnType<typeof animate> | null>(null);
  const loopingAnimY = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    let initialAnimX: ReturnType<typeof animate> | undefined;
    let initialAnimY: ReturnType<typeof animate> | undefined;

    if (!isHovered) {
      const fromX = x.get();
      const toX = svgViewBox.width;
      const fullDurationX = 10;
      const durationX = fullDurationX * (Math.abs(toX - fromX) / svgViewBox.width);

      initialAnimX = animate(x, toX, {
        duration: durationX,
        ease: "linear",
        onComplete: () => {
          loopingAnimX.current = animate(x, [toX, 0], {
            duration: fullDurationX,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "linear",
          });
        },
      });

      const fromY = y.get();
      const toY = svgViewBox.height * 0.8;
      const waypointA = svgViewBox.height * 0.8;
      const waypointB = svgViewBox.height * 0.2;
      const fullDurationY = 8;
      const durationY = fullDurationY * (Math.abs(toY - fromY) / Math.abs(waypointA - waypointB));

      initialAnimY = animate(y, toY, {
        duration: durationY,
        ease: "linear",
        onComplete: () => {
          loopingAnimY.current = animate(y, [toY, waypointB], {
            duration: fullDurationY,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "linear",
          });
        },
      });
    }

    return () => {
      initialAnimX?.stop();
      initialAnimY?.stop();
      loopingAnimX.current?.stop();
      loopingAnimX.current = null;
      loopingAnimY.current?.stop();
      loopingAnimY.current = null;
    };
  }, [isHovered, x, y, svgViewBox.width, svgViewBox.height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const svgX = (mouseX / rect.width) * svgViewBox.width;
      const svgY = (mouseY / rect.height) * svgViewBox.height;

      x.set(svgX);
      y.set(svgY);
    }
  };

  const handleMouseOver = () => {
    setIsHovered(true);
  };

  const handleMouseOut = () => {
    setIsHovered(false);
  };

  return (
    <footer className={`border-t border-border/80 pt-16 pb-12 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <Layers className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold text-foreground">SketchItUp</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enterprise ERP platform makers and creator of the unified Task Management Suite for high-performance organizations.
            </p>
          </div>

          <div>
            <h5 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">Product</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features Matrix</a></li>
              <li><a href="#demo" className="hover:text-foreground transition-colors">ERP Integration</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a></li>
              <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Launch Workspace</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">ERP Platform</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><span className="text-muted-foreground/80">Inventory & Supply Chain</span></li>
              <li><span className="text-muted-foreground/80">Financial Accounting</span></li>
              <li><span className="text-muted-foreground/80">Manufacturing Operations</span></li>
              <li><span className="text-muted-foreground/80">CRM & Client Records</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">Enterprise</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><a href="#faq" className="hover:text-foreground transition-colors">Security & RBAC</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">Compliance & SLA</a></li>
              <li><Link href="/sign-in" className="hover:text-foreground transition-colors">Tenant Sign In</Link></li>
              <li><span className="text-muted-foreground/80">API & Webhooks</span></li>
            </ul>
          </div>
        </div>

        {/* Animated Big Logo Visual */}
        <div
          ref={containerRef}
          className="flex h-[90px] items-center justify-center overflow-hidden border-y border-border/40 py-2 my-8"
          onMouseMove={handleMouseMove}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
        >
          <svg width="100%" height="90" viewBox="0 0 440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Text "SketchItUp" */}
            <text
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
              className="font-bold fill-foreground"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '42px', letterSpacing: '-0.03em', fontWeight: 800 }}
            >
              SketchItUp
            </text>
            
            {/* Animated gradient circle */}
            <g mask="url(#sketchitup-text-mask)">
              <motion.circle
                animate={{
                  rotate: 360,
                }}
                transition={{
                  rotate: {
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                  },
                }}
                cx={smoothX}
                cy={smoothY}
                r="50"
                fill="url(#circle-rgb-gradient)"
                filter="url(#blur-filter)"
              />
            </g>
            
            <defs>
              <filter id="blur-filter" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
              </filter>
              <mask id="sketchitup-text-mask">
                <rect x="0" y="0" width="440" height="80" fill="black" />
                <text
                  x="50%"
                  y="50%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill="white"
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: '42px', letterSpacing: '-0.03em', fontWeight: 800 }}
                >
                  SketchItUp
                </text>
              </mask>
              <linearGradient id="circle-rgb-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0.125" stopColor="#3B82F6" />
                <stop offset="0.26" stopColor="#8B5CF6" />
                <stop offset="0.39" stopColor="#EC4899" />
                <stop offset="0.52" stopColor="#10B981" />
                <stop offset="0.65" stopColor="#F59E0B" />
                <stop offset="0.78" stopColor="#6366F1" />
                <stop offset="0.91" stopColor="#14B8A6" />
                <stop offset="1" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        {/* Footer Info */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SketchItUp ERP Platform. Enterprise Task Management Suite. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

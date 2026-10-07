"use client";
import React from 'react';
import { 
  Navbar, 
  NavBody, 
  MobileNav, 
  MobileNavHeader, 
  MobileNavMenu, 
  MobileNavToggle, 
  NavbarLogo, 
  NavbarButton,
  NavItems 
} from '@/components/ui/resizable-navbar';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface CustomNavbarProps {
  className?: string;
}

const navItems = [
  { name: "Features", link: "#features" },
  { name: "ERP Suite", link: "#demo" },
  { name: "How It Works", link: "#how-it-works" },
  { name: "FAQ", link: "#faq" },
];

export const CustomNavbar: React.FC<CustomNavbarProps> = ({ className }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <Navbar className={className}>
      {/* Desktop Navigation */}
      <NavBody>
        <NavbarLogo />
        <NavItems items={navItems} />
        <div className="flex items-center gap-3">
          <Link 
            href="/sign-in" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
          >
            Sign In
          </Link>
          <NavbarButton href="/dashboard" variant="primary">
            <span className="flex items-center gap-1.5">
              Launch Suite
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </NavbarButton>
        </div>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle
            isOpen={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        </MobileNavHeader>
        <MobileNavMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        >
          <div className="flex flex-col gap-3 w-full">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md transition-colors"
              >
                {item.name}
              </a>
            ))}
            <div className="h-px bg-border my-2" />
            <Link
              href="/sign-in"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign In
            </Link>
            <NavbarButton href="/dashboard" variant="primary">
              Launch Task Suite
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
};

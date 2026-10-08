"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

interface NavbarContextType {
  visible: boolean;
}

const NavbarContext = createContext<NavbarContextType>({ visible: false });

export const useNavbar = () => useContext(NavbarContext);

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
  }[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible(window.scrollY > 30);
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <NavbarContext.Provider value={{ visible }}>
      <header
        className={cn(
          "sticky inset-x-0 top-0 z-40 w-full transition-[padding,background-color] duration-200",
          className
        )}
      >
        {children}
      </header>
    </NavbarContext.Provider>
  );
};

export const NavBody = ({ children, className, visible: explicitVisible }: NavBodyProps) => {
  const context = useNavbar();
  const visible = explicitVisible !== undefined ? explicitVisible : context.visible;

  return (
    <div
      className={cn(
        "relative z-[60] mx-auto hidden lg:flex items-center justify-between transition-all duration-200 ease-out",
        visible
          ? "max-w-5xl rounded-full bg-background/85 dark:bg-neutral-950/85 backdrop-blur-md px-5 py-2.5 shadow-lg border border-border/80 mt-2"
          : "max-w-7xl rounded-full bg-transparent px-4 py-4 border border-transparent shadow-none mt-0",
        className
      )}
    >
      {children}
    </div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  return (
    <nav
      className={cn(
        "absolute inset-0 hidden flex-1 items-center justify-center lg:flex pointer-events-none",
        className
      )}
      aria-label="Main Navigation"
    >
      <div className="flex items-center space-x-1 pointer-events-auto">
        {items.map((item, idx) => (
          <a
            key={`link-${idx}`}
            href={item.link}
            onClick={onItemClick}
            className="relative px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-full transition-colors duration-150"
          >
            {item.name}
          </a>
        ))}
      </div>
    </nav>
  );
};

export const MobileNav = ({ children, className, visible: explicitVisible }: MobileNavProps) => {
  const context = useNavbar();
  const visible = explicitVisible !== undefined ? explicitVisible : context.visible;

  return (
    <div
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between lg:hidden transition-all duration-200",
        visible
          ? "rounded-2xl bg-background/90 dark:bg-neutral-950/90 backdrop-blur-md px-4 py-2.5 border border-border/80 shadow-md mt-2"
          : "bg-transparent px-2 py-3 border border-transparent mt-0",
        className
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "absolute inset-x-0 top-full mt-2 z-50 flex w-full flex-col items-start justify-start gap-4 rounded-xl bg-popover/95 backdrop-blur-md border border-border p-6 shadow-xl",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      className="p-1 rounded-md text-foreground hover:bg-muted/80 transition-colors"
    >
      {isOpen ? (
        <X className="h-6 w-6 text-foreground" />
      ) : (
        <Menu className="h-6 w-6 text-foreground" />
      )}
    </button>
  );
};

export const NavbarLogo = () => {
  return (
    <Link
      href="/"
      className="relative z-20 mr-4 flex items-center px-1 py-1 text-sm font-normal text-foreground hover:opacity-90 transition-opacity"
    >
      <Logo />
    </Link>
  );
};

export const NavbarButton = ({
  href,
  as: Tag = "a",
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient";
} & (
  | React.ComponentPropsWithoutRef<"a">
  | React.ComponentPropsWithoutRef<"button">
)) => {
  const baseStyles =
    "px-4 py-2 rounded-md text-sm font-medium relative cursor-pointer transition-all duration-150 inline-block text-center select-none active:scale-95";

  const variantStyles = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    secondary: "bg-transparent text-foreground hover:bg-muted/80",
    dark: "bg-black text-white hover:bg-neutral-900 shadow-sm dark:bg-white dark:text-black dark:hover:bg-neutral-100",
    gradient:
      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95 shadow-sm",
  };

  return (
    <Tag
      href={href || undefined}
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    >
      {children}
    </Tag>
  );
};

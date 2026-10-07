"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ArrowLeft, Search, Compass, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full bg-[#0e0f11] text-neutral-100 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 max-w-lg w-full text-center flex flex-col items-center">
        {/* Glowing 404 Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-primary mb-6 shadow-inner backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>ERROR 404 • PAGE NOT FOUND</span>
        </div>

        {/* Big visual number */}
        <div className="relative my-2">
          <h1 className="text-8xl sm:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-300 to-neutral-600 drop-shadow-sm">
            404
          </h1>
          <div className="absolute -top-2 -right-4 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary backdrop-blur-md border border-primary/30">
            <Compass className="w-4 h-4 animate-spin [animation-duration:8s]" />
          </div>
        </div>

        {/* Headings & Description */}
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-4 mb-2">
          Lost in the workspace?
        </h2>
        <p className="text-sm text-neutral-400 max-w-md leading-relaxed mb-8">
          The page or URL you're looking for doesn't exist, has been moved, or hasn't been built yet.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Button
            asChild
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-5 h-10 shadow-lg shadow-primary/20 gap-2"
          >
            <Link href="/dashboard">
              <Home className="w-4 h-4" />
              <span>Go to Dashboard</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="w-full sm:w-auto bg-white/[0.04] border-white/[0.1] text-neutral-200 hover:text-white hover:bg-white/[0.08] font-medium px-5 h-10 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </Button>

          <Button
            asChild
            variant="ghost"
            className="w-full sm:w-auto text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] font-medium px-4 h-10 gap-1.5"
          >
            <Link href="/dashboard/issues">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Team Tasks</span>
            </Link>
          </Button>
        </div>

        {/* Quick Links Footer */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] w-full flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500">
          <Link href="/dashboard" className="hover:text-neutral-300 transition-colors">
            Home
          </Link>
          <span>•</span>
          <Link href="/dashboard/my-tasks" className="hover:text-neutral-300 transition-colors">
            My Tasks
          </Link>
          <span>•</span>
          <Link href="/dashboard/projects" className="hover:text-neutral-300 transition-colors">
            Projects
          </Link>
          <span>•</span>
          <Link href="/dashboard/calendar" className="hover:text-neutral-300 transition-colors">
            Calendar
          </Link>
          <span>•</span>
          <Link href="/dashboard/members" className="hover:text-neutral-300 transition-colors">
            Members
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ArrowLeft, Compass, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] p-6 text-center select-none relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      {/* 404 Content */}
      <div className="relative z-10 max-w-md w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-primary mb-4">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>404 • NOT FOUND</span>
        </div>

        <div className="relative my-1">
          <h1 className="text-7xl sm:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-300 to-neutral-600">
            404
          </h1>
          <div className="absolute -top-1 -right-3 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
            <Compass className="w-3.5 h-3.5 animate-spin [animation-duration:8s]" />
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white mt-3 mb-2">
          Page not found
        </h2>
        <p className="text-xs text-neutral-400 max-w-sm leading-relaxed mb-6">
          This dashboard page doesn't exist, has been removed, or is still under construction.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <Button
            asChild
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-4 h-9 shadow-md gap-2 text-xs"
          >
            <Link href="/dashboard">
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard Home</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="bg-white/[0.04] border-white/[0.1] text-neutral-200 hover:text-white hover:bg-white/[0.08] font-medium px-4 h-9 gap-1.5 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] font-medium px-3 h-9 gap-1 text-xs"
          >
            <Link href="/dashboard/issues">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Team Tasks</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

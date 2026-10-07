import { cn } from "@/lib/utils";
import Link from "next/link";
import { Layers } from "lucide-react";

export function Logo(props: { className?: string; link?: string }) {
  return (
    <Link href={props.link ?? '/'} className={cn("flex items-center gap-2.5", props.className)}>
      <div className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm ring-1 ring-primary/20">
        <Layers className="h-4.5 w-4.5" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-foreground leading-none">
          Sketch<span className="text-primary">ItUp</span>
        </span>
      </div>
    </Link>
  );
}

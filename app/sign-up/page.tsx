import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ShieldAlert } from "lucide-react"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Section - Primary Gradient */}
      <div className="hidden lg:flex lg:w-[40%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
        <div className="relative z-10 flex flex-col justify-between p-8 h-full">
          <Link href="/">
            <Button
              variant="outline"
              className="bg-card/50 border-border/50 text-foreground hover:bg-card/80 hover:border-border backdrop-blur-sm w-fit"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="text-foreground space-y-4">
            <h2 className="text-3xl font-light tracking-tight">Enterprise Access Control</h2>
            <p className="text-base text-muted-foreground">
              SIU-ERPOS account provisioning is managed centrally by your company administrator.
            </p>
          </div>
        </div>
      </div>

      {/* Right Section - Notice */}
      <div className="flex-1 lg:w-[60%] bg-background flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center space-x-3">
            <span className="text-foreground text-xl font-bold tracking-tight">
              Sketch<span className="text-primary">ItUp</span>
            </span>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/50 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Registration Disabled
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Accounts are created by your administrator. Sign in with the credentials you were given.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/sign-in">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
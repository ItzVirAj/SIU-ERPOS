"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft, Check, AlertCircle } from "lucide-react"
import Link from "next/link"
import { safeRedirect } from "@/lib/utils"
import { validatePassword } from "@/lib/password-policy"

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [googleLoading, setGoogleLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const passwordValidation = validatePassword(password)

  const handleGoogleSignUp = async () => {
    setError("")
    setGoogleLoading(true)

    try {
      const redirectUrl = safeRedirect(searchParams.get("redirect"))
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectUrl,
      })
    } catch (err: any) {
      setError(err?.message || "Failed to sign up with Google")
      setGoogleLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")

    const validation = validatePassword(password)
    if (!validation.isValid) {
      setError(validation.errors[0])
      return
    }

    setEmailLoading(true)

    try {
      const redirectUrl = safeRedirect(searchParams.get("redirect"))
      const res = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim() || email.split("@")[0],
      })

      if (res.error) {
        setError(res.error.message || "Failed to create account")
        setEmailLoading(false)
        return
      }

      // Check if email verification is required or session exists
      const { data: session } = await authClient.getSession()
      if (session?.user) {
        router.push(redirectUrl)
        router.refresh()
      } else {
        setSuccessMessage("Account created successfully! Please check your email inbox to verify your email address before logging in.")
        setEmailLoading(false)
      }
    } catch (err: any) {
      try {
        const { data: session } = await authClient.getSession()
        if (session?.user) {
          const redirectUrl = safeRedirect(searchParams.get("redirect"))
          router.push(redirectUrl)
          return
        }
      } catch {}
      setError(err?.message || "An unexpected error occurred during sign up")
      setEmailLoading(false)
    }
  }

  const rawRedirect = searchParams.get("redirect")
  const sanitizedRedirect = rawRedirect ? safeRedirect(rawRedirect) : null

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Section - Primary Gradient */}
      <div className="hidden lg:flex lg:w-[40%] relative overflow-hidden">
        {/* Gradient Background using primary color */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background"></div>
        
        {/* Subtle animated background patterns */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-0 left-0 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob bg-primary"></div>
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob [animation-delay:2s] bg-primary"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob [animation-delay:4s] bg-primary"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-8 h-full">
          {/* Back Button */}
          <Link href="/">
            <Button 
              variant="outline" 
              className="bg-card/50 border-border/50 text-foreground hover:bg-card/80 hover:border-border backdrop-blur-sm w-fit"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>

          {/* Bottom Text */}
          <div className="text-foreground space-y-4">
            <h2 className="text-3xl font-light tracking-tight">Ship Faster, Work Smarter</h2>
            <p className="text-base text-muted-foreground">The task management platform that actually works. Beautiful, intuitive, and built for teams who ship.</p>
          </div>
        </div>
      </div>

      {/* Right Section - Main Form */}
      <div className="flex-1 lg:w-[60%] bg-background flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <span className="text-foreground text-xl font-bold tracking-tight">Sketch<span className="text-primary">ItUp</span></span>
          </div>

          {/* Welcome Message */}
          <div className="space-y-1">
            <h1 className="text-3xl font-light tracking-tight text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground">Sign up to start your journey with SketchItUp Task Suite</p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 border border-destructive/50 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {successMessage ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">Verify your email address</h3>
                <p className="text-xs text-muted-foreground">{successMessage}</p>
              </div>
              <Link href={`/sign-in${sanitizedRedirect ? `?redirect=${encodeURIComponent(sanitizedRedirect)}` : ""}`}>
                <Button className="w-full bg-primary text-primary-foreground">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Google Sign Up Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 border-border hover:bg-muted/50 font-normal"
                onClick={handleGoogleSignUp}
                disabled={googleLoading || emailLoading}
              >
                <GoogleIcon />
                <span>{googleLoading ? "Signing up with Google..." : "Continue with Google"}</span>
              </Button>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-3 text-xs uppercase text-muted-foreground font-medium">or continue with email</span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              {/* Email / Password Sign Up Form */}
              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs text-foreground">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    disabled={emailLoading}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-foreground">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    disabled={emailLoading}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs text-foreground">Password</Label>
                    {password && (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {passwordValidation.feedback}
                      </span>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters"
                    disabled={emailLoading}
                    required
                  />

                  {/* Password Strength Meter */}
                  {password.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {/* Strength Bars */}
                      <div className="grid grid-cols-4 gap-1.5 h-1">
                        {[1, 2, 3, 4].map((step) => {
                          const isActive = passwordValidation.score >= step;
                          let barColor = "bg-muted";
                          if (isActive) {
                            if (passwordValidation.score === 1) barColor = "bg-rose-500";
                            else if (passwordValidation.score === 2) barColor = "bg-amber-500";
                            else if (passwordValidation.score === 3) barColor = "bg-blue-500";
                            else barColor = "bg-emerald-500";
                          }
                          return (
                            <div
                              key={step}
                              className={`rounded-full transition-all duration-300 ${barColor}`}
                            />
                          );
                        })}
                      </div>

                      {/* Criteria Checklist */}
                      <div className="text-[11px] space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Check
                            className={`w-3 h-3 ${
                              password.length >= 12 ? "text-emerald-500" : "text-muted-foreground/40"
                            }`}
                          />
                          <span>At least 12 characters long</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check
                            className={`w-3 h-3 ${
                              passwordValidation.errors.every((e) => !e.includes("3 of"))
                                ? "text-emerald-500"
                                : "text-muted-foreground/40"
                            }`}
                          />
                          <span>Includes 3 of: uppercase, lowercase, numbers, symbols</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check
                            className={`w-3 h-3 ${
                              passwordValidation.errors.every((e) => !e.includes("common"))
                                ? "text-emerald-500"
                                : "text-muted-foreground/40"
                            }`}
                          />
                          <span>Not a commonly used password</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 justify-center"
                  disabled={emailLoading || googleLoading || !passwordValidation.isValid}
                >
                  {emailLoading ? "Creating account..." : "Sign up with Email"}
                </Button>
              </form>
            </>
          )}

          {/* Sign In Link */}
          <div className="text-center text-sm text-muted-foreground pt-1">
            Already have an account?{" "}
            <Link 
              href={`/sign-in${sanitizedRedirect ? `?redirect=${encodeURIComponent(sanitizedRedirect)}` : ""}`}
              className="text-primary hover:text-primary/80 hover:underline font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
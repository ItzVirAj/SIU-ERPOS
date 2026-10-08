"use client"

import { useState, useEffect } from "react"
import { authClient } from "@/lib/auth-client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { safeRedirect } from "@/lib/utils"

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [googleLoading, setGoogleLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // 2FA state
  const [is2FA, setIs2FA] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)

  // Check if user is already logged in or URL has step=2fa
  useEffect(() => {
    if (searchParams.get("step") === "2fa") {
      setIs2FA(true)
    }

    const checkSession = async () => {
      try {
        const { data: session } = await authClient.getSession()
        if (session?.user && searchParams.get("step") !== "2fa") {
          const redirectUrl = safeRedirect(searchParams.get("redirect"))
          router.push(redirectUrl)
        }
      } catch (err) {
        console.error("Session check error:", err)
      }
    }
    checkSession()
  }, [router, searchParams])

  const handleGoogleSignIn = async () => {
    setError("")
    setGoogleLoading(true)

    try {
      const redirectUrl = safeRedirect(searchParams.get("redirect"))
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectUrl,
      })
    } catch (err: any) {
      setError(err?.message || "Failed to sign in with Google")
      setGoogleLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setEmailLoading(true)

    try {
      const redirectUrl = safeRedirect(searchParams.get("redirect"))
      const res: any = await authClient.signIn.email({
        email: email.trim(),
        password,
      })

      if (res.error) {
        setError(res.error.message || "Invalid email or password")
        setEmailLoading(false)
        return
      }

      // If user has 2FA enabled, Better Auth signals twoFactorRedirect
      if (res.data?.twoFactorRedirect) {
        setIs2FA(true)
        setEmailLoading(false)
        return
      }

      router.push(redirectUrl)
      router.refresh()
    } catch (err: any) {
      try {
        const { data: session } = await authClient.getSession()
        if (session?.user) {
          const redirectUrl = safeRedirect(searchParams.get("redirect"))
          router.push(redirectUrl)
          return
        }
      } catch {}
      setError(err?.message || "Failed to sign in with email")
      setEmailLoading(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setTwoFactorLoading(true)

    try {
      const redirectUrl = safeRedirect(searchParams.get("redirect"))
      let res: any

      if (useBackupCode) {
        res = await authClient.twoFactor.verifyBackupCode({
          code: twoFactorCode.trim(),
        })
      } else {
        res = await authClient.twoFactor.verifyTotp({
          code: twoFactorCode.trim(),
        })
      }

      if (res?.error) {
        setError(res.error.message || "Invalid two-factor authentication code")
        setTwoFactorLoading(false)
        return
      }

      router.push(redirectUrl)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Failed to verify two-factor code")
      setTwoFactorLoading(false)
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
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              {is2FA ? "Two-Factor Verification" : "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {is2FA
                ? useBackupCode
                  ? "Enter one of your emergency recovery backup codes."
                  : "Enter the 6-digit code from your authenticator app."
                : "Sign in to your account to access your SketchItUp Task Suite"}
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 border border-destructive/50 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {is2FA ? (
            /* 2FA Challenge Form */
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="twoFactorCode" className="text-xs text-foreground">
                  {useBackupCode ? "Backup Recovery Code" : "6-Digit Authentication Code"}
                </Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  autoComplete="one-time-code"
                  autoFocus
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder={useBackupCode ? "e.g. 1a2b3c4d5e" : "123456"}
                  className="font-mono text-center tracking-widest text-lg"
                  disabled={twoFactorLoading}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 justify-center"
                disabled={twoFactorLoading || !twoFactorCode.trim()}
              >
                {twoFactorLoading ? "Verifying..." : "Verify & Continue"}
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    setTwoFactorCode("");
                    setError("");
                  }}
                  className="text-primary hover:underline"
                >
                  {useBackupCode ? "Use Authenticator App instead" : "Use backup recovery code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIs2FA(false);
                    setTwoFactorCode("");
                    setError("");
                  }}
                  className="text-muted-foreground hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Google Sign In Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 border-border hover:bg-muted/50 font-normal"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || emailLoading}
              >
                <GoogleIcon />
                <span>{googleLoading ? "Signing in with Google..." : "Continue with Google"}</span>
              </Button>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-3 text-xs uppercase text-muted-foreground font-medium">or continue with email</span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              {/* Email / Password Sign In Form */}
              <form onSubmit={handleEmailSignIn} className="space-y-4">
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
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={emailLoading}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 justify-center"
                  disabled={emailLoading || googleLoading}
                >
                  {emailLoading ? "Signing in..." : "Sign in with Email"}
                </Button>
              </form>

              {/* Sign Up Link */}
              <div className="text-center text-sm text-muted-foreground pt-1">
                Don&apos;t have an account?{" "}
                <Link 
                  href={`/sign-up${sanitizedRedirect ? `?redirect=${encodeURIComponent(sanitizedRedirect)}` : ""}`}
                  className="text-primary hover:text-primary/80 hover:underline font-medium"
                >
                  Sign up
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
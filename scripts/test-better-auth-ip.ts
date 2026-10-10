import { betterAuth } from "better-auth"

// Just test type resolution for advanced options in betterAuth
const testConfig = {
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
    }
  }
}
console.log("TypeScript testConfig prepared")

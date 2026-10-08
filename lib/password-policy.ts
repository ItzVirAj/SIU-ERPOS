/**
 * Centralized Password Policy and Validation
 * Enforces minimum 12 chars, maximum 128 chars, complexity rules, and common password bans.
 */

const COMMON_PASSWORDS = new Set([
  "password1234",
  "password12345",
  "password123456",
  "123456789012",
  "1234567890123",
  "qwertyuiop12",
  "admin12345678",
  "administrator1",
  "welcome123456",
  "letmein123456",
  "pass@12345678",
  "pass@123456789",
  "changeme12345",
  "iloveyou12345",
]);

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 to 4
  errors: string[];
  feedback: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== "string") {
    return {
      isValid: false,
      score: 0,
      errors: ["Password is required"],
      feedback: "Please enter a password",
    };
  }

  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long");
  }

  if (password.length > 128) {
    errors.push("Password must be at most 128 characters long");
  }

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || lower.includes("password") || lower.includes("12345678")) {
    errors.push("Password is too common or easily guessable");
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let criteriaCount = 0;
  if (hasUpper) criteriaCount++;
  if (hasLower) criteriaCount++;
  if (hasDigit) criteriaCount++;
  if (hasSpecial) criteriaCount++;

  if (criteriaCount < 3) {
    errors.push("Password must include at least 3 of: uppercase letters, lowercase letters, numbers, and special characters");
  }

  // Calculate score (0-4)
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (criteriaCount >= 3) score++;
  if (criteriaCount === 4 && password.length >= 14) score++;

  let feedback = "Weak password";
  if (score >= 4) feedback = "Very strong password";
  else if (score >= 3) feedback = "Strong password";
  else if (score >= 2) feedback = "Good password";
  else if (score >= 1) feedback = "Fair password";

  return {
    isValid: errors.length === 0,
    score,
    errors,
    feedback,
  };
}

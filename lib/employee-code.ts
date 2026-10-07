/**
 * Generates an employee code in the format "EMP#" + 5 uppercase letters/numbers.
 * Example: EMP#A7K9X, EMP#8M2Q4
 */
export function generateEmployeeCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EMP#${randomPart}`;
}

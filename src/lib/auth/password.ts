import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function passwordIssues(password: string) {
  const issues: string[] = [];
  if (password.length < 10) issues.push("Use at least 10 characters.");
  if (!/[A-Z]/.test(password)) issues.push("Include an uppercase letter.");
  if (!/[a-z]/.test(password)) issues.push("Include a lowercase letter.");
  if (!/[0-9]/.test(password)) issues.push("Include a number.");
  return issues;
}

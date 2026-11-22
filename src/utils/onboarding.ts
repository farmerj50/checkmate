// Keep these checks aligned with /auth/register; registration tests cover both.
export function isSignupEmail(value: string): boolean {
  return /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/.test(value.trim());
}

export function birthDateError(value: string, now = new Date()): string | null {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value) {
    return 'Enter a valid date of birth, including the four-digit year';
  }
  const beforeBirthday = now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate());
  const age = now.getUTCFullYear() - date.getUTCFullYear() - Number(beforeBirthday);
  if (age < 18) return 'You must be 18 or older to join';
  if (age > 120) return 'Check your birth year; your age must be between 18 and 120';
  return null;
}

export const onboardingFieldSteps: Record<string, number> = {
  firstName: 0, lastName: 1, dateOfBirth: 2, gender: 3, location: 4,
  occupation: 5, bio: 6, interests: 7, lookingFor: 8,
};

export function validateOnboarding(form: {
  firstName: string; lastName: string; dateOfBirth: string; gender: string;
  location: string; interests: string[]; lookingFor: string;
}): { step: number; message: string } | null {
  if (!form.firstName.trim()) return { step: 0, message: 'Enter your first name' };
  if (!form.lastName.trim()) return { step: 1, message: 'Enter your last name' };
  const birthdayError = birthDateError(form.dateOfBirth);
  if (birthdayError) return { step: 2, message: birthdayError };
  if (!['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'].includes(form.gender)) {
    return { step: 3, message: 'Select how you identify' };
  }
  if (!form.location.trim()) return { step: 4, message: 'Enter your city or location' };
  if (form.interests.length < 3) return { step: 7, message: 'Pick at least 3 interests' };
  if (!['RELATIONSHIP', 'CASUAL', 'FRIENDSHIP', 'NETWORKING'].includes(form.lookingFor)) {
    return { step: 8, message: 'Select what you are looking for' };
  }
  return null;
}

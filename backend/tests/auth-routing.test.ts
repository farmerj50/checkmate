import * as React from 'react';
import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../src/contexts/auth';
import AppRoutes from '../../src/routes/AppRoutes';

// Exercise the real route guards without loading unrelated page data.
vi.mock('../../src/pages/Onboarding', () => ({ default: () => React.createElement('div', null, 'ONBOARDING_FORM') }));
vi.mock('../../src/pages/HomeFeed', () => ({ default: () => React.createElement('div', null, 'EXISTING_PROFILE_HOME') }));
vi.mock('../../src/pages/Login', () => ({ default: () => React.createElement('div', null, 'LOGIN_FORM') }));
vi.mock('../../src/pages/Signup', () => ({ default: () => React.createElement('div', null, 'SIGNUP_FORM') }));

type AuthState = NonNullable<React.ComponentProps<typeof AuthContext.Provider>['value']>;
const signedIn = {
  firebaseUser: { uid: 'fixture-user' } as AuthState['firebaseUser'], dbUser: null,
  loading: false, needsOnboarding: false, profileChecked: false, profileError: null,
  signInWithEmail: vi.fn(), signUpWithEmail: vi.fn(), signInWithGoogle: vi.fn(),
  logout: vi.fn(), resetPassword: vi.fn(), refreshDbUser: vi.fn(), completeOnboarding: vi.fn(),
} satisfies AuthState;

beforeEach(() => {
  // The backend Vite config uses classic JSX for imported frontend components.
  vi.stubGlobal('React', React);
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React Router's SSR useLayoutEffect notice.
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function render(path: string, state: Partial<AuthState>) {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    let html = '';
    output.on('data', data => { html += data.toString(); });
    output.on('end', () => resolve(html));
    const stream = renderToPipeableStream(React.createElement(AuthContext.Provider,
      { value: { ...signedIn, ...state } },
      React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AppRoutes))), {
      onAllReady() { stream.pipe(output); },
      onShellError: reject,
      onError: reject,
    });
  });
}

describe('Registration route decisions', () => {
  it.each(['/login', '/signup', '/onboarding', '/home'])('shows account recovery, never registration, on a conflict at %s', async path => {
    const html = await render(path, { profileError: { code: 'auth/profile-conflict', message: 'Conflict' } });
    expect(html).toContain('Your profile needs reconnecting');
    expect(html).toContain('Back to sign in');
    expect(html).not.toContain('ONBOARDING_FORM');
    expect(html).not.toContain('EXISTING_PROFILE_HOME');
  });

  it.each(['/signup', '/onboarding', '/home'])('waits for a successful profile check at %s', async path => {
    const html = await render(path, {});
    expect(html).not.toContain('ONBOARDING_FORM');
    expect(html).not.toContain('EXISTING_PROFILE_HOME');
    expect(html).not.toContain('SIGNUP_FORM');
  });

  it('does not interpret a failed lookup as a new account', async () => {
    const html = await render('/onboarding', { profileError: { code: 'auth/profile-unavailable', message: 'Unavailable' } });
    expect(html).toContain('We could not load your profile');
    expect(html).not.toContain('ONBOARDING_FORM');
  });

  it('renders onboarding after confirming this identity has no existing profile', async () => {
    const html = await render('/onboarding', { profileChecked: true, needsOnboarding: true });
    expect(html).toContain('ONBOARDING_FORM');
  });

  it('renders the existing profile home after a successful identity lookup', async () => {
    const html = await render('/home', { profileChecked: true, dbUser: { id: 'own-profile' } as AuthState['dbUser'] });
    expect(html).toContain('EXISTING_PROFILE_HOME');
    expect(html).not.toContain('ONBOARDING_FORM');
  });
});

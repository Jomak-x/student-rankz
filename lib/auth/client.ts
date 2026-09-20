"use client";

import { createAuthClient } from "@neondatabase/auth/next";

type NeonAuthClient = ReturnType<typeof createAuthClient>;

export type SignInEmailInput = Parameters<
  NeonAuthClient["signIn"]["email"]
>[0];
export type SignUpEmailInput = Parameters<
  NeonAuthClient["signUp"]["email"]
>[0];

export interface AuthClientAdapter {
  signInEmail(input: SignInEmailInput): ReturnType<
    NeonAuthClient["signIn"]["email"]
  >;
  signUpEmail(input: SignUpEmailInput): ReturnType<
    NeonAuthClient["signUp"]["email"]
  >;
  signOut(): ReturnType<NeonAuthClient["signOut"]>;
}

let neonAuthClient: NeonAuthClient | undefined;

function getNeonAuthClient() {
  neonAuthClient ??= createAuthClient();
  return neonAuthClient;
}

export const authClient: AuthClientAdapter = {
  signInEmail(input) {
    return getNeonAuthClient().signIn.email(input);
  },
  signUpEmail(input) {
    return getNeonAuthClient().signUp.email(input);
  },
  signOut() {
    return getNeonAuthClient().signOut();
  },
};

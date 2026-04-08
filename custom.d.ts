declare module "*.svg" {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

/// <reference types="vite/client" />

// Vite define globals (injected at build time from package.json + git)
declare const __APP_VERSION__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __GIT_COMMIT__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_REDIRECT_URL?: string;
  readonly VITE_PLAID_REDIRECT_URI?: string;
  readonly VITE_NDA_GENERATION_URL?: string;
  readonly VITE_GUEST_MODE_ACCESS_TOKEN?: string;
  readonly VITE_MARKET_SUPABASE_URL?: string;
  readonly VITE_MARKET_SUPABASE_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_ALLOW_INSECURE_BROWSER_LLM?: string;
  readonly VITE_FINNHUB_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  
  // KYC A2A Network Configuration
  readonly VITE_KYC_ENV?: 'development' | 'staging' | 'production';
  readonly VITE_KYC_API_BASE?: string;
  readonly VITE_KYC_DEMO_MODE?: string;
  readonly VITE_KYC_TEST_BANK_IDS?: string;
  
  // Hushh Agent - Firebase/GCP Identity Platform (Phone Auth)
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  
  // Development flag
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

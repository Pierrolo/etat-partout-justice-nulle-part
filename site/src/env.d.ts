/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Build-time default brand: « editorial » (default) or « ci » (Call Intelligence). */
  readonly PUBLIC_BRAND?: 'editorial' | 'ci';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_TIMEZONE: string;
  APP_URL: string;
  /** 個別に許可するアカウント（カンマ区切り） */
  ALLOWED_EMAILS: string;
  /** このドメインのアカウントは全員ログインできる（カンマ区切り。例: yusando.com） */
  ALLOWED_DOMAINS: string;
  /** 最初のログインで「代表」になるアカウント（カンマ区切り） */
  OWNER_EMAILS: string;
  NOTION_TASKS_DB_ID: string;
  NOTION_JOURNAL_TAG: string;
  NOTION_ASSIGNEE: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TOKEN_ENC_KEY?: string;
  NOTION_TOKEN?: string;
  /** テスト用: Notion API の接続先を差し替える */
  NOTION_API_BASE?: string;
  /** 語学アプリ（Firebase プロジェクト）の ID */
  FIREBASE_PROJECT_ID?: string;
  /** 語学アプリの記録を読むためのサービスアカウントの鍵（JSON そのまま） */
  FIREBASE_SERVICE_ACCOUNT?: string;
  /** テスト用: Firebase エミュレーターの接続先 */
  FIREBASE_AUTH_API_BASE?: string;
  FIRESTORE_API_BASE?: string;
  DEV_LOGIN?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture_url: string | null;
}

/** 会社の共有データ（ターム・目標・行動指標・ビジョン）の持ち主 */
export const ORG = 'company';

export type Role = 'owner' | 'lead' | 'member';
export interface Member {
  role: Role;
  department_id: string | null;
}

export type AppEnv = { Bindings: Env; Variables: { user: User; member: Member } };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

import { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
  userId?: number;
  userName?: string;
  admin?: number;
  email?: string;
  realName?: string;
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: "gxwtf_iron_auth",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

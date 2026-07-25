export interface JwtPayload {
  sub: string; // internal user id
  telegramId: string;
}

export interface AuthenticatedUser {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
}

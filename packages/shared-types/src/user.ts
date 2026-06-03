import type { UserStatus } from "./auth";

export interface UserInterface {
  id: string;
  username: string;
  mfaEnabled: boolean;
  gendate: Date;
  expired: boolean;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

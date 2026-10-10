import { Role } from "@/types/app-enums";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      entityKeys: string[];
      phpToken: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    entityKeys: string[];
    phpToken: string;
  }
}

import { Role } from "@prisma/client";
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
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    entityKeys: string[];
  }
}

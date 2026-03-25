import { Db } from "../../infra/db/db.js";
import { User } from "./user.schema.js";
import { JwtPayload, Roles } from "../../shared/schemas/auth.schema";

export type UserRepo = {
  findByEId: (e_id: string) => Promise<User | null>;
};

export function makeUserRepo(db: Db): UserRepo {
  const findByEId = async (e_id: string): Promise<User | null> => {
    const { rows } = await db.query(
      "SELECT * FROM users WHERE e_id = ?",
      [e_id]
    );
    return rows.length > 0 ? (rows[0] as User) : null;
  };

  return { findByEId };
}
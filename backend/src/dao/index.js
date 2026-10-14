import { MongoClient } from "mongodb";
import { UsersDAO } from "./users.dao.js";
import { ProjectsDAO } from "./projects.dao.js";
import { hashPassword } from "../lib/password.js";
import { AccountTokensDAO } from "./account-tokens.dao.js";
import { SessionsDAO } from "./sessions.dao.js";

export async function connectDatabase(config) {
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  const db = client.db(config.mongoDatabase);
  const daos = { users: new UsersDAO(db.collection("users")), projects: new ProjectsDAO(db.collection("projects")), accountTokens: new AccountTokensDAO(db.collection("account_tokens")), sessions: new SessionsDAO(db.collection("sessions")) };
  await Promise.all(Object.values(daos).map((dao) => dao.createIndexes()));
  await daos.users.ensureAdministrator({
    name: config.adminName,
    email: config.adminEmail,
    passwordHash: await hashPassword(config.adminPassword),
  });
  return { client, daos };
}
